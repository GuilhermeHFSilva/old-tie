import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { roomManager } from '../src/game/RoomManager.js';
import { GAME_MODES } from '../src/game/GameEngine.js';

describe('RoomManager - Modos de Jogo e Multijogador', () => {
    test('deve criar e configurar sala no modo Alzaimer', () => {
        const dummyWs1 = { readyState: 1, send: () => {} };
        const room = roomManager.createRoom('TEST01', 'Sala Alzaimer', 10, 'Player1', dummyWs1, 100, GAME_MODES.ALZAIMER, 2);

        assert.equal(room.mode, GAME_MODES.ALZAIMER);
        assert.equal(room.players.length, 1);
        assert.equal(room.currentTurn, 'X');
        assert.deepEqual(room.playerPieces, { X: [] });

        const dummyWs2 = { readyState: 1, send: () => {} };
        const joinRes = roomManager.joinRoom('TEST01', 20, 'Player2', dummyWs2);
        assert.equal(joinRes.gameStarted, true);
        assert.equal(room.status, 'EM_JOGO');
        assert.equal(room.players.length, 2);
        assert.equal(room.players[1].simbolo, 'O');

        const alzaimerState = roomManager.getAlzaimerState(room);
        assert.ok(alzaimerState);
        assert.equal(alzaimerState.fadingPosition, null);

        roomManager.removePlayer(dummyWs1);
        roomManager.removePlayer(dummyWs2);
    });

    test('deve suportar até 4 jogadores no modo War Zone', () => {
        const ws1 = { readyState: 1, send: () => {} };
        const room = roomManager.createRoom('WAR001', 'Sala War', 1, 'P1', ws1, 101, GAME_MODES.WARZONE, 4);

        assert.equal(room.mode, GAME_MODES.WARZONE);
        assert.equal(room.maxPlayers, 4);
        assert.equal(room.status, 'AGUARDANDO');

        const ws2 = { readyState: 1, send: () => {} };
        const j2 = roomManager.joinRoom('WAR001', 2, 'P2', ws2);
        assert.equal(j2.gameStarted, false);
        assert.equal(j2.player.simbolo, 'O');

        const ws3 = { readyState: 1, send: () => {} };
        const j3 = roomManager.joinRoom('WAR001', 3, 'P3', ws3);
        assert.equal(j3.gameStarted, false);
        assert.equal(j3.player.simbolo, '△');

        const ws4 = { readyState: 1, send: () => {} };
        const j4 = roomManager.joinRoom('WAR001', 4, 'P4', ws4);
        assert.equal(j4.gameStarted, true); // atingiu capacidade máxima 4
        assert.equal(j4.player.simbolo, '☆');
        assert.equal(room.status, 'EM_JOGO');

        // Testar avanço de turnos
        assert.equal(room.currentTurn, 'X');
        assert.equal(roomManager.advanceTurn(room), 'O');
        assert.equal(roomManager.advanceTurn(room), '△');
        assert.equal(roomManager.advanceTurn(room), '☆');
        assert.equal(roomManager.advanceTurn(room), 'X');

        roomManager.removePlayer(ws1);
        roomManager.removePlayer(ws2);
        roomManager.removePlayer(ws3);
        roomManager.removePlayer(ws4);
    });

    test('anfitrião pode iniciar partida no War Zone com 2 ou 3 jogadores', () => {
        const ws1 = { readyState: 1, send: () => {} };
        const room = roomManager.createRoom('WAR002', 'Sala War Early', 1, 'Host', ws1, 102, GAME_MODES.WARZONE, 4);

        const ws2 = { readyState: 1, send: () => {} };
        roomManager.joinRoom('WAR002', 2, 'Guest', ws2);

        assert.equal(room.status, 'AGUARDANDO');

        const startRes = roomManager.startGame('WAR002', ws1);
        assert.equal(startRes.success, true);
        assert.equal(room.status, 'EM_JOGO');

        roomManager.removePlayer(ws1);
        roomManager.removePlayer(ws2);
    });
});
