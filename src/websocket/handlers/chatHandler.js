import { roomManager } from '../../game/RoomManager.js';
import { chatRepo } from '../../database/chatRepo.js';

export async function handleChatMessage(ws, payload) {
    const messageText = payload.message || payload.text;
    if (!messageText || messageText.trim() === '') return;

    const playerInfo = roomManager.getPlayerInfo(ws);
    if (!playerInfo) return;

    const { salaCodigo, jogadorId, nickname } = playerInfo;
    const room = roomManager.getRoom(salaCodigo);
    const textClean = messageText.trim();

    if (room && room.dbSalaId) {
        try {
            await chatRepo.salvarMensagem(room.dbSalaId, jogadorId, textClean);
        } catch (err) {
            console.error('Erro ao salvar chat no JSON:', err);
        }
    }

    roomManager.broadcastToRoom(salaCodigo, {
        type: 'CHAT_MESSAGE',
        payload: {
            sender: nickname,
            text: textClean,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
    });
}
