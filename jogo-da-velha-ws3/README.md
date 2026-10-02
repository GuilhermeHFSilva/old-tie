# 🎮 Jogo da Velha WS3 - Realtime Multiplayer

Aplicação de Jogo da Velha multiplayer em tempo real construída com **Node.js**, **Express**, **WebSockets (`ws`)** e **SQLite**.

---

## 📁 Estrutura do Projeto

```
jogo-da-velha-ws3/
├── database/                    # Scripts SQL de criação e sementes
│   └── schema.sql               # DDL das 5 tabelas (JOGADOR, SALA_JOGO, etc.)
│
├── public/                      # Frontend estático ("Cliente Burro")
│   ├── css/
│   │   ├── style.css            # Estilos globais e componentes
│   │   └── arena.css            # Tabuleiro 3x3, chat e modais
│   ├── js/
│   │   ├── socket.js            # Inicialização e wrapper do WebSocket
│   │   ├── lobby.js             # Lógica da Tela 1 (criar/entrar em sala)
│   │   └── arena.js             # Lógica da Tela 2 e 3 (tabuleiro, chat, modal)
│   ├── img/                     # Favicons e ícones
│   └── index.html               # SPA principal
│
├── src/                         # Backend (Node.js)
│   ├── config/
│   │   └── db.js                # Conexão e inicialização com SQLite
│   │
│   ├── database/                # Camada de Acesso a Dados (Repositórios/Modelos)
│   │   ├── jogadorRepo.js       # Operações da tabela JOGADOR
│   │   ├── salaRepo.js          # Operações da tabela SALA_JOGO
│   │   ├── partidaRepo.js       # Operações da tabela PARTIDA
│   │   ├── jogadaRepo.js        # Operações da tabela JOGADA
│   │   └── chatRepo.js          # Operações da tabela MENSAGEM_CHAT
│   │
│   ├── game/                    # Motor de Regras e Estado em Memória
│   │   ├── GameEngine.js        # Validação de jogadas e das 8 linhas de vitória
│   │   └── RoomManager.js       # Gerenciador de salas ativas e jogadores
│   │
│   ├── websocket/               # Camada de Comunicação em Tempo Real
│   │   ├── handlers/
│   │   │   ├── roomHandler.js   # Eventos: JOIN_ROOM, CREATE_ROOM, disconnect
│   │   │   ├── moveHandler.js   # Eventos: MOVE, verificação de vez
│   │   │   ├── chatHandler.js   # Evento: CHAT / CHAT_MESSAGE
│   │   │   └── matchHandler.js  # Evento: NEW_GAME (revanche)
│   │   └── router.js            # Roteador central de mensagens WebSocket
│   │
│   └── app.js                   # Configuração do Express e arquivos estáticos
│
├── .env                         # Variáveis de ambiente (PORT, DB_PATH)
├── .gitignore                   # Arquivos ignorados pelo Git
├── package.json                 # Dependências e scripts do projeto
├── server.js                    # Ponto de entrada (inicia HTTP + WebSocket Server)
└── README.md                    # Instruções do projeto
```

---

## ⚡ Como Executar

### 1. Requisitos
- Node.js v18 ou superior

### 2. Instalar Dependências
```bash
npm install
```

### 3. Iniciar o Servidor
```bash
# Modo de produção
npm start

# Modo de desenvolvimento com auto-reload
npm run dev
```

O servidor iniciará em **`http://localhost:3000`**. O banco SQLite será inicializado automaticamente com as 5 tabelas em `database/game.sqlite`.

---

## 📊 Tabelas do Banco de Dados (`database/schema.sql`)

1. **`JOGADOR`**: `id`, `nickname`, `created_at`
2. **`SALA_JOGO`**: `id`, `codigo`, `nome`, `status`, `criador_id`, `created_at`
3. **`PARTIDA`**: `id`, `sala_id`, `jogador_x_id`, `jogador_o_id`, `vencedor_id`, `status`, `created_at`
4. **`JOGADA`**: `id`, `partida_id`, `jogador_id`, `posicao`, `simbolo`, `numero_jogada`, `created_at`
5. **`MENSAGEM_CHAT`**: `id`, `sala_id`, `jogador_id`, `mensagem`, `created_at`

---

## 🌐 Protocolo de Eventos WebSocket

| Evento Enviado | Descrição |
|---|---|
| `CREATE_ROOM` | Cria uma nova sala com `nickname` e `nomeSala` |
| `JOIN_ROOM` | Entra em uma sala existente via `codigo` de 6 caracteres |
| `LIST_ROOMS` | Solicita a lista de salas ativas |
| `MOVE` | Envia uma jogada informando a posição (0 a 8) |
| `CHAT_MESSAGE` | Transmite uma mensagem de chat para os jogadores da sala |
| `NEW_GAME` | Solicita uma revanche ao fim de uma partida |
