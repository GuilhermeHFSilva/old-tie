import { insertRecord, queryCollection } from '../config/db.js';

export const chatRepo = {
    async salvarMensagem(salaId, jogadorId, conteudoTexto) {
        return await insertRecord('mensagensChat', {
            id_sala: salaId,
            id_jogador_remetente: jogadorId,
            conteudo_texto: conteudoTexto,
            timestamp_envio: new Date().toISOString()
        });
    },

    async listarPorSala(salaId) {
        const msgs = await queryCollection('mensagensChat', m => m.id_sala === Number(salaId));
        const jogadores = await queryCollection('jogadores');

        return msgs.map(m => {
            const sender = jogadores.find(j => j.id === m.id_jogador_remetente);
            return {
                ...m,
                sender_nickname: sender ? sender.nickname : 'Jogador'
            };
        });
    }
};
