import { roomManager } from '../../game/RoomManager.js';
import { jogadorRepo } from '../../database/jogadorRepo.js';
import { salaRepo } from '../../database/salaRepo.js';
import { partidaRepo } from '../../database/partidaRepo.js';

export async function handleJoinRoom(ws, payload) {
    const { playerName, roomCode } = payload;

    if (!playerName || playerName.trim() === '') {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: 'Nome do jogador é obrigatório.'
        }));
    }

    const nameClean = playerName.trim();
    const codeClean = roomCode ? roomCode.trim().toUpperCase() : null;

    try {
        let jogador = await jogadorRepo.buscarPorNickname(nameClean);
        if (!jogador) {
            jogador = await jogadorRepo.criar(nameClean);
        }

        if (!codeClean) {
            // Criar uma Nova Sala
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const dbSala = await salaRepo.criar(newCode, `Sala de ${nameClean}`, jogador.id);
            const room = roomManager.createRoom(newCode, dbSala.nome, jogador.id, nameClean, ws, dbSala.id);

            ws.send(JSON.stringify({
                type: 'ROOM_CREATED',
                payload: {
                    roomCode: newCode,
                    roomName: dbSala.nome,
                    playerSymbol: 'X',
                    playerName: nameClean,
                    status: 'AGUARDANDO'
                }
            }));
        } else {
            // Entrar em uma Sala Existente
            const room = roomManager.getRoom(codeClean);
            if (!room) {
                return ws.send(JSON.stringify({
                    type: 'INVALID_MOVE',
                    message: `[Sala não encontrada. Verifique o código ${codeClean} e tente novamente]`
                }));
            }

            const result = roomManager.joinRoom(codeClean, jogador.id, nameClean, ws);
            if (result.error) {
                return ws.send(JSON.stringify({
                    type: 'INVALID_MOVE',
                    message: result.error
                }));
            }

            const { room: activeRoom } = result;

            await salaRepo.atualizarVisitante(activeRoom.dbSalaId, jogador.id);

            const dbPartida = await partidaRepo.criar(activeRoom.dbSalaId, activeRoom.placarHost, activeRoom.placarVisitante);
            activeRoom.dbPartidaId = dbPartida.id;

            // Transmite início do jogo e inicia o cronômetro de 15 segundos
            broadcastBoardUpdate(activeRoom);
            startRoomTurnTimer(activeRoom.codigo);
        }
    } catch (err) {
        console.error('Erro em handleJoinRoom:', err);
        ws.send(JSON.stringify({ type: 'INVALID_MOVE', message: 'Erro interno no servidor.' }));
    }
}

export async function handleListRooms(ws) {
    try {
        const salas = await salaRepo.listarAtivas();
        ws.send(JSON.stringify({
            type: 'ROOM_LIST',
            payload: { salas }
        }));
    } catch (err) {
        console.error('Erro em handleListRooms:', err);
    }
}

export function handleDisconnect(ws) {
    const playerInfo = roomManager.getPlayerInfo(ws);
    if (!playerInfo) return;

    const { salaCodigo, nickname } = playerInfo;
    const res = roomManager.removePlayer(ws);

    if (!res) return;

    if (res.roomUpdated) {
        const room = res.room;
        roomManager.broadcastToRoom(salaCodigo, {
            type: 'PLAYER_DISCONNECTED',
            payload: {
                message: `[Oponente desconectou — Aguardando reconexão (30s)...]`,
                nickname
            }
        });

        // Inicia tolerância de 30 segundos antes do W.O.
        if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
        room.disconnectTimeout = setTimeout(async () => {
            if (room && room.status === 'EM_JOGO') {
                const remainingPlayer = room.host && room.host.isConnected ? room.host : room.visitante;
                if (remainingPlayer) {
                    room.status = 'FINALIZADA';
                    roomManager.broadcastToRoom(salaCodigo, {
                        type: 'GAME_OVER',
                        payload: {
                            winner: remainingPlayer.nickname,
                            winnerSymbol: remainingPlayer.simbolo,
                            isDraw: false,
                            isWO: true,
                            message: `[Oponente desconectou — Vitória por W.O.]`
                        }
                    });
                }
            }
        }, 30000);
    }
}

export function broadcastBoardUpdate(room) {
    roomManager.broadcastToRoom(room.codigo, {
        type: 'BOARD_UPDATE',
        payload: {
            roomCode: room.codigo,
            board: room.board,
            nextTurn: room.currentTurn,
            hostName: room.host ? room.host.nickname : '',
            hostSymbol: room.host ? room.host.simbolo : 'X',
            visitanteName: room.visitante ? room.visitante.nickname : '',
            visitanteSymbol: room.visitante ? room.visitante.simbolo : 'O',
            placarHost: room.placarHost,
            placarVisitante: room.placarVisitante,
            timer: room.turnTimeRemaining
        }
    });
}

export function startRoomTurnTimer(codigo) {
    roomManager.startTurnTimer(codigo, (updatedRoom) => {
        // Callback quando estoura 15s (Timeout Turn)
        broadcastBoardUpdate(updatedRoom);
        startRoomTurnTimer(codigo);
    });
}
