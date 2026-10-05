/**
 * @file matchHandler.js
 * Gerenciador de revanche e reinício de partida para todos os modos.
 */

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

    const activePlayers = room.players.filter(p => p.isConnected);
    const requiredVotes = activePlayers.length <= 2 ? activePlayers.length : Math.ceil(activePlayers.length / 2);

    if (room.rematchVotes.size >= requiredVotes) {
        // Revanche aceita - reseta o tabuleiro mantendo a pontuação e os jogadores
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
                text: '🔄 Revanche aceita! O tabuleiro foi resetado. Boa sorte!',
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            }
        });
    } else {
        // Solicitação inicial de revanche
        roomManager.broadcastToRoom(salaCodigo, {
            type: 'REMATCH_REQUESTED',
            payload: {
                sender: nickname,
                message: `[${nickname} solicitou uma revanche! (${room.rematchVotes.size}/${requiredVotes})]`
            }
        }, ws);
    }
}
