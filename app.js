const socket = io();
const qs = new URLSearchParams(location.search);
const room = qs.get('room') || Math.random().toString(36).slice(2, 8);
const isHostRedirect = qs.get('host') === 'true';

// UI elements
const loginButton = document.getElementById('login-button');
const albumArt = document.getElementById('album-art');
const trackName = document.getElementById('track-name');
const trackArtists = document.getElementById('track-artists');
const playBtn = document.getElementById('play');
const pauseBtn = document.getElementById('pause');
const nextBtn = document.getElementById('next');
const status = document.getElementById('status');

let currentState = null;

// Join the room on socket connect
socket.on('connect', () => {
    socket.emit('join', { room });
});

// Receive basic room info (host presence and auth URL)
socket.on('room_info', ({ hasHost, spotifyAuthUrl }) => {
    if (!hasHost) {
        loginButton.style.display = 'block';
        loginButton.href = spotifyAuthUrl;
    } else {
        loginButton.style.display = 'none';
    }
});

// Handle player state broadcasts from server
socket.on('player_state', ({ data, error }) => {
    if (error) {
        status.textContent = 'Error: ' + error;
        return;
    } else {
        status.textContent = '';
    }
    currentState = data;
    if (!data || !data.item) {
        trackName.textContent = 'No track playing';
        trackArtists.textContent = '';
        albumArt.src = '';
        return;
    }
    const item = data.item;
    albumArt.src = item.album.images[0]?.url || '';
    trackName.textContent = item.name;
    trackArtists.textContent = item.artists.map(a => a.name).join(', ');
    togglePlayPauseButtons(data.is_playing);
});

// Toggle play/pause buttons
function togglePlayPauseButtons(isPlaying) {
    if (isPlaying) {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'block';
    } else {
        playBtn.style.display = 'block';
        pauseBtn.style.display = 'none';
    }
}

// Emit commands to server when user interacts with controls
playBtn.addEventListener('click', () => {
    socket.emit('command', { room, type: 'play' });
});

pauseBtn.addEventListener('click', () => {
    socket.emit('command', { room, type: 'pause' });
});

nextBtn.addEventListener('click', () => {
    socket.emit('command', { room, type: 'next' });
});