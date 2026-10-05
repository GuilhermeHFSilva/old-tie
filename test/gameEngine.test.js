import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, GAME_MODES } from '../src/game/GameEngine.js';

describe('GameEngine - Modo Clássico', () => {
    test('deve validar e aplicar movimentos corretamente no 3x3', () => {
        const board = GameEngine.createEmptyBoard(GAME_MODES.CLASSICO);
        assert.equal(board.length, 9);
        assert.ok(board.every(cell => cell === null));

        const val1 = GameEngine.validateMove(board, 0, 'X', 'X');
        assert.equal(val1.valid, true);

        const valWrongTurn = GameEngine.validateMove(board, 0, 'O', 'X');
        assert.equal(valWrongTurn.valid, false);

        const boardAfter0 = GameEngine.applyMove(board, 0, 'X');
        assert.equal(boardAfter0[0], 'X');

        const valOccupied = GameEngine.validateMove(boardAfter0, 0, 'O', 'O');
        assert.equal(valOccupied.valid, false);
    });

    test('deve detectar vitória horizontal no 3x3', () => {
        let board = GameEngine.createEmptyBoard(GAME_MODES.CLASSICO);
        board = GameEngine.applyMove(board, 0, 'X');
        board = GameEngine.applyMove(board, 3, 'O');
        board = GameEngine.applyMove(board, 1, 'X');
        board = GameEngine.applyMove(board, 4, 'O');
        board = GameEngine.applyMove(board, 2, 'X');

        const res = GameEngine.checkResult(board);
        assert.equal(res.isOver, true);
        assert.equal(res.winnerSymbol, 'X');
        assert.equal(res.isDraw, false);
        assert.deepEqual(res.winningLine, [0, 1, 2]);
    });

    test('deve detectar empate no 3x3', () => {
        // X O X
        // X X O
        // O X O
        const board = ['X', 'O', 'X', 'X', 'X', 'O', 'O', 'X', 'O'];
        const res = GameEngine.checkResult(board);
        assert.equal(res.isOver, true);
        assert.equal(res.isDraw, true);
        assert.equal(res.winnerSymbol, null);
    });
});

describe('GameEngine - Modo Alzaimer', () => {
    test('deve permitir colocar até 3 peças sem remover nenhuma', () => {
        let board = GameEngine.createEmptyBoard(GAME_MODES.ALZAIMER);
        let playerPieces = { X: [], O: [] };

        // X joga 0
        const move1 = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 0,
            symbol: 'X',
            playerPieces
        });
        board = move1.board;
        playerPieces = move1.playerPieces;
        assert.equal(move1.removedPosition, null);
        assert.deepEqual(playerPieces.X, [0]);

        // X joga 4
        const move2 = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 4,
            symbol: 'X',
            playerPieces
        });
        board = move2.board;
        playerPieces = move2.playerPieces;
        assert.equal(move2.removedPosition, null);
        assert.deepEqual(playerPieces.X, [0, 4]);

        // X joga 6
        const move3 = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 6,
            symbol: 'X',
            playerPieces
        });
        board = move3.board;
        playerPieces = move3.playerPieces;
        assert.equal(move3.removedPosition, null);
        assert.deepEqual(playerPieces.X, [0, 4, 6]);
    });

    test('quando X tem 3 peças, a 1ª é agendada para remoção e não pode ser jogada', () => {
        let board = GameEngine.createEmptyBoard(GAME_MODES.ALZAIMER);
        board[0] = 'X';
        board[4] = 'X';
        board[6] = 'X';
        const playerPieces = { X: [0, 4, 6], O: [] };

        // Tentar jogar na posição 0 (a que será removida)
        const valSame = GameEngine.validateMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 0,
            currentTurn: 'X',
            expectedSymbol: 'X',
            playerPieces
        });
        assert.equal(valSame.valid, false);
        assert.match(valSame.reason, /não pode colocar no mesmo lugar da peça que está sendo removida/i);

        // Tentar jogar em outra posição ocupada (ex: 4)
        const valOccupied = GameEngine.validateMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 4,
            currentTurn: 'X',
            expectedSymbol: 'X',
            playerPieces
        });
        assert.equal(valOccupied.valid, false);

        // Jogar em uma posição válida vazia (ex: 8)
        const valValid = GameEngine.validateMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 8,
            currentTurn: 'X',
            expectedSymbol: 'X',
            playerPieces
        });
        assert.equal(valValid.valid, true);

        // Ao aplicar, a posição 0 é removida e 8 é preenchida
        const move = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 8,
            symbol: 'X',
            playerPieces
        });
        assert.equal(move.removedPosition, 0);
        assert.equal(move.board[0], null); // limpou a posição 0
        assert.equal(move.board[8], 'X');  // nova posição
        assert.deepEqual(move.playerPieces.X, [4, 6, 8]);
    });

    test('deve detectar vitória no modo Alzaimer após remoção', () => {
        // Tabuleiro inicial:
        // X tem [1, 4, 5] (sem vitória)
        let board = GameEngine.createEmptyBoard(GAME_MODES.ALZAIMER);
        board[1] = 'X';
        board[4] = 'X';
        board[5] = 'X';
        const playerPieces = { X: [1, 4, 5], O: [] };

        // X joga 7 (linha 1, 4, 7 vertical!)
        // 1 é a primeira peça de X, então 1 é removida! As peças ativas ficam [4, 5, 7] (não alinha 1,4,7).
        const move = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board,
            position: 7,
            symbol: 'X',
            playerPieces
        });
        assert.equal(move.removedPosition, 1);
        assert.equal(move.board[1], null);
        const res1 = GameEngine.checkResult({ mode: GAME_MODES.ALZAIMER, board: move.board });
        assert.equal(res1.isOver, false);

        // Agora X joga 6: peças de X eram [4, 5, 7].
        // 4 é removido, 6 entra -> [5, 7, 6] -> não venceu.
        // Se X tiver [3, 4, 7] e jogar 5:
        // 3 é removido -> [4, 7, 5] não venceu.
        // Se X tem [1, 3, 5] e joga 4:
        // 1 é removido -> [3, 5, 4] -> [3, 4, 5] é linha horizontal!
        let boardWin = GameEngine.createEmptyBoard(GAME_MODES.ALZAIMER);
        boardWin[1] = 'X';
        boardWin[3] = 'X';
        boardWin[5] = 'X';
        const winPieces = { X: [1, 3, 5], O: [] };

        const moveWin = GameEngine.applyMove({
            mode: GAME_MODES.ALZAIMER,
            board: boardWin,
            position: 4,
            symbol: 'X',
            playerPieces: winPieces
        });
        assert.equal(moveWin.removedPosition, 1);
        assert.equal(moveWin.board[1], null);
        assert.equal(moveWin.board[3], 'X');
        assert.equal(moveWin.board[4], 'X');
        assert.equal(moveWin.board[5], 'X');

        const resWin = GameEngine.checkResult({ mode: GAME_MODES.ALZAIMER, board: moveWin.board });
        assert.equal(resWin.isOver, true);
        assert.equal(resWin.winnerSymbol, 'X');
        assert.deepEqual(resWin.winningLine, [3, 4, 5]);
    });
});

describe('GameEngine - Modo Infinito & War Zone (Faça 5)', () => {
    test('deve validar coordenadas (x, y) e rejeitar ocupadas', () => {
        let board = GameEngine.createEmptyBoard(GAME_MODES.INFINITO);
        const val = GameEngine.validateMove({
            mode: GAME_MODES.INFINITO,
            board,
            position: { x: 10, y: -5 },
            currentTurn: 'X',
            expectedSymbol: 'X'
        });
        assert.equal(val.valid, true);

        const move = GameEngine.applyMove({
            mode: GAME_MODES.INFINITO,
            board,
            position: { x: 10, y: -5 },
            symbol: 'X'
        });
        board = move.board;
        assert.equal(board['10,-5'], 'X');

        const valOccupied = GameEngine.validateMove({
            mode: GAME_MODES.INFINITO,
            board,
            position: '10,-5',
            currentTurn: 'O',
            expectedSymbol: 'O'
        });
        assert.equal(valOccupied.valid, false);
    });

    test('deve detectar 5 em linha horizontal', () => {
        let board = {};
        for (let x = 0; x < 4; x++) {
            board[`${x},0`] = 'X';
        }

        // Antes do 5º
        const checkBefore = GameEngine.checkResult({
            mode: GAME_MODES.INFINITO,
            board,
            lastMove: { x: 3, y: 0, symbol: 'X' }
        });
        assert.equal(checkBefore.isOver, false);

        // 5º movimento em x=4, y=0
        const move = GameEngine.applyMove({
            mode: GAME_MODES.INFINITO,
            board,
            position: { x: 4, y: 0 },
            symbol: 'X'
        });

        const checkAfter = GameEngine.checkResult({
            mode: GAME_MODES.INFINITO,
            board: move.board,
            lastMove: move.lastMove
        });
        assert.equal(checkAfter.isOver, true);
        assert.equal(checkAfter.winnerSymbol, 'X');
        assert.equal(checkAfter.winningLine.length, 5);
    });

    test('deve detectar 5 em linha diagonal com coordenadas negativas', () => {
        let board = {};
        // (-2, -2), (-1, -1), (0, 0), (1, 1)
        board['-2,-2'] = '△';
        board['-1,-1'] = '△';
        board['0,0'] = '△';
        board['1,1'] = '△';

        // 5º movimento em (2, 2)
        const move = GameEngine.applyMove({
            mode: GAME_MODES.WARZONE,
            board,
            position: { x: 2, y: 2 },
            symbol: '△'
        });

        const res = GameEngine.checkResult({
            mode: GAME_MODES.WARZONE,
            board: move.board,
            lastMove: move.lastMove
        });
        assert.equal(res.isOver, true);
        assert.equal(res.winnerSymbol, '△');
        assert.equal(res.winningLine.length, 5);
    });

    test('deve detectar 5 em linha anti-diagonal para o jogador estrela ☆', () => {
        let board = {};
        // (0, 4), (1, 3), (2, 2), (3, 1), (4, 0)
        board['0,4'] = '☆';
        board['1,3'] = '☆';
        board['3,1'] = '☆';
        board['4,0'] = '☆';

        // Preencher o meio (2, 2)
        const move = GameEngine.applyMove({
            mode: GAME_MODES.WARZONE,
            board,
            position: { x: 2, y: 2 },
            symbol: '☆'
        });

        const res = GameEngine.checkResult({
            mode: GAME_MODES.WARZONE,
            board: move.board,
            lastMove: move.lastMove
        });
        assert.equal(res.isOver, true);
        assert.equal(res.winnerSymbol, '☆');
        assert.equal(res.winningLine.length, 5);
    });
});
