/**
 * @file RoomManager.js
 * Gerenciador de salas ativas e controle de estado em memória para todos os modos de jogo:
 * Clássico, Infinito, Alzaimer e War Zone.
 */

import { GameEngine, GAME_MODES, WARZONE_SYMBOLS } from './GameEngine.js';

class RoomManager {
    constructor() {
        /** @type {Map<string, object>} Map<codigoSala, RoomState> */
        this.rooms = new Map();
        /** @type {Map<WebSocket, object>} Map<wsSocket, { salaCodigo, jogadorId, nickname, simbolo, isHost }> */
        this.socketToPlayer = new Map();
    }

    /**
     * Cria uma nova sala com suporte a múltiplos modos e número de participantes.
     */
    createRoom(codigo, nome, hostId, hostNickname, ws, dbSalaId, mode = GAME_MODES.CLASSICO, maxPlayers = 2) {
        const validatedMode = Object.values(GAME_MODES).includes(mode) ? mode : GAME_MODES.CLASSICO;
        const validatedMaxPlayers = validatedMode === GAME_MODES.WARZONE ? Math.max(2, Math.min(Number(maxPlayers) || 4, 4)) : 2;

        const hostPlayer = {
            id: hostId,
            nickname: hostNickname,
            simbolo: 'X',
            ws,
            isConnected: true,
            isHost: true,
            score: 0
        };

        const room = {
            dbSalaId,
            codigo,
            nome,
            mode: validatedMode,
            maxPlayers: validatedMaxPlayers,
            status: 'AGUARDANDO', // AGUARDANDO, EM_JOGO, FINALIZADA
            players: [hostPlayer],
            board: GameEngine.createEmptyBoard(validatedMode),
            currentTurn: 'X',
            turnOrder: ['X'],
            playerPieces: { 'X': [] },
            turnTimeRemaining: 15,
            turnInterval: null,
            disconnectTimeout: null,
            dbPartidaId: null,
            rematchVotes: new Set(),
            lastMove: null
        };

        // Getters para compatibilidade legada
        Object.defineProperty(room, 'host', {
            get: () => room.players[0] || null,
            set: (val) => { if (room.players.length > 0) room.players[0] = val; }
        });
        Object.defineProperty(room, 'visitante', {
            get: () => room.players[1] || null,
            set: (val) => {
                if (val) {
                    if (room.players.length > 1) room.players[1] = val;
                    else room.players.push(val);
                }
            }
        });
        Object.defineProperty(room, 'placarHost', {
            get: () => room.players[0]?.score || 0,
            set: (val) => { if (room.players[0]) room.players[0].score = val; }
        });
        Object.defineProperty(room, 'placarVisitante', {
            get: () => room.players[1]?.score || 0,
            set: (val) => { if (room.players[1]) room.players[1].score = val; }
        });

        this.rooms.set(codigo, room);
        this.socketToPlayer.set(ws, {
            salaCodigo: codigo,
            jogadorId: hostId,
            nickname: hostNickname,
            simbolo: 'X',
            isHost: true
        });

        return room;
    }

    getRoom(codigo) {
        return this.rooms.get(codigo);
    }

    getPlayerInfo(ws) {
        return this.socketToPlayer.get(ws);
    }

    /**
     * Adiciona ou reconecta um jogador a uma sala.
     */
    joinRoom(codigo, visitanteId, visitanteNickname, ws) {
        const room = this.rooms.get(codigo);
        if (!room) return { error: 'Sala não encontrada.' };

        // Verifica se o jogador já faz parte da sala (reconexão)
        const existingPlayer = room.players.find(p => p.id === visitanteId || p.nickname === visitanteNickname);
        if (existingPlayer) {
            existingPlayer.ws = ws;
            existingPlayer.isConnected = true;
            this.socketToPlayer.set(ws, {
                salaCodigo: codigo,
                jogadorId: existingPlayer.id,
                nickname: existingPlayer.nickname,
                simbolo: existingPlayer.simbolo,
                isHost: existingPlayer.isHost
            });
            return { room, player: existingPlayer, reconnected: true, gameStarted: room.status === 'EM_JOGO' };
        }

        const activeCount = room.players.filter(p => p.isConnected).length;
        if (activeCount >= room.maxPlayers) {
            return { error: `[Erro: A sala ${codigo} já atingiu a capacidade máxima de ${room.maxPlayers} jogadores]` };
        }

        // Determina o símbolo para o novo jogador
        const usedSymbols = new Set(room.players.map(p => p.simbolo));
        let nextSymbol = 'O';

        if (room.mode === GAME_MODES.WARZONE) {
            nextSymbol = WARZONE_SYMBOLS.find(s => !usedSymbols.has(s)) || 'O';
        } else {
            nextSymbol = usedSymbols.has('X') ? 'O' : 'X';
        }

        const newPlayer = {
            id: visitanteId,
            nickname: visitanteNickname,
            simbolo: nextSymbol,
            ws,
            isConnected: true,
            isHost: false,
            score: 0
        };

        room.players.push(newPlayer);
        room.turnOrder.push(nextSymbol);

        if (room.mode === GAME_MODES.ALZAIMER) {
            room.playerPieces[nextSymbol] = [];
        }

        this.socketToPlayer.set(ws, {
            salaCodigo: codigo,
            jogadorId: visitanteId,
            nickname: visitanteNickname,
            simbolo: nextSymbol,
            isHost: false
        });

        // Modo de 2 jogadores inicia automaticamente ao atingir 2 jogadores
        // Modo War Zone inicia automaticamente ao atingir capacidade máxima
        let gameStarted = false;
        if (room.players.filter(p => p.isConnected).length >= room.maxPlayers) {
            room.status = 'EM_JOGO';
            gameStarted = true;
        }

        return { room, player: newPlayer, gameStarted };
    }

    /**
     * Inicia a partida manualmente (útil no modo War Zone quando há >= 2 jogadores e host decide iniciar).
     */
    startGame(codigo, requesterWs) {
        const room = this.rooms.get(codigo);
        if (!room) return { error: 'Sala não encontrada.' };

        const requester = this.socketToPlayer.get(requesterWs);
        if (!requester || !requester.isHost) {
            return { error: 'Apenas o anfitrião pode iniciar a partida.' };
        }

        const activePlayers = room.players.filter(p => p.isConnected);
        if (activePlayers.length < 2) {
            return { error: 'São necessários pelo menos 2 jogadores para iniciar a partida.' };
        }

        room.status = 'EM_JOGO';
        room.turnOrder = activePlayers.map(p => p.simbolo);
        room.currentTurn = room.turnOrder[0];

        return { room, success: true };
    }

    /**
     * Avança o turno para o próximo jogador conectado na ordem de turnos.
     */
    advanceTurn(room) {
        if (!room || room.turnOrder.length === 0) return;

        const currentIdx = room.turnOrder.indexOf(room.currentTurn);
        let nextIdx = (currentIdx + 1) % room.turnOrder.length;

        // Procura o próximo jogador ativo/conectado
        for (let i = 0; i < room.turnOrder.length; i++) {
            const candidateSymbol = room.turnOrder[nextIdx];
            const player = room.players.find(p => p.simbolo === candidateSymbol);
            if (player && player.isConnected) {
                room.currentTurn = candidateSymbol;
                return room.currentTurn;
            }
            nextIdx = (nextIdx + 1) % room.turnOrder.length;
        }

        return room.currentTurn;
    }

    /**
     * Inicia o cronômetro de 15 segundos do turno.
     */
    startTurnTimer(codigo, onTimeoutCallback) {
        const room = this.rooms.get(codigo);
        if (!room) return;

        this.stopTurnTimer(codigo);

        room.turnTimeRemaining = 15;
        room.turnInterval = setInterval(() => {
            if (!room || room.status !== 'EM_JOGO') {
                this.stopTurnTimer(codigo);
                return;
            }

            room.turnTimeRemaining -= 1;

            if (room.turnTimeRemaining <= 0) {
                this.stopTurnTimer(codigo);
                // Alterna a vez por estouro do cronômetro
                this.advanceTurn(room);
                if (onTimeoutCallback) onTimeoutCallback(room);
            }
        }, 1000);

        if (room.turnInterval && typeof room.turnInterval.unref === 'function') {
            room.turnInterval.unref();
        }
    }

    stopTurnTimer(codigo) {
        const room = this.rooms.get(codigo);
        if (room && room.turnInterval) {
            clearInterval(room.turnInterval);
            room.turnInterval = null;
        }
    }

    /**
     * Reinicia uma partida após revanche.
     */
    resetMatch(codigo) {
        const room = this.rooms.get(codigo);
        if (!room) return null;

        room.board = GameEngine.createEmptyBoard(room.mode);
        room.lastMove = null;

        if (room.mode === GAME_MODES.ALZAIMER) {
            room.playerPieces = {};
            room.players.forEach(p => {
                room.playerPieces[p.simbolo] = [];
            });
        }

        // Rotação de símbolos ou ordem
        if (room.players.length === 2) {
            const p1 = room.players[0];
            const p2 = room.players[1];
            const tempSimbolo = p1.simbolo;
            p1.simbolo = p2.simbolo;
            p2.simbolo = tempSimbolo;

            // Atualiza mapa de sockets
            if (p1.ws) {
                const info1 = this.socketToPlayer.get(p1.ws);
                if (info1) info1.simbolo = p1.simbolo;
            }
            if (p2.ws) {
                const info2 = this.socketToPlayer.get(p2.ws);
                if (info2) info2.simbolo = p2.simbolo;
            }

            room.turnOrder = [p1.simbolo, p2.simbolo];
            room.currentTurn = 'X';
        } else {
            // Rotaciona a ordem de turnos para o próximo começar
            if (room.turnOrder.length > 1) {
                room.turnOrder.push(room.turnOrder.shift());
            }
            room.currentTurn = room.turnOrder[0];
        }

        room.status = 'EM_JOGO';
        room.rematchVotes.clear();
        return room;
    }

    /**
     * Remove ou marca como desconectado um jogador associado ao socket.
     */
    removePlayer(ws) {
        const info = this.socketToPlayer.get(ws);
        if (!info) return null;

        const { salaCodigo, jogadorId, nickname } = info;
        const room = this.rooms.get(salaCodigo);
        this.socketToPlayer.delete(ws);

        if (!room) return null;

        const player = room.players.find(p => p.id === jogadorId || p.nickname === nickname);
        if (player) {
            player.isConnected = false;
        }

        const activePlayers = room.players.filter(p => p.isConnected);

        if (activePlayers.length === 0) {
            this.stopTurnTimer(salaCodigo);
            this.rooms.delete(salaCodigo);
            return { roomDeleted: true, salaCodigo, dbSalaId: room.dbSalaId };
        } else {
            // Se o jogador desconectado era a vez atual, avança o turno
            if (room.status === 'EM_JOGO' && room.currentTurn === info.simbolo) {
                this.advanceTurn(room);
            }
            return { roomUpdated: true, room, disconnectedPlayer: info, remainingCount: activePlayers.length };
        }
    }

    /**
     * Transmite mensagem JSON para todos os jogadores ativos da sala.
     */
    broadcastToRoom(codigo, messageObj, excludeWs = null) {
        const room = this.rooms.get(codigo);
        if (!room) return;

        const data = JSON.stringify(messageObj);

        for (const player of room.players) {
            if (player.ws && player.ws !== excludeWs && player.ws.readyState === 1) {
                player.ws.send(data);
            }
        }
    }

    /**
     * Retorna dados adicionais de estado para o modo Alzaimer.
     */
    getAlzaimerState(room) {
        if (room.mode !== GAME_MODES.ALZAIMER) return null;

        const currentTurnPieces = room.playerPieces[room.currentTurn] || [];
        const isFading = currentTurnPieces.length >= 3;
        const fadingPosition = isFading ? currentTurnPieces[0] : null;

        return {
            playerPieces: room.playerPieces,
            fadingPosition,
            fadingSymbol: isFading ? room.currentTurn : null
        };
    }
}

export const roomManager = new RoomManager();
