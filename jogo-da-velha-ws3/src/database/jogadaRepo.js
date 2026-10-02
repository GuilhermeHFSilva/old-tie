import { insertRecord, queryCollection } from '../config/db.js';

export const jogadaRepo = {
    async registrar(partidaId, jogadorId, posicaoCelula, simbolo) {
        return await insertRecord('jogadas', {
            id_partida: partidaId,
            id_jogador: jogadorId,
            posicao_celula: posicaoCelula,
            simbolo,
            timestamp_jogada: new Date().toISOString()
        });
    },

    async listarPorPartida(partidaId) {
        return await queryCollection('jogadas', j => j.id_partida === Number(partidaId));
    }
};
