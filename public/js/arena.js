/**
 * @file arena.js
 * Controller da Tela 2 (Arena de Jogo) e Tela 3 (Modal Fim de Jogo)
 * Suporte completo a 4 modos de jogo:
 * 1. Clássico (3x3)
 * 2. Infinito (Grid Infinito 5-em-linha)
 * 3. Alzaimer (3x3 com memória de 3 peças e peça mais antiga piscando)
 * 4. War Zone (Grid Infinito Multijogador)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Screens
    const lobbyScreen = document.getElementById('lobby-screen');
    const arenaScreen = document.getElementById('arena-screen');

    // Header Elements
    const arenaRoomCode = document.getElementById('arena-room-code');
    const arenaModeBadge = document.getElementById('arena-mode-badge');
    const arenaScoreboard = document.getElementById('arena-scoreboard');
    const warzoneScoreboard = document.getElementById('warzone-scoreboard');
    const scoreHostName = document.getElementById('score-host-name');
    const scoreHostVal = document.getElementById('score-host-val');
    const scoreVisitanteName = document.getElementById('score-visitante-name');
    const scoreVisitanteVal = document.getElementById('score-visitante-val');
    const btnLeaveArena = document.getElementById('btn-leave-arena');

    // Turn Banner & Boards
    const turnBanner = document.getElementById('turn-banner');
    const turnBannerText = document.getElementById('turn-banner-text');
    const warzoneStartContainer = document.getElementById('warzone-start-container');
    const warzoneReadyText = document.getElementById('warzone-ready-text');
    const btnStartWarzone = document.getElementById('btn-start-warzone');

    // 3x3 Board
    const board3x3Wrapper = document.getElementById('board-3x3-wrapper');
    const boardEl = document.getElementById('board');
    const cells3x3 = document.querySelectorAll('.cell');

    // Infinite Board
    const boardInfiniteWrapper = document.getElementById('board-infinite-wrapper');
    const infiniteViewport = document.getElementById('infinite-viewport');
    const infiniteCanvasGrid = document.getElementById('infinite-canvas-grid');
    const infiniteCoordsHover = document.getElementById('infinite-coords-hover');
    const btnInfiniteZoomIn = document.getElementById('btn-infinite-zoom-in');
    const btnInfiniteZoomOut = document.getElementById('btn-infinite-zoom-out');
    const btnInfiniteCenter = document.getElementById('btn-infinite-center');

    // Chat Elements
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    // Modal Game Over Elements
    const modalGameOver = document.getElementById('modal-gameover');
    const modalResultTitle = document.getElementById('modal-result-title');
    const modalResultSub = document.getElementById('modal-result-sub');
    const summaryMode = document.getElementById('summary-mode');
    const summaryWinner = document.getElementById('summary-winner');
    const summaryScoreList = document.getElementById('summary-score-list');
    const btnRematch = document.getElementById('btn-rematch');
    const btnBackLobby = document.getElementById('btn-back-lobby');
    const modalWaitingText = document.getElementById('modal-waiting-text');

    // Estado do Cliente
    let mySymbol = null; // 'X', 'O', '△', '☆'
    let currentRoomCode = null;
    let currentMode = 'CLASSICO';
    let myPlayerName = null;
    let isHost = false;
    let currentTurn = 'X';
    let currentAlzaimerState = null;
    let winningLineCells = null;

    // Estado de Panning e Zoom do Grid Infinito
    let panX = 0;
    let panY = 0;
    let zoom = 1.0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let hasDragged = false;
    let lastRenderedInfiniteBoard = null;

    // --- EVENTOS DE INTERAÇÃO COM O TABULEIRO 3x3 ---
    cells3x3.forEach(cell => {
        cell.addEventListener('click', () => {
            const index = parseInt(cell.getAttribute('data-index'), 10);
            if (isNaN(index) || !currentRoomCode || !mySymbol) return;

            // No modo Alzaimer, bloqueia clique na peça que está expirando
            if (currentMode === 'ALZAIMER' && currentAlzaimerState && currentAlzaimerState.fadingPosition === index) {
                alert('⚠️ Esta é a sua peça que está sendo removida! Escolha outra casa vazia para jogar.');
                return;
            }

            window.socket.send('MOVE', {
                roomCode: currentRoomCode,
                position: index,
                playerSymbol: mySymbol
            });
        });
    });

    // --- EVENTOS DO GRID INFINITO ---
    if (btnInfiniteZoomIn) {
        btnInfiniteZoomIn.addEventListener('click', () => {
            zoom = Math.min(zoom + 0.15, 1.8);
            updateInfiniteTransform();
        });
    }

    if (btnInfiniteZoomOut) {
        btnInfiniteZoomOut.addEventListener('click', () => {
            zoom = Math.max(zoom - 0.15, 0.6);
            updateInfiniteTransform();
        });
    }

    if (btnInfiniteCenter) {
        btnInfiniteCenter.addEventListener('click', () => {
            panX = 0;
            panY = 0;
            zoom = 1.0;
            updateInfiniteTransform();
        });
    }

    // Drag / Pan no Viewport do Grid Infinito
    infiniteViewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        hasDragged = false;
        dragStartX = e.clientX - panX;
        dragStartY = e.clientY - panY;
        infiniteViewport.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const currentPanX = e.clientX - dragStartX;
        const currentPanY = e.clientY - dragStartY;
        if (Math.abs(currentPanX - panX) > 4 || Math.abs(currentPanY - panY) > 4) {
            hasDragged = true;
        }
        panX = currentPanX;
        panY = currentPanY;
        updateInfiniteTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            infiniteViewport.classList.remove('dragging');
        }
    });

    // Touch Support para Celulares / Tablets
    infiniteViewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            hasDragged = false;
            dragStartX = e.touches[0].clientX - panX;
            dragStartY = e.touches[0].clientY - panY;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const currentPanX = e.touches[0].clientX - dragStartX;
        const currentPanY = e.touches[0].clientY - dragStartY;
        if (Math.abs(currentPanX - panX) > 4 || Math.abs(currentPanY - panY) > 4) {
            hasDragged = true;
        }
        panX = currentPanX;
        panY = currentPanY;
        updateInfiniteTransform();
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    function updateInfiniteTransform() {
        infiniteCanvasGrid.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
    }

    // Botão Iniciar Partida Agora (War Zone Host)
    if (btnStartWarzone) {
        btnStartWarzone.addEventListener('click', () => {
            window.socket.send('START_GAME', { roomCode: currentRoomCode });
        });
    }

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
        btnRematch.querySelector('span').textContent = 'AGUARDANDO OPONENTES...';
        modalWaitingText.style.display = 'block';
        window.socket.send('NEW_GAME', { roomCode: currentRoomCode });
    });

    btnBackLobby.addEventListener('click', () => {
        location.reload();
    });

    // --- MANIPULAÇÃO DE EVENTOS WEBSOCKET ---

    // 1. Sala Criada
    window.socket.on('ROOM_CREATED', (data) => {
        currentRoomCode = data.roomCode;
        mySymbol = data.playerSymbol;
        myPlayerName = data.playerName;
        currentMode = data.mode || 'CLASSICO';
        isHost = true;

        setupArenaView(currentMode);
        arenaRoomCode.textContent = `SALA ${data.roomCode}`;

        turnBanner.className = 'turn-banner opponent-turn';
        if (currentMode === 'WARZONE') {
            turnBannerText.textContent = `Sala criada! Aguardando jogadores entrarem (1/${data.maxPlayers})...`;
        } else {
            turnBannerText.textContent = `Aguardando o 2º jogador entrar na sala (${data.roomCode})...`;
        }

        boardEl.classList.add('disabled');
        switchToArena();
    });

    // 2. Sala Entrada
    window.socket.on('ROOM_JOINED', (data) => {
        currentRoomCode = data.roomCode;
        mySymbol = data.playerSymbol;
        myPlayerName = data.playerName;
        currentMode = data.mode || 'CLASSICO';
        isHost = false;

        setupArenaView(currentMode);
        arenaRoomCode.textContent = `SALA ${data.roomCode}`;
        switchToArena();
    });

    // 3. Atualização de Tabuleiro e Estado da Sala
    window.socket.on('BOARD_UPDATE', (data) => {
        currentRoomCode = data.roomCode;
        currentMode = data.mode || currentMode;
        currentTurn = data.nextTurn;
        currentAlzaimerState = data.alzaimer || null;
        winningLineCells = null;

        myPlayerName = localStorage.getItem('velha_nickname') || myPlayerName || 'Você';

        // Atualiza símbolo do jogador a partir da lista
        if (data.players && Array.isArray(data.players)) {
            const me = data.players.find(p => p.nickname === myPlayerName);
            if (me) {
                mySymbol = me.simbolo;
                isHost = me.isHost;
            }
        }

        setupArenaView(currentMode);
        arenaRoomCode.textContent = `SALA ${data.roomCode}`;

        // Renderiza Placar
        renderScoreboard(data);

        // Verifica botão de início rápido no War Zone
        if (currentMode === 'WARZONE' && data.status === 'AGUARDANDO') {
            const connectedCount = data.players ? data.players.filter(p => p.isConnected).length : 1;
            if (isHost && connectedCount >= 2) {
                warzoneStartContainer.style.display = 'block';
                warzoneReadyText.textContent = `${connectedCount}/${data.maxPlayers} jogadores conectados. Clique para iniciar agora!`;
            } else {
                warzoneStartContainer.style.display = 'none';
            }
        } else {
            warzoneStartContainer.style.display = 'none';
        }

        // Renderiza o Tabuleiro Correspondente
        if (currentMode === 'INFINITO' || currentMode === 'WARZONE') {
            renderInfiniteBoard(data.board, data.nextTurn === mySymbol);
        } else {
            render3x3Board(data.board, data.nextTurn === mySymbol);
        }

        // Atualiza Turn Banner
        updateTurnBanner(data);

        // Fecha modal se estava aberto
        modalGameOver.classList.remove('active');
        switchToArena();
    });

    // 4. Jogada Inválida
    window.socket.on('INVALID_MOVE', (data) => {
        alert(data.message || 'Jogada inválida!');
    });

    // 5. Game Over
    window.socket.on('GAME_OVER', (data) => {
        boardEl.classList.add('disabled');
        winningLineCells = data.winningLine;

        // Renderiza tabuleiro final com destaque
        if (currentMode === 'INFINITO' || currentMode === 'WARZONE') {
            renderInfiniteBoard(data.board, false, data.winningLine);
        } else {
            render3x3Board(data.board, false, data.winningLine);
        }

        setTimeout(() => {
            showGameOverModal(data);
        }, 500);
    });

    // 6. Mensagens de Chat
    window.socket.on('CHAT_MESSAGE', (data) => {
        appendChatMessage(data);
    });

    // 7. Solicitação de Revanche
    window.socket.on('REMATCH_REQUESTED', (data) => {
        appendSystemChatMessage(`🔄 ${data.message || data.sender + ' solicitou uma revanche!'}`);
        btnRematch.querySelector('span').textContent = 'ACEITAR REVANCHE [WS]';
        btnRematch.disabled = false;
    });

    // 8. Jogador Desconectou
    window.socket.on('PLAYER_DISCONNECTED', (data) => {
        appendSystemChatMessage(`⚠️ ${data.message}`);
    });

    // --- FUNÇÕES DE RENDERIZAÇÃO E CONTROLE ---

    function setupArenaView(mode) {
        arenaModeBadge.textContent = formatModeName(mode);
        arenaModeBadge.className = `mode-badge-pill ${mode}`;

        if (mode === 'INFINITO' || mode === 'WARZONE') {
            board3x3Wrapper.style.display = 'none';
            boardInfiniteWrapper.style.display = 'flex';
        } else {
            board3x3Wrapper.style.display = 'block';
            boardInfiniteWrapper.style.display = 'none';
        }

        if (mode === 'WARZONE') {
            arenaScoreboard.style.display = 'none';
            warzoneScoreboard.style.display = 'flex';
        } else {
            arenaScoreboard.style.display = 'block';
            warzoneScoreboard.style.display = 'none';
        }
    }

    function renderScoreboard(data) {
        if (currentMode === 'WARZONE' && data.players) {
            warzoneScoreboard.innerHTML = '';
            data.players.forEach(p => {
                const chip = document.createElement('div');
                chip.className = `player-chip ${p.simbolo === data.nextTurn ? 'active-turn' : ''}`;
                chip.innerHTML = `
                    <span class="chip-symbol">${getSymbolDisplay(p.simbolo)}</span>
                    <span class="chip-name">${escapeHtml(p.nickname)}</span>
                    <span class="chip-score">${p.score || 0}</span>
                `;
                warzoneScoreboard.appendChild(chip);
            });
        } else {
            scoreHostName.textContent = data.hostName || 'Host';
            scoreVisitanteName.textContent = data.visitanteName || 'Visitante';
            scoreHostVal.textContent = data.placarHost || 0;
            scoreVisitanteVal.textContent = data.placarVisitante || 0;
        }
    }

    function updateTurnBanner(data) {
        const isMyTurn = (data.nextTurn === mySymbol);
        const timerText = `(${data.timer || 15}s)`;

        turnBanner.className = 'turn-banner';

        if (data.status === 'AGUARDANDO') {
            turnBanner.classList.add('opponent-turn');
            turnBannerText.textContent = `Aguardando início da partida...`;
            return;
        }

        if (isMyTurn) {
            if (currentMode === 'ALZAIMER' && currentAlzaimerState && currentAlzaimerState.fadingPosition !== null) {
                turnBanner.classList.add('alzaimer-warning');
                turnBannerText.textContent = `VOCÊ É O '${mySymbol}' | SUA VEZ! ⚠️ Sua 1ª peça (posição ${currentAlzaimerState.fadingPosition + 1}) está piscando e será removida! ${timerText}`;
            } else {
                turnBannerText.textContent = `VOCÊ É O '${getSymbolDisplay(mySymbol)}' | SUA VEZ DE JOGAR! ${timerText}`;
            }
        } else {
            turnBanner.classList.add('opponent-turn');
            const turnPlayer = data.players ? data.players.find(p => p.simbolo === data.nextTurn) : null;
            const turnName = turnPlayer ? turnPlayer.nickname : `Jogador '${data.nextTurn}'`;
            turnBannerText.textContent = `VEZ DE: ${escapeHtml(turnName)} (${getSymbolDisplay(data.nextTurn)}) ${timerText}`;
        }
    }

    function render3x3Board(boardArray, isMyTurn, winningLine = null) {
        if (!boardArray) return;

        if (isMyTurn) boardEl.classList.remove('disabled');
        else boardEl.classList.add('disabled');

        cells3x3.forEach((cell, idx) => {
            const val = boardArray[idx];
            cell.className = 'cell';
            cell.innerHTML = '';

            if (val) {
                cell.textContent = val;
                if (val === 'X') cell.classList.add('x');
                if (val === 'O') cell.classList.add('o');

                // No modo Alzaimer, exibe número de ordem da peça (1, 2, 3)
                if (currentMode === 'ALZAIMER' && currentAlzaimerState && currentAlzaimerState.playerPieces) {
                    const pieces = currentAlzaimerState.playerPieces[val] || [];
                    const orderIndex = pieces.indexOf(idx);
                    if (orderIndex !== -1) {
                        const badge = document.createElement('span');
                        badge.className = 'cell-badge';
                        badge.textContent = `${orderIndex + 1}`;
                        cell.appendChild(badge);
                    }
                }
            }

            // Destaque de peça piscando/expirando no Alzaimer
            if (currentMode === 'ALZAIMER' && currentAlzaimerState && currentAlzaimerState.fadingPosition === idx) {
                cell.classList.add('fading');
            }

            // Destaque de linha vencedora
            if (winningLine && winningLine.includes(idx)) {
                cell.classList.add('winning-cell');
            }
        });
    }

    function renderInfiniteBoard(boardObj, isMyTurn, winningLine = null) {
        lastRenderedInfiniteBoard = boardObj || {};
        const moves = Object.keys(lastRenderedInfiniteBoard);

        // Calcula os limites (bounding box) com margem de segurança de 4 células em cada direção
        let minX = -4, maxX = 4, minY = -4, maxY = 4;

        if (moves.length > 0) {
            const xs = moves.map(k => parseInt(k.split(',')[0], 10));
            const ys = moves.map(k => parseInt(k.split(',')[1], 10));
            minX = Math.min(...xs) - 4;
            maxX = Math.max(...xs) + 4;
            minY = Math.min(...ys) - 4;
            maxY = Math.max(...ys) + 4;
        }

        const cols = maxX - minX + 1;
        const rows = maxY - minY + 1;

        infiniteCanvasGrid.style.gridTemplateColumns = `repeat(${cols}, 42px)`;
        infiniteCanvasGrid.innerHTML = '';

        // Cria mapa rápido para linha de vitória
        const winningSet = new Set();
        if (winningLine && Array.isArray(winningLine)) {
            winningLine.forEach(p => {
                if (typeof p === 'object') winningSet.add(`${p.x},${p.y}`);
                else winningSet.add(p);
            });
        }

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const key = `${x},${y}`;
                const val = lastRenderedInfiniteBoard[key];
                const cell = document.createElement('div');
                cell.className = 'infinite-cell';
                cell.setAttribute('data-x', x);
                cell.setAttribute('data-y', y);

                if (x === 0 && y === 0) cell.classList.add('center-cell');

                if (val) {
                    cell.textContent = getSymbolDisplay(val);
                    cell.classList.add('occupied');
                    if (val === 'X') cell.classList.add('x');
                    else if (val === 'O') cell.classList.add('o');
                    else if (val === '△') cell.classList.add('triangle');
                    else if (val === '☆') cell.classList.add('star');
                }

                if (winningSet.has(key)) {
                    cell.classList.add('winning-cell');
                }

                // Hover para exibir coordenadas
                cell.addEventListener('mouseenter', () => {
                    infiniteCoordsHover.textContent = `Coord: (${x}, ${y})`;
                });

                // Clique na célula
                cell.addEventListener('click', () => {
                    if (hasDragged) return; // Evita registrar clique se estava apenas arrastando
                    if (!val && isMyTurn && currentRoomCode && mySymbol) {
                        window.socket.send('MOVE', {
                            roomCode: currentRoomCode,
                            position: { x, y },
                            playerSymbol: mySymbol
                        });
                    }
                });

                infiniteCanvasGrid.appendChild(cell);
            }
        }
    }

    function showGameOverModal(data) {
        btnRematch.disabled = false;
        btnRematch.querySelector('span').textContent = '🔄 SOLICITAR REVANCHE [WS]';
        modalWaitingText.style.display = 'none';

        summaryMode.textContent = formatModeName(data.mode || currentMode);

        if (data.isDraw) {
            modalResultTitle.textContent = '🤝 EMPATE!';
            modalResultSub.textContent = 'Ninguém conseguiu a sequência de vitória.';
            summaryWinner.textContent = 'Nenhum (Empate)';
        } else if (data.winner === myPlayerName) {
            modalResultTitle.textContent = '🏆 VITÓRIA! VOCÊ VENCEU!';
            const winReq = (data.mode === 'INFINITO' || data.mode === 'WARZONE') ? 5 : 3;
            modalResultSub.textContent = `Você alinhou ${winReq} símbolos '${getSymbolDisplay(data.winnerSymbol)}' com sucesso!`;
            summaryWinner.textContent = `${data.winner} (${getSymbolDisplay(data.winnerSymbol)})`;
        } else {
            modalResultTitle.textContent = '💀 DERROTA!';
            modalResultSub.textContent = `O jogador ${data.winner || 'Oponente'} alinhou os símbolos primeiro.`;
            summaryWinner.textContent = `${data.winner || 'Oponente'} (${getSymbolDisplay(data.winnerSymbol)})`;
        }

        // Resumo de Placar
        if (data.players && Array.isArray(data.players)) {
            summaryScoreList.innerHTML = '';
            data.players.forEach(p => {
                const item = document.createElement('div');
                item.className = 'summary-score-item';
                item.innerHTML = `<span>${getSymbolDisplay(p.simbolo)} ${escapeHtml(p.nickname)}:</span> <b>${p.score || 0} vitórias</b>`;
                summaryScoreList.appendChild(item);
            });
        } else {
            summaryScoreList.innerHTML = `<strong class="highlight-score">${data.hostName || 'Host'} ${data.placarHost || 0} x ${data.placarVisitante || 0} ${data.visitanteName || 'Visitante'}</strong>`;
        }

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

    function switchToArena() {
        lobbyScreen.classList.remove('active');
        arenaScreen.classList.add('active');
    }

    function formatModeName(mode) {
        switch (mode) {
            case 'CLASSICO': return 'Clássico 3x3';
            case 'INFINITO': return 'Infinito (Faça 5)';
            case 'ALZAIMER': return 'Alzaimer (3 Peças)';
            case 'WARZONE': return 'War Zone';
            default: return mode || 'Clássico';
        }
    }

    function getSymbolDisplay(sym) {
        switch (sym) {
            case 'X': return '❌';
            case 'O': return '⭕';
            case '△': return '🔺';
            case '☆': return '⭐';
            default: return sym;
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
