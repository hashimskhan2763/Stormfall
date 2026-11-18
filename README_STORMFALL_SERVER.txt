STORMFALL — MATCH SERVER SETUP

This build uses a central WebSocket room server instead of direct PeerJS connections.
The party leader remains the match simulation authority for bots and shared match state.

LOCAL TEST
1. Install Node.js 18 or newer.
2. Put stormfall.html, server.js, and package.json in the same folder.
3. Open a terminal in that folder and run:
      npm install
      npm start
4. Open http://localhost:8080 in your browser.
5. One player creates the party. Friends open the same URL and enter that party code.

PLAYING WITH FRIENDS OVER THE INTERNET
The server must be deployed to a public host that supports persistent WebSocket connections.
Upload all three files to the same server project, install dependencies, and run `npm start`.
Use HTTPS/WSS in production (the client automatically selects WSS when the page is served
through HTTPS). Give friends the public HTTPS URL, then share the in-game party code.

IMPORTANT LIMITATIONS
- This central server relays and tracks party/match snapshots; it does not run the Three.js
  game simulation itself. The party leader's browser remains authoritative for bots and
  shared match progression.
- This is not a production-grade 100-human-player dedicated battle royale server. It does
  not provide matchmaking, anti-cheat, persistence, server-side physics, or robust recovery
  from a leader disconnect during an active match.
- Do not open the HTML directly as file:// for multiplayer. Open it through the Node server.
