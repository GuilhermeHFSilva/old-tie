import { GameEngine } from './GameEngine.js';

class RoomManager {
    constructor() {
        // Map<codigoSala, RoomState>
        this.rooms = new Map();
        // Map<wsSocket, { salaCodigo, jogadorId, nickname, simbolo, isHost }>
        this.socketToPlayer = new Map();
    }

    createRoom(codigo, nome, hostId, hostNickname, ws, dbSalaId) {
        const room = {
            dbSalaId,
            codigo,
            nome,
            status: 'AGUARDANDO',
            host: { id: hostId, nickname: hostNickname, simbolo: 'X', ws, isConnected: true },
            visitante: null,
            board: GameEngine.createEmptyBoard(),
            currentTurn: 'X', // 'X' (Host) começa por padrão
            placarHost: 0,
            placarVisitante: 0,
            turnTimeRemaining: 15,
            turnInterval: null,
            disconnectTimeout: null,
            dbPartidaId: null,
            rematchVotes: new Set()
        };

        this.rooms.set(codigo, room);
        this.socketToPlayer.set(ws, { salaCodigo: codigo, jogadorId: hostId, nickname: hostNickname, simbolo: 'X', isHost: true });
        return room;
    }

    getRoom(codigo) {
        return this.rooms.get(codigo);
    }

    getPlayerInfo(ws) {
        return this.socketToPlayer.get(ws);
    }

    joinRoom(codigo, visitanteId, visitanteNickname, ws) {
        const room = this.rooms.get(codigo);
        if (!room) return { error: 'Sala não encontrada.' };
        if (room.visitante && room.visitante.isConnected) {
            return { error: `[Erro: A sala ${codigo} já possui 2 participantes ativos]` };
        }

        // Se o visitante está se reconectando ou entrando pela 1ª vez
        const player = { id: visitanteId, nickname: visitanteNickname, simbolo: 'O', ws, isConnected: true };
        room.visitante = player;
        room.status = 'EM_JOGO';

        this.socketToPlayer.set(ws, { salaCodigo: codigo, jogadorId: visitanteId, nickname: visitanteNickname, simbolo: 'O', isHost: false });
        return { room, player };
    }

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
                // Alterna a vez por estouro do cronômetro (Timeout Turn)
                room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
                if (onTimeoutCallback) onTimeoutCallback(room);
            }
        }, 1000);
    }

    stopTurnTimer(codigo) {
        const room = this.rooms.get(codigo);
        if (room && room.turnInterval) {
            clearInterval(room.turnInterval);
            room.turnInterval = null;
        }
    }

    resetMatch(codigo) {
        const room = this.rooms.get(codigo);
        if (!room) return null;

        room.board = GameEngine.createEmptyBoard();
        // Inverte os símbolos iniciais conforme RF-07
        const tempSimbolo = room.host.simbolo;
        room.host.simbolo = room.visitante.simbolo;
        room.visitante.simbolo = tempSimbolo;

        // Atualiza referências dos sockets
        if (room.host.ws) {
            const hInfo = this.socketToPlayer.get(room.host.ws);
            if (hInfo) hInfo.simbolo = room.host.simbolo;
        }
        if (room.visitante.ws) {
            const vInfo = this.socketToPlayer.get(room.visitante.ws);
            if (vInfo) vInfo.simbolo = room.visitante.simbolo;
        }

        // 'X' sempre começa após a inversão
        room.currentTurn = 'X';
        room.status = 'EM_JOGO';
        room.rematchVotes.clear();
        return room;
    }

    removePlayer(ws) {
        const info = this.socketToPlayer.get(ws);
        if (!info) return null;

        const { salaCodigo, isHost } = info;
        const room = this.rooms.get(salaCodigo);
        this.socketToPlayer.delete(ws);

        if (room) {
            if (isHost && room.host) {
                room.host.isConnected = false;
            } else if (!isHost && room.visitante) {
                room.visitante.isConnected = false;
            }

            const activePlayersCount = (room.host && room.host.isConnected ? 1 : 0) + 
                                       (room.visitante && room.visitante.isConnected ? 1 : 0);

            if (activePlayersCount === 0) {
                this.stopTurnTimer(salaCodigo);
                this.rooms.delete(salaCodigo);
                return { roomDeleted: true, salaCodigo, dbSalaId: room.dbSalaId };
            } else {
                return { roomUpdated: true, room, disconnectedPlayer: info };
            }
        }
        return null;
    }

    broadcastToRoom(codigo, messageObj, excludeWs = null) {
        const room = this.rooms.get(codigo);
        if (!room) return;

        const data = JSON.stringify(messageObj);

        if (room.host && room.host.ws && room.host.ws !== excludeWs && room.host.ws.readyState === 1) {
            room.host.ws.send(data);
        }
        if (room.visitante && room.visitante.ws && room.visitante.ws !== excludeWs && room.visitante.ws.readyState === 1) {
            room.visitante.ws.send(data);
        }
    }
}

export const roomManager = new RoomManager();
