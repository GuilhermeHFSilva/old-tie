/**
 * Controller da Tela 1 (Lobby Principal & Seleção de Salas - Figura 2 & 3)
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

    // Recupera apelido salvo
    const savedNick = localStorage.getItem('velha_nickname');
    if (savedNick) {
        nicknameInput.value = savedNick;
    }

    // Status Conexão
    window.socket.on('connection_change', (data) => {
        if (data.status === 'online') {
            connectionStatus.className = 'connection-status online';
            connectionStatus.querySelector('.status-text').textContent = 'SERVIDOR ONLINE';
        } else {
            connectionStatus.className = 'connection-status offline';
            connectionStatus.querySelector('.status-text').textContent = 'DESCONECTADO';
        }
    });

    // Partida Rápida (Matchmaking)
    btnQuickMatch.addEventListener('click', () => {
        const playerName = getPlayerName();
        if (!playerName) return;
        window.socket.send('JOIN_ROOM', { playerName, roomCode: null });
    });

    // Criar Sala Privada
    btnCreatePrivate.addEventListener('click', () => {
        const playerName = getPlayerName();
        if (!playerName) return;
        window.socket.send('JOIN_ROOM', { playerName, roomCode: null });
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
                    <td colspan="4" class="empty-list">Nenhuma sala ativa no momento. Clique em Criar Sala!</td>
                </tr>
            `;
            return;
        }

        roomsTableBody.innerHTML = '';
        salas.forEach(sala => {
            const tr = document.createElement('tr');
            const isFull = sala.id_jogador_visitante !== null;
            const vagasClass = isFull ? 'vagas-full' : 'vagas-tag';
            const vagasText = isFull ? '2/2 (Cheia)' : '1/2 (Entrar ↵)';

            tr.innerHTML = `
                <td><b>${sala.codigo_sala}</b></td>
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

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }
});
