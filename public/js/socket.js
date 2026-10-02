/**
 * WebSocket Connection Wrapper for Tic-Tac-Toe WS3
 */
class SocketClient {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.isConnected = false;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}`;

        console.log(`🔌 Conectando ao WebSocket: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket Conectado!');
            this.isConnected = true;
            this.emitLocal('connection_change', { status: 'online' });
            this.send('LIST_ROOMS', {});
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📩 WS Evento:', data.type, data.payload || data);
                this.emitLocal(data.type, data.payload || data);
            } catch (err) {
                console.error('Erro ao ler frame WS:', err);
            }
        };

        this.ws.onclose = () => {
            console.warn('❌ WebSocket Desconectado.');
            this.isConnected = false;
            this.emitLocal('connection_change', { status: 'offline' });
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('⚠️ Erro Socket:', err);
        };
    }

    send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WS não está aberto para envio:', type);
            return false;
        }
        // Envia tipo e payload juntos para total compatibilidade com PDF Listings 1 e 2
        this.ws.send(JSON.stringify({ type, ...payload }));
        return true;
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    emitLocal(type, data) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(cb => cb(data));
        }
    }
}

window.socket = new SocketClient();
window.addEventListener('DOMContentLoaded', () => {
    window.socket.connect();
});
