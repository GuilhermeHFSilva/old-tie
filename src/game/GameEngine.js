/**
 * @file GameEngine.js
 * Motor de regras e validação de jogadas para múltiplos modos de jogo:
 * 1. CLASSICO (3x3 tradicional, 2 jogadores, vença com 3)
 * 2. INFINITO (Grid infinito, 2 jogadores, vença com 5)
 * 3. ALZAIMER (Grid 3x3 com memória FIFO de 3 peças por jogador, o mais antigo pisca e é removido, vença com 3)
 * 4. WARZONE (Grid infinito com múltiplos jogadores: X, O, △, ☆, vença com 5)
 */

export const GAME_MODES = {
    CLASSICO: 'CLASSICO',
    INFINITO: 'INFINITO',
    ALZAIMER: 'ALZAIMER',
    WARZONE: 'WARZONE'
};

export const WARZONE_SYMBOLS = ['X', 'O', '△', '☆'];

export class GameEngine {
    static WINNING_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontais
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticais
        [0, 4, 8], [2, 4, 6]             // Diagonais
    ];

    /**
     * Cria um tabuleiro inicial de acordo com o modo de jogo.
     * @param {string} [mode=GAME_MODES.CLASSICO]
     * @returns {Array|Object} Tabuleiro vazio
     */
    static createEmptyBoard(mode = GAME_MODES.CLASSICO) {
        if (mode === GAME_MODES.INFINITO || mode === GAME_MODES.WARZONE) {
            return {};
        }
        return Array(9).fill(null);
    }

    /**
     * Valida um movimento antes de ser aplicado.
     * Suporta assinatura legada: (board, position, currentTurn, expectedSymbol)
     * e objeto unificado: ({ mode, board, position, currentTurn, expectedSymbol, playerPieces })
     */
    static validateMove(param1, position, currentTurn, expectedSymbol) {
        let mode = GAME_MODES.CLASSICO;
        let board = param1;
        let pPos = position;
        let pTurn = currentTurn;
        let pSymbol = expectedSymbol;
        let playerPieces = null;

        if (param1 && typeof param1 === 'object' && !Array.isArray(param1) && param1.mode) {
            mode = param1.mode;
            board = param1.board;
            pPos = param1.position;
            pTurn = param1.currentTurn;
            pSymbol = param1.expectedSymbol;
            playerPieces = param1.playerPieces;
        }

        if (pTurn !== pSymbol) {
            return { valid: false, reason: 'Não é a sua vez de jogar.' };
        }

        if (mode === GAME_MODES.CLASSICO) {
            if (typeof pPos !== 'number' || pPos < 0 || pPos > 8) {
                return { valid: false, reason: 'Posição fora dos limites da grade (0 a 8).' };
            }
            if (board[pPos] !== null) {
                return { valid: false, reason: 'Célula já preenchida.' };
            }
            return { valid: true };
        }

        if (mode === GAME_MODES.ALZAIMER) {
            if (typeof pPos !== 'number' || pPos < 0 || pPos > 8) {
                return { valid: false, reason: 'Posição fora dos limites da grade (0 a 8).' };
            }

            const pieces = playerPieces?.[pSymbol] || [];
            if (pieces.length >= 3) {
                const oldestPos = pieces[0];
                if (pPos === oldestPos) {
                    return {
                        valid: false,
                        reason: 'Você não pode colocar no mesmo lugar da peça que está sendo removida!'
                    };
                }
            }

            if (board[pPos] !== null) {
                return { valid: false, reason: 'Célula já preenchida.' };
            }

            return { valid: true };
        }

        if (mode === GAME_MODES.INFINITO || mode === GAME_MODES.WARZONE) {
            const coords = GameEngine.parseCoordinate(pPos);
            if (!coords) {
                return { valid: false, reason: 'Coordenadas inválidas para o grid infinito.' };
            }
            const { x, y } = coords;
            const key = `${x},${y}`;
            if (board && board[key]) {
                return { valid: false, reason: 'Célula já preenchida no grid infinito.' };
            }
            return { valid: true, coords };
        }

        return { valid: false, reason: 'Modo de jogo desconhecido.' };
    }

    /**
     * Aplica um movimento no tabuleiro.
     * Suporta assinatura legada: (board, position, symbol)
     * e objeto unificado: ({ mode, board, position, symbol, playerPieces })
     */
    static applyMove(param1, position, symbol) {
        let mode = GAME_MODES.CLASSICO;
        let board = param1;
        let pPos = position;
        let pSymbol = symbol;
        let playerPieces = null;

        if (param1 && typeof param1 === 'object' && !Array.isArray(param1) && param1.mode) {
            mode = param1.mode;
            board = param1.board;
            pPos = param1.position;
            pSymbol = param1.symbol;
            playerPieces = param1.playerPieces;
        }

        if (mode === GAME_MODES.CLASSICO) {
            const newBoard = [...board];
            newBoard[pPos] = pSymbol;
            return newBoard;
        }

        if (mode === GAME_MODES.ALZAIMER) {
            const newBoard = [...board];
            const pieces = [...(playerPieces?.[pSymbol] || [])];
            let removedPosition = null;

            if (pieces.length >= 3) {
                removedPosition = pieces.shift();
                newBoard[removedPosition] = null;
            }

            newBoard[pPos] = pSymbol;
            pieces.push(pPos);

            const updatedPlayerPieces = {
                ...(playerPieces || {}),
                [pSymbol]: pieces
            };

            return {
                board: newBoard,
                playerPieces: updatedPlayerPieces,
                removedPosition
            };
        }

        if (mode === GAME_MODES.INFINITO || mode === GAME_MODES.WARZONE) {
            const coords = GameEngine.parseCoordinate(pPos);
            const key = `${coords.x},${coords.y}`;
            const newBoard = { ...(board || {}), [key]: pSymbol };
            return {
                board: newBoard,
                lastMove: { x: coords.x, y: coords.y, symbol: pSymbol }
            };
        }

        return board;
    }

    /**
     * Verifica o resultado do jogo (vitória ou empate).
     */
    static checkResult(param1, lastMoveParam) {
        let mode = GAME_MODES.CLASSICO;
        let board = param1;
        let lastMove = lastMoveParam;

        if (param1 && typeof param1 === 'object' && !Array.isArray(param1) && param1.mode) {
            mode = param1.mode;
            board = param1.board;
            lastMove = param1.lastMove;
        }

        if (mode === GAME_MODES.CLASSICO || mode === GAME_MODES.ALZAIMER) {
            for (const line of GameEngine.WINNING_LINES) {
                const [a, b, c] = line;
                if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                    return {
                        isOver: true,
                        winnerSymbol: board[a],
                        isDraw: false,
                        winningLine: line
                    };
                }
            }

            if (mode === GAME_MODES.CLASSICO) {
                const isDraw = board.every(cell => cell !== null);
                if (isDraw) {
                    return {
                        isOver: true,
                        winnerSymbol: null,
                        isDraw: true,
                        winningLine: null
                    };
                }
            }

            return {
                isOver: false,
                winnerSymbol: null,
                isDraw: false,
                winningLine: null
            };
        }

        if (mode === GAME_MODES.INFINITO || mode === GAME_MODES.WARZONE) {
            return GameEngine.checkInfiniteResult(board, lastMove);
        }

        return { isOver: false, winnerSymbol: null, isDraw: false, winningLine: null };
    }

    /**
     * Verifica se há 5 em linha no grid infinito a partir de um movimento recente ou varredura completa.
     */
    static checkInfiniteResult(board, lastMove) {
        if (!board || Object.keys(board).length === 0) {
            return { isOver: false, winnerSymbol: null, isDraw: false, winningLine: null };
        }

        const directions = [
            { dx: 1, dy: 0 },  // Horizontal
            { dx: 0, dy: 1 },  // Vertical
            { dx: 1, dy: 1 },  // Diagonal principal ↘
            { dx: 1, dy: -1 }  // Anti-diagonal ↗
        ];

        // Se temos o lastMove, verificamos O(1) apenas a partir deste ponto
        if (lastMove && typeof lastMove.x === 'number' && typeof lastMove.y === 'number' && lastMove.symbol) {
            const { x, y, symbol } = lastMove;

            for (const { dx, dy } of directions) {
                const line = [{ x, y }];

                // Direção positiva
                let step = 1;
                while (board[`${x + step * dx},${y + step * dy}`] === symbol) {
                    line.push({ x: x + step * dx, y: y + step * dy });
                    step++;
                }

                // Direção negativa
                step = 1;
                while (board[`${x - step * dx},${y - step * dy}`] === symbol) {
                    line.unshift({ x: x - step * dx, y: y - step * dy });
                    step++;
                }

                if (line.length >= 5) {
                    return {
                        isOver: true,
                        winnerSymbol: symbol,
                        isDraw: false,
                        winningLine: line
                    };
                }
            }

            return { isOver: false, winnerSymbol: null, isDraw: false, winningLine: null };
        }

        // Varredura completa caso lastMove não esteja disponível
        const keys = Object.keys(board);
        for (const key of keys) {
            const [cx, cy] = key.split(',').map(Number);
            const symbol = board[key];
            if (!symbol) continue;

            for (const { dx, dy } of directions) {
                const line = [];
                for (let i = 0; i < 5; i++) {
                    const checkKey = `${cx + i * dx},${cy + i * dy}`;
                    if (board[checkKey] === symbol) {
                        line.push({ x: cx + i * dx, y: cy + i * dy });
                    } else {
                        break;
                    }
                }
                if (line.length === 5) {
                    return {
                        isOver: true,
                        winnerSymbol: symbol,
                        isDraw: false,
                        winningLine: line
                    };
                }
            }
        }

        return { isOver: false, winnerSymbol: null, isDraw: false, winningLine: null };
    }

    /**
     * Converte posição para objeto de coordenadas { x, y }.
     * Suporta string "x,y", objeto { x, y } ou array [x, y].
     * @param {string|object|Array} pos
     * @returns {{x: number, y: number}|null}
     */
    static parseCoordinate(pos) {
        if (pos && typeof pos === 'object') {
            if (typeof pos.x === 'number' && typeof pos.y === 'number') {
                return { x: Math.round(pos.x), y: Math.round(pos.y) };
            }
            if (Array.isArray(pos) && pos.length === 2) {
                const x = Number(pos[0]);
                const y = Number(pos[1]);
                if (!isNaN(x) && !isNaN(y)) return { x, y };
            }
        }
        if (typeof pos === 'string') {
            const parts = pos.split(',');
            if (parts.length === 2) {
                const x = parseInt(parts[0].trim(), 10);
                const y = parseInt(parts[1].trim(), 10);
                if (!isNaN(x) && !isNaN(y)) {
                    return { x, y };
                }
            }
        }
        return null;
    }
}
