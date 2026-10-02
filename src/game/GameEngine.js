export class GameEngine {
    static WINNING_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontais
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticais
        [0, 4, 8], [2, 4, 6]             // Diagonais
    ];

    static createEmptyBoard() {
        return Array(9).fill(null);
    }

    static validateMove(board, position, currentTurn, expectedSymbol) {
        if (position < 0 || position > 8) {
            return { valid: false, reason: 'Posição fora dos limites da grade (0 a 8).' };
        }
        if (board[position] !== null) {
            return { valid: false, reason: 'Célula já preenchida.' };
        }
        if (currentTurn !== expectedSymbol) {
            return { valid: false, reason: 'Não é a sua vez de jogar.' };
        }
        return { valid: true };
    }

    static applyMove(board, position, symbol) {
        const newBoard = [...board];
        newBoard[position] = symbol;
        return newBoard;
    }

    static checkResult(board) {
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

        const isDraw = board.every(cell => cell !== null);
        if (isDraw) {
            return {
                isOver: true,
                winnerSymbol: null,
                isDraw: true,
                winningLine: null
            };
        }

        return {
            isOver: false,
            winnerSymbol: null,
            isDraw: false,
            winningLine: null
        };
    }
}
