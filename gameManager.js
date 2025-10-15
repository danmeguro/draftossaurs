const { v4: uuidv4 } = require('uuid');
const { Game } = require('./rules'); // Aqui fica a engine de regras

class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = {}; // roomId -> { game: Game, sockets: {}, players: [] }
  }

  createRoom(name, maxPlayers=5) {
    const id = uuidv4();
    this.rooms[id] = {
      id, name, maxPlayers,
      game: new Game({maxPlayers}),
      sockets: {}, // socketId -> nickname
      players: []  // order matters
    };
    return id;
  }

  listRooms() {
    return Object.values(this.rooms).map(r => ({ id: r.id, name: r.name, players: r.players.length, maxPlayers: r.maxPlayers }));
  }

  addPlayerToRoom(roomId, socket, nickname) {
    const room = this.rooms[roomId];
    if (!room) throw new Error('Room not found');
    if (room.players.length >= room.maxPlayers) throw new Error('Room full');
    room.sockets[socket.id] = nickname;
    room.players.push({ socketId: socket.id, nickname });
    socket.join(roomId);
    // notify
    this.io.to(roomId).emit('roomUpdate', { players: room.players.map(p => p.nickname) });

    // start game automatically if room full (opcional)
    if (room.players.length === room.maxPlayers) {
      room.game.setup(room.players.map(p => p.nickname));
      this.io.to(roomId).emit('gameStart', room.game.getPublicState());
    }
  }

  handlePlayerAction(socket, payload) {
    const { roomId } = payload;
    const room = this.rooms[roomId];
    if (!room) throw new Error('Room not found');
    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) throw new Error('Player not in room');

    const result = room.game.handleAction(playerIndex, payload);
    // broadcast the updated public state
    this.io.to(roomId).emit('stateUpdate', room.game.getPublicState());
    return result;
  }

  removeSocket(socket) {
    // remove player from any room
    for (const roomId of Object.keys(this.rooms)) {
      const room = this.rooms[roomId];
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx,1);
        delete room.sockets[socket.id];
        this.io.to(roomId).emit('roomUpdate', { players: room.players.map(p => p.nickname) });
      }
    }
  }
}

module.exports = { GameManager };
