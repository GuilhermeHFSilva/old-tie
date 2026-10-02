import { insertRecord, queryCollection, updateRecord } from '../config/db.js';

export const partidaRepo = {
    async criar(salaId, placarHost = 0, placarVisitante = 0) {
        return await insertRecord('partidas', {
            id_sala: salaId,
            id_vencedor: null,
            simbolo_turno_atual: 'X',
            placar_host: placarHost,
            placar_visitante: placarVisitante,
            status_resultado: 'EM_ANDAMENTO', // EM_ANDAMENTO, VITORIA_HOST, VITORIA_VISITANTE, EMPATE
            data_hora_inicio: new Date().toISOString()
        });
    },

    async finalizar(partidaId, vencedorId, statusResultado, placarHost, placarVisitante) {
        return await updateRecord('partidas', p => p.id === Number(partidaId), {
            id_vencedor: vencedorId,
            status_resultado: statusResultado,
            placar_host: placarHost,
            placar_visitante: placarVisitante
        });
    },

    async buscarPorId(id) {
        const results = await queryCollection('partidas', p => p.id === Number(id));
        return results[0] || null;
    }
};
