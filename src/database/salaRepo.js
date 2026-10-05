import { insertRecord, queryCollection, updateRecord } from '../config/db.js';

export const salaRepo = {
    async criar(codigo, nome, hostId, privada = false, modoJogo = 'CLASSICO', maxJogadores = 2) {
        return await insertRecord('salas', {
            codigo_sala: codigo,
            nome,
            id_jogador_host: hostId,
            id_jogador_visitante: null,
            privada,
            modo_jogo: modoJogo,
            max_jogadores: maxJogadores,
            status_sala: 'AGUARDANDO' // AGUARDANDO, EM_JOGO, FINALIZADA
        });
    },

    async buscarPorCodigo(codigo) {
        const results = await queryCollection('salas', s => s.codigo_sala === codigo);
        return results[0] || null;
    },

    async buscarPorId(id) {
        const results = await queryCollection('salas', s => s.id === Number(id));
        return results[0] || null;
    },

    async listarAtivas() {
        const salas = await queryCollection('salas', s => s.status_sala !== 'FINALIZADA');
        const jogadores = await queryCollection('jogadores');

        return salas.map(s => {
            const host = jogadores.find(j => j.id === s.id_jogador_host);
            const max = s.max_jogadores || 2;
            const isFull = s.id_jogador_visitante !== null && (max === 2 || s.status_sala === 'EM_JOGO');
            return {
                ...s,
                modo_jogo: s.modo_jogo || 'CLASSICO',
                max_jogadores: max,
                criador_nickname: host ? host.nickname : 'Desconhecido',
                vagas: isFull ? `${max}/${max} (Cheia)` : `1/${max} (Entrar)`
            };
        });
    },

    async atualizarStatus(id, status) {
        return await updateRecord('salas', s => s.id === Number(id), { status_sala: status });
    },

    async atualizarVisitante(id, visitanteId) {
        return await updateRecord('salas', s => s.id === Number(id), {
            id_jogador_visitante: visitanteId,
            status_sala: 'EM_JOGO'
        });
    }
};
