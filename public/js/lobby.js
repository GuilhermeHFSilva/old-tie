/**
 * @file lobby.js
 * Controller da Tela 1 (Lobby Principal, Seleção de Modo de Jogo & Listagem de Salas)
 */
document.addEventListener('DOMContentLoaded', () => {
    const nicknameInput = document.getElementById('nickname-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const btnQuickMatch = document.getElementById('btn-quick-match');
    const btnCreatePrivate = document.getElementById('btn-create-private');
    const btnJoinCode = document.getElementById('btn-join-code');
    const btnRefreshRooms = document.getElementById('btn-refresh-rooms');
    const roomsTableBody = document.getElementById('rooms-table-body');
    const connectionStatus = document.getElementById('connection-status');
    const modeCards = document.querySelectorAll('.mode-card');
    const warzoneOptionsGroup = document.getElementById('warzone-options-group');
    const warzoneMaxPlayersSelect = document.getElementById('warzone-max-players');
    const quickMatchDesc = document.getElementById('quick-match-desc');

    let selectedMode = 'CLASSICO';

    // Recupera apelido salvo
    const savedNick = localStorage.getItem('velha_nickname');
    if (savedNick) {
        nicknameInput.value = savedNick;
    }

    // Seleção de Modos de Jogo
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            modeCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedMode = card.getAttribute('data-mode') || 'CLASSICO';

            if (selectedMode === 'WARZONE') {
                warzoneOptionsGroup.style.display = 'block';
            } else {
                warzoneOptionsGroup.style.display = 'none';
            }

            updateQuickMatchDescription(selectedMode);
        });
    });

    function updateQuickMatchDescription(mode) {
        switch (mode) {
            case 'CLASSICO':
                quickMatchDesc.textContent = 'Encontra ou cria sala no modo Clássico 3x3';
                break;
            case 'INFINITO':
                quickMatchDesc.textContent = 'Encontra ou cria sala no Grid Infinito (Faça 5)';
                break;
            case 'ALZAIMER':
                quickMatchDesc.textContent = 'Encontra ou cria sala no modo Alzaimer (3 peças ativas)';
                break;
            case 'WARZONE':
                quickMatchDesc.textContent = 'Encontra ou cria sala na War Zone (Multijogador)';
                break;
            default:
                quickMatchDesc.textContent = 'Encontra ou cria sala no modo selecionado';
                break;
        }
    }

    // Status da Conexão
    window.socket.on('connection_change', (data) => {
        if (data.status === 'online') {
            connectionStatus.className = 'connection-status online';
            connectionStatus.querySelector('.status-text').textContent = 'SERVIDOR ONLINE';
        } else {
            connectionStatus.className = 'connection-status offline';
            connectionStatus.querySelector('.status-text').textContent = 'DESCONECTADO';
        }
    });

    // Partida Rápida
    btnQuickMatch.addEventListener('click', () => {
        const playerName = getPlayerName();
        if (!playerName) return;

        const maxPlayers = selectedMode === 'WARZONE' ? parseInt(warzoneMaxPlayersSelect.value, 10) : 2;
        window.socket.send('JOIN_ROOM', {
            playerName,
            roomCode: null,
            gameMode: selectedMode,
            maxPlayers
        });
    });

    // Modo Solo (vs CPU)
    const btnPlayCpu = document.getElementById('btn-play-cpu');
    if (btnPlayCpu) {
        btnPlayCpu.addEventListener('click', () => {
            const playerName = getPlayerName();
            if (!playerName) return;

            window.socket.send('JOIN_ROOM', {
                playerName,
                roomCode: null,
                gameMode: selectedMode,
                isCpu: true
            });
        });
    }

    // Criar Sala
    btnCreatePrivate.addEventListener('click', () => {
        const playerName = getPlayerName();
        if (!playerName) return;

        const maxPlayers = selectedMode === 'WARZONE' ? parseInt(warzoneMaxPlayersSelect.value, 10) : 2;
        window.socket.send('JOIN_ROOM', {
            playerName,
            roomCode: null,
            gameMode: selectedMode,
            maxPlayers
        });
    });

    // Entrar por Código
    btnJoinCode.addEventListener('click', () => {
        const playerName = getPlayerName();
        if (!playerName) return;

        const roomCode = roomCodeInput.value.trim().toUpperCase();
        if (!roomCode) return alert('Por favor, digite o código de 6 caracteres da sala.');

        window.socket.send('JOIN_ROOM', { playerName, roomCode });
    });

    // Atualizar Lista
    btnRefreshRooms.addEventListener('click', () => {
        window.socket.send('LIST_ROOMS', {});
    });

    // Evento WS: Lista de Salas
    window.socket.on('ROOM_LIST', (data) => {
        renderRoomsTable(data.salas || []);
    });

    function getPlayerName() {
        const name = nicknameInput.value.trim();
        if (!name) {
            alert('Por favor, informe seu apelido de jogador.');
            nicknameInput.focus();
            return null;
        }
        localStorage.setItem('velha_nickname', name);
        return name;
    }

    function renderRoomsTable(salas) {
        if (!salas || salas.length === 0) {
            roomsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-list">Nenhuma sala ativa no momento. Escolha o modo e crie uma sala!</td>
                </tr>
            `;
            return;
        }

        roomsTableBody.innerHTML = '';
        salas.forEach(sala => {
            const tr = document.createElement('tr');
            const modo = sala.modo_jogo || 'CLASSICO';
            const maxPlayers = sala.max_jogadores || 2;
            const isFull = sala.status_sala === 'EM_JOGO' || (sala.vagas && sala.vagas.includes('Cheia'));
            const vagasClass = isFull ? 'vagas-full' : 'vagas-tag';
            const vagasText = isFull ? `${maxPlayers}/${maxPlayers} (Cheia)` : (sala.vagas || `1/${maxPlayers}`);

            tr.innerHTML = `
                <td><b>${sala.codigo_sala}</b></td>
                <td><span class="mode-badge-tag mode-badge-${modo}">${formatModeName(modo)}</span></td>
                <td>${escapeHtml(sala.criador_nickname || 'Host')}</td>
                <td><span class="${vagasClass}">${vagasText}</span></td>
                <td>
                    ${!isFull ? `
                        <button class="btn btn-primary btn-sm" onclick="joinPublicRoom('${sala.codigo_sala}')">
                            Entrar
                        </button>
                    ` : '<span class="text-muted">-</span>'}
                </td>
            `;
            roomsTableBody.appendChild(tr);
        });
    }

    window.joinPublicRoom = (roomCode) => {
        const playerName = getPlayerName();
        if (!playerName) return;
        window.socket.send('JOIN_ROOM', { playerName, roomCode });
    };

    function formatModeName(mode) {
        switch (mode) {
            case 'CLASSICO': return 'Clássico';
            case 'INFINITO': return 'Infinito';
            case 'ALZAIMER': return 'Alzaimer';
            case 'WARZONE': return 'War Zone';
            default: return mode || 'Clássico';
        }
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
