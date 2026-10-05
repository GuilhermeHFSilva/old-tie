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

# Executar suíte de testes automatizados (Unitários e E2E)
npm test
```

O servidor iniciará em **`http://localhost:3000`**.

---

## 🕹️ Modos de Jogo Disponíveis

1. ⚡ **Clássico**:
   - Tabuleiro tradicional 3x3.
   - 2 jogadores (`X` e `O`).
   - Vitória: alinhar 3 símbolos (horizontal, vertical ou diagonal).

2. ♾️ **Infinito**:
   - Tabuleiro com **grid infinito** expansível com navegação panorâmica (drag/pan), zoom e botão de centralização.
   - 2 jogadores (`X` e `O`).
   - Vitória: **fazer 5 em linha** (não mais 3).

3. 🧠 **Alzaimer**:
   - Tabuleiro dinâmico 3x3.
   - 2 jogadores (`X` e `O`), com limite estrito de **3 peças ativas por jogador**.
   - Ao colocar a 4ª peça, a 1ª (mais antiga) é automaticamente removida.
   - Enquanto é a vez do jogador, a sua peça prestes a sumir **fica piscando** com aviso visual e o jogador **não pode colocar na mesma casa** da peça que será removida.
   - Cada peça exibe seu número de ordem (1, 2, 3) facilitando o raciocínio tático.
   - Vitória: alinhar 3 símbolos ativos.

4. ⚔️ **War Zone**:
   - Grid infinito aberto com múltiplos jogadores (3 a 4 participantes).
   - Símbolos e cores exclusivas para cada jogador:
     - Jogador 1 (Host): ❌ `X` (Azul Claro)
     - Jogador 2: ⭕ `O` (Coral/Vermelho)
     - Jogador 3: 🔺 `△` (Verde Esmeralda)
     - Jogador 4: ⭐ `☆` (Âmbar/Dourado)
   - Rotação dinâmica de turnos e placar individual em tempo real.
   - O anfitrião pode iniciar a partida a qualquer momento assim que houver 2 ou mais jogadores no lobby.
   - Vitória: **fazer 5 em linha** com o seu próprio símbolo.

---

## 📊 Tabelas do Banco de Dados (`database/schema.sql`)

1. **`JOGADOR`**: `id`, `nickname`, `created_at`
2. **`SALA_JOGO`**: `id`, `codigo`, `nome`, `modo_jogo`, `max_jogadores`, `status`, `criador_id`, `created_at`
3. **`PARTIDA`**: `id`, `sala_id`, `jogador_x_id`, `jogador_o_id`, `vencedor_id`, `status`, `created_at`
4. **`JOGADA`**: `id`, `partida_id`, `jogador_id`, `posicao`, `simbolo`, `numero_jogada`, `created_at`
5. **`MENSAGEM_CHAT`**: `id`, `sala_id`, `jogador_id`, `mensagem`, `created_at`

---

## 🌐 Protocolo de Eventos WebSocket

| Evento Enviado | Descrição |
|---|---|
| `CREATE_ROOM` / `JOIN_ROOM` | Cria ou entra em sala informando `playerName`, `roomCode`, `gameMode` e `maxPlayers` |
| `START_GAME` | Inicia partida antecipadamente (anfitrião no modo War Zone) |
| `LIST_ROOMS` | Solicita a lista de salas ativas com modo e vagas |
| `MOVE` | Envia jogada: índice (0-8) para 3x3 ou coordenadas `{ x, y }` para grid infinito |
| `CHAT_MESSAGE` | Transmite uma mensagem de chat para os jogadores da sala |
| `NEW_GAME` | Solicita revanche ao fim de uma partida |
