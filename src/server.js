const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const qs = require('querystring');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;

app.use(express.static('public'));

// In-memory room data
const rooms = {}; // roomId -> { access_token, refresh_token, expires_at, pollIntervalId }

// Helper: create Spotify Authorization URL for a room
function spotifyAuthUrl(roomId) {
    const scope = [
        'streaming',
        'user-read-email',
        'user-read-private',
        'user-modify-playback-state',
        'user-read-playback-state',
        'user-read-currently-playing',
    ].join(' ');
    const params = qs.stringify({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope,
        redirect_uri: REDIRECT_URI,
        state: roomId,
    });
    return `https://accounts.spotify.com/authorize?${params}`;
}

// Helper: Exchange authorization code for tokens
async function exchangeCodeForToken(code) {
    const body = qs.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
    });
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    if (!resp.ok) throw new Error('Failed to get token');
    return resp.json();
}

// Helper: Refresh access token
async function refreshAccessToken(roomId) {
    const room = rooms[roomId];
    if (!room || !room.refresh_token) throw new Error('No refresh token');
    const body = qs.stringify({
        grant_type: 'refresh_token',
        refresh_token: room.refresh_token,
    });
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    if (!resp.ok) throw new Error('Failed to refresh token');
    const data = await resp.json();
    room.access_token = data.access_token;
    room.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
    if (data.refresh_token) room.refresh_token = data.refresh_token;
    return room.access_token;
}

// Helper: Ensure valid access token
async function ensureAccessToken(roomId) {
    const room = rooms[roomId];
    if (!room) throw new Error('No room');
    if (!room.access_token) throw new Error('No access token');
    if (!room.expires_at || Date.now() > room.expires_at - 60 * 1000) {
        await refreshAccessToken(roomId);
    }
    return room.access_token;
}

// Helper: Call Spotify API
async function spotifyApi(roomId, path, options = {}) {
    const token = await ensureAccessToken(roomId);
    const url = `https://api.spotify.com/v1${path}`;
    const resp = await fetch(url, {
        ...options,
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': options.body ? 'application/json' : undefined,
            ...(options.headers || {}),
        },
    });
    return resp;
}

// Poll /me/player and broadcast state
async function pollPlayerState(roomId) {
    try {
        const resp = await spotifyApi(roomId, '/me/player');
        const data = await resp.json();
        io.to(roomId).emit('player_state', { data });
    } catch (err) {
        io.to(roomId).emit('player_state', { error: err.message });
    }
}

// Start polling for a room
function startPolling(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.pollIntervalId) return;
    room.pollIntervalId = setInterval(() => pollPlayerState(roomId), 2000);
    pollPlayerState(roomId).catch(() => {});
}

// Stop polling for a room
function stopPolling(roomId) {
    const room = rooms[roomId];
    if (!room || !room.pollIntervalId) return;
    clearInterval(room.pollIntervalId);
    room.pollIntervalId = null;
}

// OAuth login endpoint (with room support)
app.get('/login', (req, res) => {
    const room = req.query.room || Math.random().toString(36).slice(2, 8);
    res.redirect(spotifyAuthUrl(room));
});

// OAuth callback
app.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.send('Spotify error: ' + error);
    const room = state || Math.random().toString(36).slice(2, 8);
    try {
        const tokenData = await exchangeCodeForToken(code);
        rooms[room] = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
            pollIntervalId: null,
        };
        startPolling(room);
        res.redirect(`/?room=${room}&host=true`);
    } catch (err) {
        res.send('Auth error: ' + err.message);
    }
});

// Socket.IO logic
io.on('connection', (socket) => {
    socket.on('join', ({ room }) => {
        socket.join(room);
        const hasHost = !!rooms[room];
        socket.emit('room_info', {
            hasHost,
            spotifyAuthUrl: spotifyAuthUrl(room),
        });
        if (hasHost) startPolling(room);
    });

    socket.on('command', async ({ room, type }) => {
        if (!rooms[room]) return;
        let path = '';
        let method = 'PUT';
        if (type === 'play') path = '/me/player/play';
        else if (type === 'pause') path = '/me/player/pause';
        else if (type === 'next') { path = '/me/player/next'; method = 'POST'; }
        if (path) {
            try {
                await spotifyApi(room, path, { method });
                pollPlayerState(room);
            } catch (err) {
                io.to(room).emit('player_state', { error: err.message });
            }
        }
    });

    socket.on('disconnecting', () => {
        // Optionally clean up polling if no clients left in room
        // (not strictly needed for demo)
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});