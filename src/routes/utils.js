// routes/utils.js

/**
 * Calcula o "Dia Operacional" para evitar a virada do dia (00:00 UTC)
 * que ocorre às 21:00 (GMT-3) no Brasil.
 * * Definimos que o dia operacional começa às 05:00 UTC (02:00 GMT-3),
 * que é um horário seguro onde não há eventos na igreja.
 * * O dia operacional, portanto, vai das 05:00 UTC de "hoje" 
 * até 04:59:59 UTC de "amanhã".
 */
function getOperationalDayUTC() {
    const agoraUTC = new Date();
    const inicioDiaUTC = new Date(agoraUTC);
    
    // Define o "início do dia" como 05:00 UTC 
    inicioDiaUTC.setUTCHours(5, 0, 0, 0);

    // Se agora (UTC) for antes das 5 da manhã UTC, 
    // o dia operacional ainda é o de "ontem".
    // Ex: Se for 04:00 UTC, o início do dia deve ser 05:00 UTC do dia anterior.
    if (agoraUTC < inicioDiaUTC) {
        inicioDiaUTC.setUTCDate(inicioDiaUTC.getUTCDate() - 1);
    }

    // O fim do dia é exatamente 24h depois do início 
    // (ex: 05:00 UTC do dia seguinte)
    const fimDiaUTC = new Date(inicioDiaUTC);
    fimDiaUTC.setUTCDate(fimDiaUTC.getUTCDate() + 1);

    return { 
        inicio: inicioDiaUTC.toISOString(), 
        fim: fimDiaUTC.toISOString() 
    };
}

// Exporta a função para ser usada nas rotas
module.exports = { getOperationalDayUTC };
