import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import app from '../src/app.js';
import { routeWebSocketMessage, handleWebSocketDisconnect } from '../src/websocket/router.js';

describe('WebSocket E2E - Modos de Jogo', () => {
    let server;
    let wss;
    let port;

    before(async () => {
        server = http.createServer(app);
        wss = new WebSocketServer({ server });
        wss.on('connection', (ws) => {
            ws.on('message', (msg) => routeWebSocketMessage(ws, msg.toString()));
            ws.on('close', () => handleWebSocketDisconnect(ws));
        });

        await new Promise((resolve) => {
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });
    });

    after(async () => {
        for (const ws of wss.clients) {
            ws.terminate();
        }
        wss.close();
        if (server.closeAllConnections) {
            server.closeAllConnections();
        }
        await new Promise((resolve) => server.close(resolve));
    });

    function createClient() {
        const client = new WebSocket(`ws://localhost:${port}`);
        const queue = [];
        const listeners = [];

        client.on('message', (raw) => {
            const data = JSON.parse(raw.toString());
            if (listeners.length > 0) {
                const cb = listeners.shift();
                cb(data);
            } else {
                queue.push(data);
            }
        });

        const waitForEvent = (expectedType) => {
            return new Promise((resolve) => {
                const checkQueue = () => {
                    const idx = queue.findIndex(msg => !expectedType || msg.type === expectedType);
                    if (idx !== -1) {
                        const msg = queue.splice(idx, 1)[0];
                        return resolve(msg);
                    }
                    listeners.push((msg) => {
                        if (!expectedType || msg.type === expectedType) {
                            resolve(msg);
                        } else {
                            queue.push(msg);
                            checkQueue();
                        }
                    });
                };
                checkQueue();
            });
        };

        const send = (type, payload = {}) => {
            client.send(JSON.stringify({ type, ...payload }));
        };

        const ready = () => new Promise(res => client.on('open', res));
        const close = () => client.close();

        return { client, ready, send, waitForEvent, close };
    }

    test('Partida completa no Modo Alzaimer com expiração da 1ª peça', async () => {
        const c1 = createClient();
        const c2 = createClient();
        await Promise.all([c1.ready(), c2.ready()]);

        // C1 cria sala Alzaimer
        c1.send('JOIN_ROOM', { playerName: 'Alice', gameMode: 'ALZAIMER' });
        const roomCreated = await c1.waitForEvent('ROOM_CREATED');
        const code = roomCreated.payload.roomCode;
        assert.equal(roomCreated.payload.mode, 'ALZAIMER');

        // C2 entra na sala
        c2.send('JOIN_ROOM', { playerName: 'Bob', roomCode: code });
        const c1Start = await c1.waitForEvent('BOARD_UPDATE');
        const c2Start = await c2.waitForEvent('BOARD_UPDATE');
        assert.equal(c1Start.payload.mode, 'ALZAIMER');
        assert.equal(c1Start.payload.nextTurn, 'X');

        // X joga 0 (Alice #1)
        c1.send('MOVE', { roomCode: code, position: 0, playerSymbol: 'X' });
        await c1.waitForEvent('BOARD_UPDATE');

        // O joga 1 (Bob #1)
        c2.send('MOVE', { roomCode: code, position: 1, playerSymbol: 'O' });
        await c1.waitForEvent('BOARD_UPDATE');

        // X joga 3 (Alice #2)
        c1.send('MOVE', { roomCode: code, position: 3, playerSymbol: 'X' });
        await c1.waitForEvent('BOARD_UPDATE');

        // O joga 2 (Bob #2)
        c2.send('MOVE', { roomCode: code, position: 2, playerSymbol: 'O' });
        await c1.waitForEvent('BOARD_UPDATE');

        // X joga 8 (Alice #3)
        c1.send('MOVE', { roomCode: code, position: 8, playerSymbol: 'X' });
        const updateAfterX3 = await c1.waitForEvent('BOARD_UPDATE');
        // Alice agora tem 3 peças: [0, 3, 8]
        assert.deepEqual(updateAfterX3.payload.alzaimer.playerPieces.X, [0, 3, 8]);

        // O joga 7 (Bob #3)
        c2.send('MOVE', { roomCode: code, position: 7, playerSymbol: 'O' });
        const updateBeforeX4 = await c1.waitForEvent('BOARD_UPDATE');
        // Agora é a vez de X de novo! Alice tem 3 peças, então a peça 0 está piscando/fading!
        assert.equal(updateBeforeX4.payload.nextTurn, 'X');
        assert.equal(updateBeforeX4.payload.alzaimer.fadingPosition, 0);

        // Alice tenta colocar no mesmo lugar da peça que vai ser removida (0) -> DEVE REJEITAR!
        c1.send('MOVE', { roomCode: code, position: 0, playerSymbol: 'X' });
        const invalidMove = await c1.waitForEvent('INVALID_MOVE');
        assert.match(invalidMove.message, /não pode colocar no mesmo lugar da peça que está sendo removida/i);

        // Alice joga no 6: peças eram [0, 3, 8]. 0 é removida, 6 entra -> [3, 8, 6]. 3, 6 são col 0.
        c1.send('MOVE', { roomCode: code, position: 6, playerSymbol: 'X' });
        const updateAfterX4 = await c1.waitForEvent('BOARD_UPDATE');
        assert.equal(updateAfterX4.payload.board[0], null); // 0 foi apagado!
        assert.equal(updateAfterX4.payload.board[6], 'X');   // 6 foi colocado!

        c1.close();
        c2.close();
        import('../src/game/RoomManager.js').then(({ roomManager }) => {
            roomManager.stopTurnTimer(code);
        });
    });

    test('Partida completa no Modo Infinito (Alinhar 5)', async () => {
        const c1 = createClient();
        const c2 = createClient();
        await Promise.all([c1.ready(), c2.ready()]);

        c1.send('JOIN_ROOM', { playerName: 'GamerX', gameMode: 'INFINITO' });
        const roomCreated = await c1.waitForEvent('ROOM_CREATED');
        const code = roomCreated.payload.roomCode;
        assert.equal(roomCreated.payload.mode, 'INFINITO');

        c2.send('JOIN_ROOM', { playerName: 'GamerO', roomCode: code });
        await c1.waitForEvent('BOARD_UPDATE');

        // Jogadas alternadas:
        // X: (0,0), (1,0), (2,0), (3,0), (4,0) -> Vence!
        // O: (0,1), (1,1), (2,1), (3,1)
        for (let i = 0; i < 4; i++) {
            c1.send('MOVE', { roomCode: code, position: { x: i, y: 0 }, playerSymbol: 'X' });
            await c1.waitForEvent('BOARD_UPDATE');
            c2.send('MOVE', { roomCode: code, position: { x: i, y: 1 }, playerSymbol: 'O' });
            await c1.waitForEvent('BOARD_UPDATE');
        }

        // 5º movimento de X em (4, 0)
        c1.send('MOVE', { roomCode: code, position: { x: 4, y: 0 }, playerSymbol: 'X' });
        const gameOver = await c1.waitForEvent('GAME_OVER');
        assert.equal(gameOver.payload.winner, 'GamerX');
        assert.equal(gameOver.payload.winnerSymbol, 'X');
        assert.equal(gameOver.payload.winningLine.length, 5);

        c1.close();
        c2.close();
        import('../src/game/RoomManager.js').then(({ roomManager }) => {
            roomManager.stopTurnTimer(code);
        });
    });

    test('Partida completa no Modo War Zone com 3 jogadores (X, O, △) e vitória de △', async () => {
        const c1 = createClient();
        const c2 = createClient();
        const c3 = createClient();
        await Promise.all([c1.ready(), c2.ready(), c3.ready()]);

        // C1 cria sala War Zone para 3 jogadores
        c1.send('JOIN_ROOM', { playerName: 'Alice', gameMode: 'WARZONE', maxPlayers: 3 });
        const roomCreated = await c1.waitForEvent('ROOM_CREATED');
        const code = roomCreated.payload.roomCode;
        assert.equal(roomCreated.payload.mode, 'WARZONE');
        assert.equal(roomCreated.payload.maxPlayers, 3);

        // C2 entra
        c2.send('JOIN_ROOM', { playerName: 'Bob', roomCode: code });
        await c1.waitForEvent('BOARD_UPDATE');

        // C3 entra -> Atinge 3/3 e inicia a partida!
        c3.send('JOIN_ROOM', { playerName: 'Carol', roomCode: code });
        const startUpdate = await c1.waitForEvent('BOARD_UPDATE');
        assert.equal(startUpdate.payload.status, 'EM_JOGO');
        assert.equal(startUpdate.payload.players.length, 3);
        assert.equal(startUpdate.payload.players[2].simbolo, '△');

        // Carol vai alinhar (0,0), (1,1), (2,2), (3,3), (4,4)
        // Alice joga em posições dispersas
        // Bob joga em posições dispersas
        const aliceMoves = [{ x: 10, y: 0 }, { x: 10, y: 2 }, { x: 10, y: 4 }, { x: 10, y: 6 }, { x: 10, y: 8 }];
        const bobMoves = [{ x: 20, y: 0 }, { x: 20, y: 2 }, { x: 20, y: 4 }, { x: 20, y: 6 }, { x: 20, y: 8 }];

        for (let i = 0; i < 4; i++) {
            // Turno de X (Alice)
            c1.send('MOVE', { roomCode: code, position: aliceMoves[i], playerSymbol: 'X' });
            await c1.waitForEvent('BOARD_UPDATE');

            // Turno de O (Bob)
            c2.send('MOVE', { roomCode: code, position: bobMoves[i], playerSymbol: 'O' });
            await c1.waitForEvent('BOARD_UPDATE');

            // Turno de △ (Carol)
            c3.send('MOVE', { roomCode: code, position: { x: i, y: i }, playerSymbol: '△' });
            await c1.waitForEvent('BOARD_UPDATE');
        }

        // Alice joga seu 5º movimento (disperso)
        c1.send('MOVE', { roomCode: code, position: aliceMoves[4], playerSymbol: 'X' });
        await c1.waitForEvent('BOARD_UPDATE');

        // Bob joga seu 5º movimento (disperso)
        c2.send('MOVE', { roomCode: code, position: bobMoves[4], playerSymbol: 'O' });
        await c1.waitForEvent('BOARD_UPDATE');

        // Carol joga seu 5º movimento em (4, 4) -> VENCE A GUERRA!
        c3.send('MOVE', { roomCode: code, position: { x: 4, y: 4 }, playerSymbol: '△' });
        const gameOver = await c3.waitForEvent('GAME_OVER');

        assert.equal(gameOver.payload.winner, 'Carol');
        assert.equal(gameOver.payload.winnerSymbol, '△');
        assert.equal(gameOver.payload.winningLine.length, 5);

        c1.close();
        c2.close();
        c3.close();
        import('../src/game/RoomManager.js').then(({ roomManager }) => {
            roomManager.stopTurnTimer(code);
        });
    });
});
