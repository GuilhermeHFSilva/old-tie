/**
 * @file roomHandler.js
 * Manipulador de eventos de sala: criação, entrada, listagem, início e desconexão.
 */

import { roomManager } from '../../game/RoomManager.js';
import { GAME_MODES } from '../../game/GameEngine.js';
import { jogadorRepo } from '../../database/jogadorRepo.js';
import { salaRepo } from '../../database/salaRepo.js';
import { partidaRepo } from '../../database/partidaRepo.js';

export async function handleJoinRoom(ws, payload) {
    const { playerName, roomCode, gameMode, maxPlayers } = payload;

    if (!playerName || playerName.trim() === '') {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: 'Nome do jogador é obrigatório.'
        }));
    }

    const nameClean = playerName.trim();
    const codeClean = roomCode ? roomCode.trim().toUpperCase() : null;
    const selectedMode = Object.values(GAME_MODES).includes(gameMode) ? gameMode : GAME_MODES.CLASSICO;
    const selectedMaxPlayers = selectedMode === GAME_MODES.WARZONE ? Math.max(2, Math.min(Number(maxPlayers) || 4, 4)) : 2;

    try {
        let jogador = await jogadorRepo.buscarPorNickname(nameClean);
        if (!jogador) {
            jogador = await jogadorRepo.criar(nameClean);
        }

        if (!codeClean) {
            // Criar uma Nova Sala
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const dbSala = await salaRepo.criar(newCode, `Sala de ${nameClean}`, jogador.id, false, selectedMode, selectedMaxPlayers);
            const room = roomManager.createRoom(newCode, dbSala.nome, jogador.id, nameClean, ws, dbSala.id, selectedMode, selectedMaxPlayers);

            ws.send(JSON.stringify({
                type: 'ROOM_CREATED',
                payload: {
                    roomCode: newCode,
                    roomName: dbSala.nome,
                    playerSymbol: 'X',
                    playerName: nameClean,
                    mode: room.mode,
                    maxPlayers: room.maxPlayers,
                    status: 'AGUARDANDO',
                    players: room.players.map(p => ({
                        nickname: p.nickname,
                        simbolo: p.simbolo,
                        isHost: p.isHost,
                        score: p.score
                    }))
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

            const { room: activeRoom, player: joinedPlayer, gameStarted } = result;

            if (activeRoom.players.length === 2 && !result.reconnected) {
                await salaRepo.atualizarVisitante(activeRoom.dbSalaId, jogador.id);
            }

            // Confirmação para o jogador que acabou de entrar
            ws.send(JSON.stringify({
                type: 'ROOM_JOINED',
                payload: {
                    roomCode: activeRoom.codigo,
                    roomName: activeRoom.nome,
                    playerSymbol: joinedPlayer.simbolo,
                    playerName: nameClean,
                    mode: activeRoom.mode,
                    maxPlayers: activeRoom.maxPlayers,
                    status: activeRoom.status
                }
            }));

            if (gameStarted) {
                if (!activeRoom.dbPartidaId) {
                    const dbPartida = await partidaRepo.criar(activeRoom.dbSalaId, activeRoom.placarHost, activeRoom.placarVisitante);
                    activeRoom.dbPartidaId = dbPartida.id;
                }

                broadcastBoardUpdate(activeRoom);
                startRoomTurnTimer(activeRoom.codigo);

                roomManager.broadcastToRoom(activeRoom.codigo, {
                    type: 'CHAT_MESSAGE',
                    payload: {
                        sender: 'SISTEMA',
                        text: `🎮 A partida começou! Modo: ${activeRoom.mode}. Boa sorte a todos!`,
                        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    }
                });
            } else {
                // Notifica que o jogador entrou e atualiza a contagem no lobby da sala
                const activeCount = activeRoom.players.filter(p => p.isConnected).length;
                broadcastBoardUpdate(activeRoom);
                roomManager.broadcastToRoom(activeRoom.codigo, {
                    type: 'CHAT_MESSAGE',
                    payload: {
                        sender: 'SISTEMA',
                        text: `👋 ${nameClean} entrou na sala! (${activeCount}/${activeRoom.maxPlayers} jogadores)`,
                        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    }
                });
            }
        }
    } catch (err) {
        console.error('Erro em handleJoinRoom:', err);
        ws.send(JSON.stringify({ type: 'INVALID_MOVE', message: 'Erro interno no servidor.' }));
    }
}

export async function handleStartGame(ws) {
    const playerInfo = roomManager.getPlayerInfo(ws);
    if (!playerInfo) return;

    const { salaCodigo } = playerInfo;
    const result = roomManager.startGame(salaCodigo, ws);

    if (result.error) {
        return ws.send(JSON.stringify({
            type: 'INVALID_MOVE',
            message: result.error
        }));
    }

    const { room: activeRoom } = result;

    if (!activeRoom.dbPartidaId) {
        const dbPartida = await partidaRepo.criar(activeRoom.dbSalaId, activeRoom.placarHost, activeRoom.placarVisitante);
        activeRoom.dbPartidaId = dbPartida.id;
    }

    broadcastBoardUpdate(activeRoom);
    startRoomTurnTimer(activeRoom.codigo);

    roomManager.broadcastToRoom(activeRoom.codigo, {
        type: 'CHAT_MESSAGE',
        payload: {
            sender: 'SISTEMA',
            text: `🚀 O anfitrião iniciou a batalha no modo ${activeRoom.mode}!`,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
    });
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

    const { salaCodigo, nickname, simbolo } = playerInfo;
    const res = roomManager.removePlayer(ws);

    if (!res) return;

    if (res.roomUpdated) {
        const room = res.room;
        roomManager.broadcastToRoom(salaCodigo, {
            type: 'PLAYER_DISCONNECTED',
            payload: {
                message: `[${nickname} (${simbolo}) desconectou]`,
                nickname,
                simbolo
            }
        });

        // Se a partida estiver em andamento, atualiza turno e placa
        if (room.status === 'EM_JOGO') {
            broadcastBoardUpdate(room);

            // Se restar apenas 1 jogador ativo, inicia tolerância de 30s para vitória por W.O.
            const connectedPlayers = room.players.filter(p => p.isConnected);
            if (connectedPlayers.length === 1) {
                if (room.disconnectTimeout) clearTimeout(room.disconnectTimeout);
                room.disconnectTimeout = setTimeout(async () => {
                    if (room && room.status === 'EM_JOGO') {
                        const remainingPlayer = room.players.find(p => p.isConnected);
                        if (remainingPlayer) {
                            room.status = 'FINALIZADA';
                            remainingPlayer.score += 1;
                            roomManager.broadcastToRoom(salaCodigo, {
                                type: 'GAME_OVER',
                                payload: {
                                    mode: room.mode,
                                    winner: remainingPlayer.nickname,
                                    winnerSymbol: remainingPlayer.simbolo,
                                    isDraw: false,
                                    isWO: true,
                                    message: `[Vitória por W.O. — Demais jogadores desconectaram]`,
                                    players: room.players.map(p => ({
                                        nickname: p.nickname,
                                        simbolo: p.simbolo,
                                        score: p.score
                                    }))
                                }
                            });
                        }
                    }
                }, 30000);
                if (room.disconnectTimeout && typeof room.disconnectTimeout.unref === 'function') {
                    room.disconnectTimeout.unref();
                }
            }
        }
    }
}

export function broadcastBoardUpdate(room) {
    const alzaimerState = roomManager.getAlzaimerState(room);

    roomManager.broadcastToRoom(room.codigo, {
        type: 'BOARD_UPDATE',
        payload: {
            roomCode: room.codigo,
            mode: room.mode,
            maxPlayers: room.maxPlayers,
            status: room.status,
            board: room.board,
            nextTurn: room.currentTurn,
            turnOrder: room.turnOrder,
            players: room.players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                simbolo: p.simbolo,
                isConnected: p.isConnected,
                isHost: p.isHost,
                score: p.score
            })),
            alzaimer: alzaimerState,
            timer: room.turnTimeRemaining,
            // Campos de compatibilidade legada
            hostName: room.players[0] ? room.players[0].nickname : '',
            hostSymbol: room.players[0] ? room.players[0].simbolo : 'X',
            visitanteName: room.players[1] ? room.players[1].nickname : '',
            visitanteSymbol: room.players[1] ? room.players[1].simbolo : 'O',
            placarHost: room.players[0] ? room.players[0].score : 0,
            placarVisitante: room.players[1] ? room.players[1].score : 0
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
