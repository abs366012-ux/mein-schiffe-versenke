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
            rooms[roomCode] = { players: [], readyCount: 0 };
        }
        
        if (rooms[roomCode].players.length < 2) {
            rooms[roomCode].players.push(socket.id);
            socket.emit('roomJoined', roomCode);
            console.log(`Spieler ${socket.id} in Raum ${roomCode}`);
        } else {
            socket.emit('roomFull');
        }
    });

    socket.on('playerReady', ({ roomCode }) => {
        if (rooms[roomCode]) {
            rooms[roomCode].readyCount++;
            if (rooms[roomCode].readyCount === 2) {
                io.to(roomCode).emit('gameReady', { 
                    startingPlayer: rooms[roomCode].players[0] 
                });
            }
        }
    });

    socket.on('fireShot', ({ roomCode, targetX, targetY }) => {
        // Schuss an den Gegner weiterleiten
        socket.to(roomCode).emit('incomingShot', { targetX, targetY });
    });

    socket.on('shotResult', ({ roomCode, result, targetX, targetY }) => {
        // Ergebnis an den Schützen zurückmelden
        // Wenn es ein Treffer ('hit') war, bleibt der Schütze dran.
        // Bei 'miss' wechselt die Runde (wird im Frontend gesteuert).
        socket.to(roomCode).emit('shotResultReport', { result, targetX, targetY });
    });

    socket.on('disconnect', () => {
        console.log(`User getrennt: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));