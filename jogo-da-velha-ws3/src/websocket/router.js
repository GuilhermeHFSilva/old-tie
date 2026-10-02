import {
    handleJoinRoom,
    handleListRooms,
    handleDisconnect
} from './handlers/roomHandler.js';
import { handleMove } from './handlers/moveHandler.js';
import { handleChatMessage } from './handlers/chatHandler.js';
import { handleNewGame } from './handlers/matchHandler.js';

export function routeWebSocketMessage(ws, messageRaw) {
    let parsed;
    try {
        parsed = JSON.parse(messageRaw);
    } catch (err) {
        console.error('Mensagem JSON inválida recebida:', messageRaw);
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: 'Formato JSON inválido.'
        }));
    }

    const { type, payload } = parsed;

    // Trata mensagens onde os campos vêm na raiz do objeto JSON (conforme PDF Listings 1 e 2)
    const dataPayload = payload || parsed;

    switch (type) {
        case 'JOIN_ROOM':
        case 'JOIN_GAME':
        case 'CREATE_ROOM':
            handleJoinRoom(ws, dataPayload);
            break;
        case 'MOVE':
            handleMove(ws, dataPayload);
            break;
        case 'CHAT':
        case 'CHAT_MESSAGE':
            handleChatMessage(ws, dataPayload);
            break;
        case 'NEW_GAME':
            handleNewGame(ws);
            break;
        case 'LIST_ROOMS':
            handleListRooms(ws);
            break;
        default:
            console.warn('Tipo de mensagem desconhecido:', type);
            ws.send(JSON.stringify({
                type: 'INVALID_MOVE',
                message: `Evento desconhecido: ${type}`
            }));
            break;
    }
}

export function handleWebSocketDisconnect(ws) {
    handleDisconnect(ws);
}
