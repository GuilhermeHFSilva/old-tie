import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CpuEngine } from '../src/game/CpuEngine.js';
import { GAME_MODES } from '../src/game/GameEngine.js';

describe('CpuEngine - Inteligência Artificial para Modo Solo', () => {
    test('deve escolher movimento de vitória no 3x3 se disponível', () => {
        const board = ['O', 'O', null, 'X', 'X', null, null, null, null];
        const room = {
            mode: GAME_MODES.CLASSICO,
            board,
            currentTurn: 'O',
            playerPieces: null
        };

        const move = CpuEngine.getBestMove(room);
        assert.equal(move, 2); // 'O' na posição 2 completa 0,1,2 para vitória
    });

    test('deve bloquear vitória do oponente no 3x3 se iminente', () => {
        const board = ['X', 'X', null, 'O', null, null, null, null, null];
        const room = {
            mode: GAME_MODES.CLASSICO,
            board,
            currentTurn: 'O',
            playerPieces: null
        };

        const move = CpuEngine.getBestMove(room);
        assert.equal(move, 2); // Bloqueia 'X' na posição 2
    });

    test('deve respeitar regra do Alzaimer e não jogar na posição prestes a sumir', () => {
        const board = ['O', 'X', 'X', null, 'O', 'X', null, null, 'O'];
        const room = {
            mode: GAME_MODES.ALZAIMER,
            board,
            currentTurn: 'O',
            playerPieces: { 'O': [0, 4, 8], 'X': [1, 2, 5] }
        };

        const move = CpuEngine.getBestMove(room);
        assert.notEqual(move, 0); // Posição 0 é a peça 'O' mais antiga e não pode ser re-usada
    });

    test('deve sugerir coordenadas válidas no Grid Infinito', () => {
        const board = { '0,0': 'X', '1,0': 'X', '2,0': 'X', '3,0': 'X' };
        const room = {
            mode: GAME_MODES.INFINITO,
            board,
            currentTurn: 'O',
            playerPieces: null
        };

        const move = CpuEngine.getBestMove(room);
        assert.ok(typeof move.x === 'number' && typeof move.y === 'number');
        // Deve bloquear 'X' em (4,0) ou (-1,0)
        assert.ok((move.x === 4 && move.y === 0) || (move.x === -1 && move.y === 0));
    });
});
