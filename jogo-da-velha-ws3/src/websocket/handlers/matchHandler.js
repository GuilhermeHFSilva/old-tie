import { roomManager } from '../../game/RoomManager.js';
import { partidaRepo } from '../../database/partidaRepo.js';
import { broadcastBoardUpdate, startRoomTurnTimer } from './roomHandler.js';

export async function handleNewGame(ws) {
    const playerInfo = roomManager.getPlayerInfo(ws);
    if (!playerInfo) return;

    const { salaCodigo, jogadorId, nickname } = playerInfo;
    const room = roomManager.getRoom(salaCodigo);
    if (!room) return;

    room.rematchVotes.add(jogadorId);

    if (room.rematchVotes.size >= 2) {
        // RF-07: Ambos aceitaram a revanche - inverte os símbolos e zera o tabuleiro mantendo a sala
        const updatedRoom = roomManager.resetMatch(salaCodigo);

        try {
            const dbPartida = await partidaRepo.criar(updatedRoom.dbSalaId, updatedRoom.placarHost, updatedRoom.placarVisitante);
            updatedRoom.dbPartidaId = dbPartida.id;
        } catch (err) {
            console.error('Erro ao registrar nova partida no JSON:', err);
        }

        // Notifica e reinicia o jogo
        broadcastBoardUpdate(updatedRoom);
        startRoomTurnTimer(salaCodigo);

        roomManager.broadcastToRoom(salaCodigo, {
            type: 'CHAT_MESSAGE',
            payload: {
                sender: 'SISTEMA',
                text: '🔄 Revanche aceita! Os símbolos foram invertidos. Boa sorte!',
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
        });
    } else {
        // Solicitação inicial de revanche
        roomManager.broadcastToRoom(salaCodigo, {
            type: 'REMATCH_REQUESTED',
            payload: {
                sender: nickname,
                message: `[${nickname} solicitou uma revanche!]`
            }
        }, ws);
    }
}
