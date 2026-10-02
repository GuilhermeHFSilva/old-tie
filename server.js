import 'dotenv/config';
import http from 'http';
import { WebSocketServer } from 'ws';
import app from './src/app.js';
import './src/config/db.js'; // Conecta ao banco de dados
import { routeWebSocketMessage, handleWebSocketDisconnect } from './src/websocket/router.js';

const PORT = process.env.PORT || 3000;

// Cria servidor HTTP do Express
const server = http.createServer(app);

// Anexa o Servidor WebSocket ao mesmo servidor HTTP
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
    console.log(`🔌 Novo cliente WebSocket conectado de ${req.socket.remoteAddress}`);

    ws.on('message', (message) => {
        routeWebSocketMessage(ws, message.toString());
    });

    ws.on('close', () => {
        console.log('❌ Cliente WebSocket desconectou.');
        handleWebSocketDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error('⚠️ Erro no socket:', err.message);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
    console.log(`🌐 WebSocket Server pronto na mesma porta.`);
});
