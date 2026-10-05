/**
 * @file CpuEngine.js
 * Inteligência Artificial para o Modo Solo (vs CPU).
 * Calcula as melhores jogadas para os modos:
 * 1. Clássico (3x3)
 * 2. Alzaimer (3x3 com remoção de peças)
 * 3. Infinito e War Zone (Grid Infinito 5-em-linha)
 */

import { GameEngine, GAME_MODES } from './GameEngine.js';

export class CpuEngine {
    /**
     * Calcula a posição ideal para a jogada do CPU.
     * @param {object} room - Estado atual da sala
     * @returns {number|object} Posição 0-8 para 3x3 ou {x, y} para grid infinito
     */
    static getBestMove(room) {
        const { mode, board, currentTurn, playerPieces } = room;
        const cpuSymbol = currentTurn || 'O';
        const opponentSymbol = cpuSymbol === 'O' ? 'X' : 'O';

        if (mode === GAME_MODES.CLASSICO || mode === GAME_MODES.ALZAIMER) {
            return CpuEngine.get3x3Move(board, mode, cpuSymbol, opponentSymbol, playerPieces);
        }

        if (mode === GAME_MODES.INFINITO || mode === GAME_MODES.WARZONE) {
            return CpuEngine.getInfiniteMove(board, cpuSymbol, opponentSymbol);
        }

        return 0;
    }

    /**
     * Inteligência Artificial para a matriz 3x3 (Clássico e Alzaimer)
     */
    static get3x3Move(board, mode, cpuSymbol, opponentSymbol, playerPieces) {
        const availableIndices = [];
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                // No modo Alzaimer, não pode colocar na mesma casa da 1ª peça que vai sumir
                if (mode === GAME_MODES.ALZAIMER && playerPieces && playerPieces[cpuSymbol]?.length >= 3) {
                    if (playerPieces[cpuSymbol][0] === i) continue;
                }
                availableIndices.push(i);
            }
        }

        if (availableIndices.length === 0) return 0;

        // 1. Tentar VENCER no movimento atual
        for (const pos of availableIndices) {
            const simBoard = [...board];
            simBoard[pos] = cpuSymbol;
            const res = GameEngine.checkResult({ mode: GAME_MODES.CLASSICO, board: simBoard });
            if (res.isOver && res.winnerSymbol === cpuSymbol) {
                return pos;
            }
        }

        // 2. BLOQUEAR vitória do oponente no próximo turno
        for (const pos of availableIndices) {
            const simBoard = [...board];
            simBoard[pos] = opponentSymbol;
            const res = GameEngine.checkResult({ mode: GAME_MODES.CLASSICO, board: simBoard });
            if (res.isOver && res.winnerSymbol === opponentSymbol) {
                return pos;
            }
        }

        // 3. Preferência pelo CENTRO (posição 4)
        if (availableIndices.includes(4)) return 4;

        // 4. Preferência pelos CANTOS (0, 2, 6, 8)
        const corners = [0, 2, 6, 8].filter(c => availableIndices.includes(c));
        if (corners.length > 0) {
            return corners[Math.floor(Math.random() * corners.length)];
        }

        // 5. Escolha aleatória entre as posições válidas
        return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }

    /**
     * Inteligência Artificial para o Grid Infinito (Faça 5 em linha)
     */
    static getInfiniteMove(board, cpuSymbol, opponentSymbol) {
        const keys = Object.keys(board || {});
        if (keys.length === 0) {
            return { x: 0, y: 0 };
        }

        const occupiedCoords = keys.map(k => {
            const [x, y] = k.split(',').map(Number);
            return { x, y, symbol: board[k] };
        });

        const candidates = new Map();
        const directions = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
            { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
        ];

        for (const cell of occupiedCoords) {
            for (const { dx, dy } of directions) {
                const nx = cell.x + dx;
                const ny = cell.y + dy;
                const nkey = `${nx},${ny}`;
                if (!board[nkey]) {
                    candidates.set(nkey, { x: nx, y: ny });
                }
            }
        }

        const candidateList = Array.from(candidates.values());
        if (candidateList.length === 0) return { x: 0, y: 0 };

        // 1. Tentar VENCER (5 em linha)
        for (const cand of candidateList) {
            const res = GameEngine.checkInfiniteResult(board, { x: cand.x, y: cand.y, symbol: cpuSymbol });
            if (res.isOver && res.winnerSymbol === cpuSymbol) {
                return cand;
            }
        }

        // 2. BLOQUEAR 5 em linha do oponente
        for (const cand of candidateList) {
            const res = GameEngine.checkInfiniteResult(board, { x: cand.x, y: cand.y, symbol: opponentSymbol });
            if (res.isOver && res.winnerSymbol === opponentSymbol) {
                return cand;
            }
        }

        // 3. Escolher célula estratégica com maior vizinhança de peças
        let bestCand = candidateList[0];
        let maxScore = -1;

        for (const cand of candidateList) {
            let score = 0;
            for (const { dx, dy } of directions) {
                const neighborSymbol = board[`${cand.x + dx},${cand.y + dy}`];
                if (neighborSymbol === cpuSymbol) score += 2;
                else if (neighborSymbol === opponentSymbol) score += 1;
            }
            if (score > maxScore) {
                maxScore = score;
                bestCand = cand;
            }
        }

        return bestCand;
    }
}
