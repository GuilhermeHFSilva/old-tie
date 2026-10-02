import { roomManager } from '../../game/RoomManager.js';
import { GameEngine } from '../../game/GameEngine.js';
import { jogadaRepo } from '../../database/jogadaRepo.js';
import { partidaRepo } from '../../database/partidaRepo.js';
import { broadcastBoardUpdate, startRoomTurnTimer } from './roomHandler.js';

export async function handleMove(ws, payload) {
    const { roomCode, position, playerSymbol } = payload;
    const playerInfo = roomManager.getPlayerInfo(ws);

    if (!playerInfo) {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: 'Você não está conectado a nenhuma sala ativa.'
        }));
    }

    const room = roomManager.getRoom(roomCode ? roomCode.toUpperCase() : playerInfo.salaCodigo);

    if (!room || room.status !== 'EM_JOGO') {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: 'A partida não está em andamento.'
        }));
    }

    // RF-02 & RF-03: Validação Estrita 100% Server-Side
    const validation = GameEngine.validateMove(room.board, position, room.currentTurn, playerSymbol || playerInfo.simbolo);
    if (!validation.valid) {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: validation.reason
        }));
    }

    // Aplica o movimento na matriz 3x3 em memória
    const symbolToUse = playerSymbol || playerInfo.simbolo;
    room.board = GameEngine.applyMove(room.board, position, symbolToUse);

    // Persiste a jogada no JSON
    if (room.dbPartidaId) {
        try {
            await jogadaRepo.registrar(room.dbPartidaId, playerInfo.jogadorId, position, symbolToUse);
        } catch (err) {
            console.error('Erro ao salvar jogada no JSON:', err);
        }
    }

    // RF-05: Avalia as 8 linhas de vitória ou empate
    const result = GameEngine.checkResult(room.board);

    if (result.isOver) {
        roomManager.stopTurnTimer(room.codigo);
        room.status = 'FINALIZADA';

        let winnerName = null;
        let winnerSymbol = result.winnerSymbol;

        if (result.winnerSymbol) {
            if (room.host.simbolo === result.winnerSymbol) {
                winnerName = room.host.nickname;
                room.placarHost += 1;
            } else if (room.visitante && room.visitante.simbolo === result.winnerSymbol) {
                winnerName = room.visitante.nickname;
                room.placarVisitante += 1;
            }
        }

        // Atualiza resultado da partida no JSON
        if (room.dbPartidaId) {
            try {
                let statusRes = 'EMPATE';
                if (result.winnerSymbol) {
                    statusRes = (room.host.simbolo === result.winnerSymbol) ? 'VITORIA_HOST' : 'VITORIA_VISITANTE';
                }
                await partidaRepo.finalizar(room.dbPartidaId, winnerName, statusRes, room.placarHost, room.placarVisitante);
            } catch (err) {
                console.error('Erro ao finalizar partida no JSON:', err);
            }
        }

        // Emitir evento GAME_OVER para ambos os clientes (RF-05)
        roomManager.broadcastToRoom(room.codigo, {
            type: 'GAME_OVER',
            payload: {
                board: room.board,
                winner: winnerName,
                winnerSymbol: winnerSymbol,
                winningLine: result.winningLine,
                isDraw: result.isDraw,
                placarHost: room.placarHost,
                placarVisitante: room.placarVisitante,
                hostName: room.host ? room.host.nickname : '',
                visitanteName: room.visitante ? room.visitante.nickname : ''
            }
        });
    } else {
        // Alterna o turno (RF-04) e reinicia o cronômetro de 15 segundos
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        broadcastBoardUpdate(room);
        startRoomTurnTimer(room.codigo);
    }
}
