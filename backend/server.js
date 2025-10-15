const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameManager } = require('./game/gameManager');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // se quiser servir frontend aqui

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const gm = new GameManager(io);

// Endpoints simples (login / create/join room)
app.post('/api/login', (req, res) => {
  const { nickname } = req.body;
  if (!nickname) return res.status(400).json({ error: 'nickname required' });
  // para POC devolvemos um token simples (no real system, usar JWT e DB)
  return res.json({ nickname });
});

app.post('/api/create-room', (req, res) => {
  const { roomName, maxPlayers = 5 } = req.body;
  const roomId = gm.createRoom(roomName, maxPlayers);
  return res.json({ roomId });
});

app.get('/api/rooms', (req, res) => {
  return res.json(gm.listRooms());
});

// Socket.IO handlers
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('joinRoom', ({ roomId, nickname }, cb) => {
    try {
      gm.addPlayerToRoom(roomId, socket, nickname);
      cb({ ok: true });
    } catch (err) {
      cb({ ok: false, error: err.message });
    }
  });

  socket.on('playerAction', (payload) => {
    // ex: {roomId, action: 'pick', data: {...}}
    try {
      gm.handlePlayerAction(socket, payload);
    } catch (err) {
      socket.emit('errorMsg', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    gm.removeSocket(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
