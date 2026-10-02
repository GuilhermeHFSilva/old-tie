import { insertRecord, queryCollection } from '../config/db.js';

export const jogadorRepo = {
    async criar(nickname, email = '') {
        return await insertRecord('jogadores', {
            nickname,
            email,
            vitorias_totais: 0,
            derrotas_totais: 0
        });
    },

    async buscarPorId(id) {
        const results = await queryCollection('jogadores', j => j.id === Number(id));
        return results[0] || null;
    },

    async buscarPorNickname(nickname) {
        const results = await queryCollection('jogadores', j => j.nickname.toLowerCase() === nickname.toLowerCase());
        return results[0] || null;
    }
};
