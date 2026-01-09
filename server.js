const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Структура: rooms[roomId] = { users: { socketId: { name, socket } } }
const rooms = {};

io.on('connection', socket => {
  let currentRoom = null;
  let userName = null;

  socket.on('join-room', ({ roomId, name }) => {
    // Покидаем предыдущую комнату
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      socket.leave(currentRoom);
      io.to(currentRoom).emit('user-left', { userId: socket.id, name: userName });
    }

    // Присоединяемся к новой комнате
    if (!rooms[roomId]) {
      rooms[roomId] = { users: {} };
    }

    // Проверяем лимит пользователей (максимум 4)
    const userCount = Object.keys(rooms[roomId].users).length;
    if (userCount >= 4) {
      socket.emit('room-full');
      return;
    }

    currentRoom = roomId;
    userName = name || `User-${socket.id.substring(0, 6)}`;
    
    rooms[roomId].users[socket.id] = { name: userName, socket };
    socket.join(roomId);

    // Отправляем список пользователей новому участнику
    const usersInRoom = Object.entries(rooms[roomId].users).map(([id, user]) => ({
      id,
      name: user.name
    }));
    socket.emit('room-users', usersInRoom);

    // Уведомляем других о новом пользователе
    socket.to(roomId).emit('user-joined', { userId: socket.id, name: userName });

    // Отправляем существующих пользователей новому участнику для установки соединений
    const otherUsers = usersInRoom.filter(u => u.id !== socket.id);
    otherUsers.forEach(user => {
      socket.emit('existing-user', { userId: user.id, name: user.name });
    });
  });

  socket.on('message', ({ roomId, message }) => {
    if (currentRoom === roomId && rooms[roomId]) {
      io.to(roomId).emit('message', {
        userId: socket.id,
        name: userName,
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, to, roomId }) => {
    if (currentRoom === roomId && rooms[roomId]?.users[to]) {
      io.to(to).emit('offer', { offer, from: socket.id });
    }
  });

  socket.on('answer', ({ answer, to, roomId }) => {
    if (currentRoom === roomId && rooms[roomId]?.users[to]) {
      io.to(to).emit('answer', { answer, from: socket.id });
    }
  });

  socket.on('ice-candidate', ({ candidate, to, roomId }) => {
    if (currentRoom === roomId && rooms[roomId]?.users[to]) {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    if (currentRoom === roomId && rooms[roomId]) {
      delete rooms[roomId].users[socket.id];
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', { userId: socket.id, name: userName });
      
      // Удаляем комнату, если она пустая
      if (Object.keys(rooms[roomId].users).length === 0) {
        delete rooms[roomId];
      }
      
      currentRoom = null;
      userName = null;
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      delete rooms[currentRoom].users[socket.id];
      socket.to(currentRoom).emit('user-left', { userId: socket.id, name: userName });
      
      // Удаляем комнату, если она пустая
      if (Object.keys(rooms[currentRoom].users).length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
