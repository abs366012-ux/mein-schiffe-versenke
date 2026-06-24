const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

io.on('connection', (socket) => {
    console.log(`User verbunden: ${socket.id}`);

    socket.on('joinRoom', (roomCode) => {
        socket.join(roomCode);
        if (!rooms[roomCode]) {
            rooms[roomCode] = { players: [], readyCount: 0, startVotes: 0 };
        }
        
        if (rooms[roomCode].players.length < 2 && !rooms[roomCode].players.includes(socket.id)) {
            rooms[roomCode].players.push(socket.id);
            socket.emit('roomJoined', roomCode);
        } else if (rooms[roomCode].players.length >= 2 && !rooms[roomCode].players.includes(socket.id)) {
            socket.emit('roomFull');
        }
    });

    // Spieler signalisiert, dass er die Schiffe fertig platziert hat und START drückt
    socket.on('playerReadyToStart', ({ roomCode }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].startVotes++;
            
            // Erst wenn BEIDE Spieler auf Start gedrückt haben
            if (rooms[roomCode].startVotes === 2) {
                // Zufälligen Startspieler bestimmen
                const starter = rooms[roomCode].players[Math.floor(Math.random() * 2)];
                io.to(roomCode).emit('gameReady', { startingPlayer: starter });
            }
        }
    });

    // Reset-Logik für eine neue Runde
    socket.on('requestRestart', ({ roomCode }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].startVotes = 0; // Start-Stimmen zurücksetzen
            io.to(roomCode).emit('restartGame');
        }
    });

    socket.on('fireShot', ({ roomCode, targetX, targetY }) => {
        socket.to(roomCode).emit('incomingShot', { targetX, targetY });
    });

    socket.on('shotResult', ({ roomCode, result, targetX, targetY }) => {
        socket.to(roomCode).emit('shotResultReport', { result, targetX, targetY });
    });

    socket.on('disconnect', () => {
        // Räume aufräumen, wenn jemand geht
        for (const roomCode in rooms) {
            if (rooms[roomCode].players.includes(socket.id)) {
                rooms[roomCode].players = rooms[roomCode].players.filter(id => id !== socket.id);
                rooms[roomCode].startVotes = 0;
                io.to(roomCode).emit('opponentDisconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));