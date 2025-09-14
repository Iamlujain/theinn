# Spotify Sync App

## Overview
The Spotify Sync App is a Node.js application that allows users to listen to Spotify tracks in sync with another user. It utilizes the Spotify Web API for playback control and OAuth for user authentication.

## Project Structure
```
spotify-sync-app
├── src
│   ├── server.js          # Entry point for the Node.js application
│   └── public
│       ├── index.html     # HTML structure for the frontend
│       └── app.js         # JavaScript logic for the frontend
├── package.json           # npm configuration file
└── README.md              # Project documentation
```

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spotify-sync-app
   ```

2. **Install dependencies**
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   REDIRECT_URI=http://localhost:3000/callback
   ```

4. **Run the application**
   Start the server with:
   ```bash
   node src/server.js
   ```

5. **Access the application**
   Open your browser and go to `http://localhost:3000`.

## Usage
- Click the "Login with Spotify" button to authenticate with your Spotify account.
- Once logged in, you can control playback and see the current track and album art.
- Use the play, pause, and skip buttons to control playback.

## Notes
- This application is a demo and should not be used in production without proper security measures.
- Ensure you have a Spotify Premium account to use the playback features.

## License
This project is licensed under the MIT License.