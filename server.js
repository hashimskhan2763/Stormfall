// Stormfall Royale authoritative room relay / host-authority coordinator.
// Run with: npm install && npm start
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const PORT = Number(process.env.PORT || 8080);
const GAME = path.join(__dirname, 'stormfall_royale_expanded.html');
const rooms = new Map();
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/' || url.pathname === '/stormfall_royale_expanded.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(GAME).pipe(res); return;
  }
  if (url.pathname === '/health') { res.writeHead(200, {'content-type':'application/json'}); res.end(JSON.stringify({ok:true,rooms:rooms.size})); return; }
  res.writeHead(404); res.end('Not found');
});
const wss = new WebSocketServer({ server, maxPayload: 128 * 1024 });
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const safeRoom = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
function broadcast(room, data, except) { for (const c of room.clients) if (c !== except) send(c, data); }
wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 11);
  ws.room = null; ws.lastPacket = 0; ws.packetCount = 0;
  ws.on('message', raw => {
    const now = Date.now();
    if (now - ws.lastPacket < 1000) ws.packetCount++; else { ws.packetCount = 0; ws.lastPacket = now; }
    if (ws.packetCount > 45) return;
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'join') {
      if (ws.room) return;
      const code = safeRoom(msg.room); if (code.length < 4) return send(ws,{type:'error',message:'Party code must be at least 4 characters.'});
      let room = rooms.get(code);
      if (!room) {
        if (!msg.create) return send(ws,{type:'error',message:'That party code does not exist. Ask the leader for a current code.'});
        room = { code, host: ws, clients: new Set(), members: new Map(), startedAt: 0 };
        rooms.set(code, room);
      } else if (msg.create && room.host && room.host.readyState === WebSocket.OPEN) {
        return send(ws,{type:'error',message:'That party code is already in use.'});
      }
      ws.room = room; room.clients.add(ws);
      const members = [...room.members.entries()].map(([peer,presence])=>({peer,presence}));
      send(ws,{type:'welcome',peer:ws.id,lead:room.host===ws,members});
      room.members.set(ws.id,{nm:'Player',sk:0,ld:room.host===ws,inm:0});
      broadcast(room,{type:'presence',peer:ws.id,presence:room.members.get(ws.id)},ws);
      return;
    }
    const room = ws.room; if (!room) return;
    if (msg.type === 'presence') {
      const p = msg.presence;
      if (!p || typeof p !== 'object') return;
      // The server assigns identity and leadership; clients cannot impersonate the host.
      const old = room.members.get(ws.id) || {};
      const clean = {
        ...p, nm: String(p.nm || old.nm || 'Player').slice(0,24),
        sk: Math.max(0,Math.min(29,Number(p.sk)||0)), ld: room.host===ws
      };
      // Keep packets bounded and discard unexpected giant arrays.
      for (const key of ['bt','inv','bl','oc','ht','hurt','cv','ke']) {
        if (Array.isArray(clean[key]) && clean[key].length > 12000) clean[key] = clean[key].slice(0,12000);
      }
      if (clean.go && room.host===ws) room.startedAt = Number(clean.startAt) || Number(clean.go);
      room.members.set(ws.id, clean);
      broadcast(room,{type:'presence',peer:ws.id,presence:clean},ws);
    }
  });
  ws.on('close', () => {
    const room = ws.room; if (!room) return;
    room.clients.delete(ws); room.members.delete(ws.id);
    if (room.host === ws) {
      room.host = [...room.clients].find(c=>c.readyState===WebSocket.OPEN) || null;
      if (room.host) send(room.host,{type:'role',lead:true});
    }
    broadcast(room,{type:'leave',peer:ws.id});
    if (!room.clients.size) rooms.delete(room.code);
  });
});
server.listen(PORT, () => console.log(`Stormfall server running at http://localhost:${PORT}`));
