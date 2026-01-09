const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let users = {};

io.on('connection', socket => {
  socket.on('join', name => {
    users[socket.id] = name;
    io.emit('users', Object.values(users));
  });

  socket.on('message', msg => {
    io.emit('message', msg);
  });

  socket.on('offer', data => {
    if(io.sockets.sockets.get(data.to)) {
      io.to(data.to).emit('offer', { offer: data.offer, from: socket.id });
    }
  });

  socket.on('answer', data => {
    if(io.sockets.sockets.get(data.to)) {
      io.to(data.to).emit('answer', { answer: data.answer, from: socket.id });
    }
  });

  socket.on('ice', data => {
    if(io.sockets.sockets.get(data.to)) {
      io.to(data.to).emit('ice', data.candidate);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('users', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
