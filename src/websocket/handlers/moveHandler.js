/**
 * @file moveHandler.js
 * Processa jogadas com validação 100% server-side para todos os modos:
 * Clássico, Infinito, Alzaimer e War Zone.
 */

import { roomManager } from '../../game/RoomManager.js';
import { GameEngine, GAME_MODES } from '../../game/GameEngine.js';
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

    const symbolToUse = playerSymbol || playerInfo.simbolo;

    // Validação Estrita 100% Server-Side
    const validation = GameEngine.validateMove({
        mode: room.mode,
        board: room.board,
        position,
        currentTurn: room.currentTurn,
        expectedSymbol: symbolToUse,
        playerPieces: room.playerPieces
    });

    if (!validation.valid) {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: validation.reason
        }));
    }

    // Aplica o movimento conforme o modo
    const moveResult = GameEngine.applyMove({
        mode: room.mode,
        board: room.board,
        position,
        symbol: symbolToUse,
        playerPieces: room.playerPieces
    });

    if (room.mode === GAME_MODES.ALZAIMER) {
        room.board = moveResult.board;
        room.playerPieces = moveResult.playerPieces;
    } else if (room.mode === GAME_MODES.INFINITO || room.mode === GAME_MODES.WARZONE) {
        room.board = moveResult.board;
        room.lastMove = moveResult.lastMove;
    } else {
        room.board = moveResult;
    }

    // Persiste a jogada no JSON
    if (room.dbPartidaId) {
        try {
            const posFormatted = typeof position === 'object' ? `${position.x},${position.y}` : position;
            await jogadaRepo.registrar(room.dbPartidaId, playerInfo.jogadorId, posFormatted, symbolToUse);
        } catch (err) {
            console.error('Erro ao salvar jogada no JSON:', err);
        }
    }

    // Avalia o resultado (vitória ou empate)
    const result = GameEngine.checkResult({
        mode: room.mode,
        board: room.board,
        lastMove: room.lastMove
    });

    if (result.isOver) {
        roomManager.stopTurnTimer(room.codigo);
        room.status = 'FINALIZADA';

        let winnerName = null;
        const winnerSymbol = result.winnerSymbol;

        if (winnerSymbol) {
            const winnerPlayer = room.players.find(p => p.simbolo === winnerSymbol);
            if (winnerPlayer) {
                winnerPlayer.score += 1;
                winnerName = winnerPlayer.nickname;
            }
        }

        // Atualiza resultado da partida no JSON
        if (room.dbPartidaId) {
            try {
                let statusRes = 'EMPATE';
                if (winnerSymbol) {
                    statusRes = `VITORIA_${winnerSymbol}`;
                }
                await partidaRepo.finalizar(room.dbPartidaId, winnerName, statusRes, room.placarHost, room.placarVisitante);
            } catch (err) {
                console.error('Erro ao finalizar partida no JSON:', err);
            }
        }

        // Emite GAME_OVER para todos na sala
        roomManager.broadcastToRoom(room.codigo, {
            type: 'GAME_OVER',
            payload: {
                mode: room.mode,
                board: room.board,
                winner: winnerName,
                winnerSymbol,
                winningLine: result.winningLine,
                isDraw: result.isDraw,
                players: room.players.map(p => ({
                    nickname: p.nickname,
                    simbolo: p.simbolo,
                    score: p.score
                })),
                placarHost: room.players[0]?.score || 0,
                placarVisitante: room.players[1]?.score || 0,
                hostName: room.players[0] ? room.players[0].nickname : '',
                visitanteName: room.players[1] ? room.players[1].nickname : ''
            }
        });
    } else {
        // Alterna o turno e reinicia o cronômetro de 15 segundos
        roomManager.advanceTurn(room);
        broadcastBoardUpdate(room);
        startRoomTurnTimer(room.codigo);
    }
}
