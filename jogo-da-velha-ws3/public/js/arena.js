/**
 * Controller da Tela 2 (Arena de Jogo 3x3) & Tela 3 (Modal Fim de Jogo) - Figura 4 a 7
 */
document.addEventListener('DOMContentLoaded', () => {
    // Screens
    const lobbyScreen = document.getElementById('lobby-screen');
    const arenaScreen = document.getElementById('arena-screen');

    // Header Elements
    const arenaRoomCode = document.getElementById('arena-room-code');
    const scoreHostName = document.getElementById('score-host-name');
    const scoreHostVal = document.getElementById('score-host-val');
    const scoreVisitanteName = document.getElementById('score-visitante-name');
    const scoreVisitanteVal = document.getElementById('score-visitante-val');
    const btnLeaveArena = document.getElementById('btn-leave-arena');

    // Turn Banner & Board
    const turnBanner = document.getElementById('turn-banner');
    const turnBannerText = document.getElementById('turn-banner-text');
    const boardEl = document.getElementById('board');
    const cells = document.querySelectorAll('.cell');

    // Chat Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    // Modal Game Over Elements
    const modalGameOver = document.getElementById('modal-gameover');
    const modalResultTitle = document.getElementById('modal-result-title');
    const modalResultSub = document.getElementById('modal-result-sub');
    const summaryWinner = document.getElementById('summary-winner');
    const summaryScore = document.getElementById('summary-score');
    const btnRematch = document.getElementById('btn-rematch');
    const btnBackLobby = document.getElementById('btn-back-lobby');
    const modalWaitingText = document.getElementById('modal-waiting-text');

    // Estado do Cliente
    let mySymbol = null; // 'X' ou 'O'
    let currentRoomCode = null;
    let myPlayerName = null;

    // Clique nas Células do Tabuleiro
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = parseInt(cell.getAttribute('data-index'), 10);
            if (!isNaN(index) && currentRoomCode && mySymbol) {
                // Dispara o evento MOVE conforme Listing 2 do PDF
                window.socket.send('MOVE', {
                    roomCode: currentRoomCode,
                    position: index,
                    playerSymbol: mySymbol
                });
            }
        });
    });

    // Enviar Chat
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text && currentRoomCode) {
            window.socket.send('CHAT_MESSAGE', {
                roomCode: currentRoomCode,
                text
            });
            chatInput.value = '';
        }
    });

    // Sair da Arena
    btnLeaveArena.addEventListener('click', () => {
        if (confirm('Deseja realmente sair da sala e retornar ao lobby?')) {
            location.reload();
        }
    });

    // Revanche
    btnRematch.addEventListener('click', () => {
        btnRematch.disabled = true;
        btnRematch.querySelector('span').textContent = 'AGUARDANDO OPONENTE...';
        modalWaitingText.style.display = 'block';
        window.socket.send('NEW_GAME', { roomCode: currentRoomCode });
    });

    btnBackLobby.addEventListener('click', () => {
        location.reload();
    });

    // --- MANIPULAÇÃO DE EVENTOS WEBSOCKET ---

    // 1. Sala Criada (Aguardando Oponente)
    window.socket.on('ROOM_CREATED', (data) => {
        currentRoomCode = data.roomCode;
        mySymbol = data.playerSymbol;
        myPlayerName = data.playerName;

        arenaRoomCode.textContent = `SALA ${data.roomCode}`;
        scoreHostName.textContent = data.playerName;
        scoreVisitanteName.textContent = 'Aguardando...';
        scoreHostVal.textContent = '0';
        scoreVisitanteVal.textContent = '0';

        turnBanner.className = 'turn-banner opponent-turn';
        turnBannerText.textContent = `Aguardando o 2º jogador entrar na sala (${data.roomCode})...`;
        boardEl.classList.add('disabled');

        switchToArena();
    });

    // 2. BOARD_UPDATE (RF-04 & 6.2.2 - Atualização Sincronizada com Cronômetro)
    window.socket.on('BOARD_UPDATE', (data) => {
        currentRoomCode = data.roomCode;
        myPlayerName = localStorage.getItem('velha_nickname') || 'Você';

        // Determina símbolo do cliente se ainda não setado
        if (data.hostName === myPlayerName) {
            mySymbol = data.hostSymbol;
        } else if (data.visitanteName === myPlayerName) {
            mySymbol = data.visitanteSymbol;
        }

        arenaRoomCode.textContent = `SALA ${data.roomCode}`;
        scoreHostName.textContent = data.hostName || 'Host';
        scoreVisitanteName.textContent = data.visitanteName || 'Visitante';
        scoreHostVal.textContent = data.placarHost || 0;
        scoreVisitanteVal.textContent = data.placarVisitante || 0;

        // Renderiza tabuleiro 3x3
        renderBoard(data.board);

        // Atualiza Turn Banner com Cronômetro de 15s
        const isMyTurn = (data.nextTurn === mySymbol);
        if (isMyTurn) {
            turnBanner.className = 'turn-banner';
            turnBannerText.textContent = `VOCÊ É O '${mySymbol}' | SUA VEZ DE JOGAR! (Cronômetro: ${data.timer || 15}s)`;
            boardEl.classList.remove('disabled');
        } else {
            turnBanner.className = 'turn-banner opponent-turn';
            turnBannerText.textContent = `VOCÊ É O '${mySymbol}' | VEZ DO OPONENTE '${data.nextTurn}' (${data.timer || 15}s)`;
            boardEl.classList.add('disabled');
        }

        // Esconde modal caso estivesse aberto (revanche iniciada)
        modalGameOver.classList.remove('active');
        switchToArena();
    });

    // 3. INVALID_MOVE (RF-03 - Rejeição de Jogadas Inválidas)
    window.socket.on('INVALID_MOVE', (data) => {
        alert(data.message || 'Jogada inválida!');
    });

    // 4. GAME_OVER (RF-05 & Figura 6/7)
    window.socket.on('GAME_OVER', (data) => {
        boardEl.classList.add('disabled');

        // Atualiza células no tabuleiro final
        if (data.board) renderBoard(data.board);

        // Destaca linha de vitória
        if (data.winningLine) {
            data.winningLine.forEach(idx => {
                if (cells[idx]) cells[idx].classList.add('winning-cell');
            });
        }

        // Exibe o modal após pequena transição
        setTimeout(() => {
            showGameOverModal(data);
        }, 500);
    });

    // 5. CHAT_MESSAGE (RF-06)
    window.socket.on('CHAT_MESSAGE', (data) => {
        appendChatMessage(data);
    });

    // 6. REMATCH_REQUESTED (RF-07)
    window.socket.on('REMATCH_REQUESTED', (data) => {
        appendSystemChatMessage(`🔄 ${data.sender} solicitou uma revanche! Clique em Aceitar.`);
        btnRematch.querySelector('span').textContent = 'ACEITAR REVANCHE [WS]';
        btnRematch.disabled = false;
    });

    // 7. PLAYER_DISCONNECTED (RF-08)
    window.socket.on('PLAYER_DISCONNECTED', (data) => {
        appendSystemChatMessage(`⚠️ ${data.message}`);
        turnBanner.className = 'turn-banner opponent-turn';
        turnBannerText.textContent = `Aviso: Adversário desconectado... (Aguardando 30s)`;
    });

    // --- FUNÇÕES AUXILIARES ---

    function switchToArena() {
        lobbyScreen.classList.remove('active');
        arenaScreen.classList.add('active');
    }

    function renderBoard(boardArray) {
        if (!boardArray) return;
        boardArray.forEach((val, idx) => {
            const cell = cells[idx];
            if (cell) {
                cell.textContent = val || '';
                cell.className = 'cell';
                if (val === 'X') cell.classList.add('x');
                if (val === 'O') cell.classList.add('o');
            }
        });
    }

    function showGameOverModal(data) {
        btnRematch.disabled = false;
        btnRematch.querySelector('span').textContent = '🔄 SOLICITAR REVANCHE [WS]';
        modalWaitingText.style.display = 'none';

        if (data.isDraw) {
            modalResultTitle.textContent = '🤝 EMPATE!';
            modalResultSub.textContent = 'Velha! Ninguém conseguiu alinhar 3 símbolos.';
            summaryWinner.textContent = 'Nenhum (Empate)';
        } else if (data.winner === myPlayerName) {
            modalResultTitle.textContent = '🏆 [!] VITÓRIA! VOCÊ VENCEU!';
            modalResultSub.textContent = `Três símbolos '${data.winnerSymbol}' alinhados com sucesso!`;
            summaryWinner.textContent = `${data.winner} ('${data.winnerSymbol}')`;
        } else {
            modalResultTitle.textContent = '💀 DERROTA!';
            modalResultSub.textContent = `O adversário ${data.winner || 'Oponente'} alinhou os símbolos primeiro.`;
            summaryWinner.textContent = `${data.winner || 'Oponente'} ('${data.winnerSymbol}')`;
        }

        summaryScore.textContent = `${data.hostName || 'Host'} ${data.placarHost} x ${data.placarVisitante} ${data.visitanteName || 'Visitante'}`;
        modalGameOver.classList.add('active');
    }

    function appendChatMessage(data) {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `
            <span class="sender">${escapeHtml(data.sender)}:</span>
            <span class="text">${escapeHtml(data.text)}</span>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendSystemChatMessage(text) {
        const div = document.createElement('div');
        div.className = 'chat-system-msg';
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
