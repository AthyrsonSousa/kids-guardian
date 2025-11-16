// registrosRoutes.js
const express = require('express');
const { supabase } = require('../index');
const { authenticateToken } = require('./authRoutes'); // Importa o middleware de autenticação
// ⬇️ *** ADIÇÃO ***
// Importa a nova função do utilitário
const { getOperationalDayUTC } = require('./utils'); 

const router = express.Router();

// Middleware de autorização para verificar tipo de usuário
const authorizeUser = (req, res, next) => {
    if (!['administrador', 'voluntario'].includes(req.user.tipo)) {
        return res.status(403).json({ success: false, message: 'Acesso negado: Somente administradores ou voluntários podem realizar esta operação.' });
    }
    next();
};

// Check-in de criança
router.post('/registros/checkin', authenticateToken, authorizeUser, async (req, res) => {
    const { crianca_id } = req.body;
    const usuario_id = req.user.id; // ID do usuário que fez o check-in

    if (!crianca_id) {
        return res.status(400).json({ success: false, message: 'ID da criança é obrigatório para check-in.' });
    }

    try {
        // Verificar se a criança já está presente (tem um check-in sem check-out)
        const { data: lastCheckInEntry, error: checkInEntryError } = await supabase
            .from('registros')
            .select('id, tipo, data_hora')
            .eq('crianca_id', crianca_id)
            .order('data_hora', { ascending: false })
            .limit(1)
            .single();

        if (checkInEntryError && checkInEntryError.code !== 'PGRST116') { // 'PGRST116' significa que não encontrou nenhum registro
            console.error("Erro Supabase ao verificar último check-in:", checkInEntryError);
            return res.status(500).json({ success: false, message: 'Erro ao verificar status de check-in da criança.' });
        }

        // Se encontrou um registro e é um 'check-in' sem um 'check-out' subsequente
        if (lastCheckInEntry && lastCheckInEntry.tipo === 'check-in') {
            // Agora verifica se existe um check-out posterior ao último check-in
            const { data: lastCheckOutEntry, error: checkOutEntryError } = await supabase
                .from('registros')
                .select('id, data_hora')
                .eq('crianca_id', crianca_id)
                .eq('tipo', 'check-out')
                .gte('data_hora', lastCheckInEntry.data_hora) // Check-out posterior ou igual ao último check-in
                .order('data_hora', { ascending: false })
                .limit(1)
                .single();

            if (checkOutEntryError && checkOutEntryError.code !== 'PGRST116') {
                console.error("Erro Supabase ao verificar último check-out:", checkOutEntryError);
                return res.status(500).json({ success: false, message: 'Erro ao verificar status de check-out da criança.' });
            }

            // Se o último registro é um check-in e não há check-out posterior a ele, a criança está presente
            if (!lastCheckOutEntry || new Date(lastCheckOutEntry.data_hora) < new Date(lastCheckInEntry.data_hora)) {
                return res.status(409).json({ success: false, message: 'Criança já está presente.' });
            }
        }


        const { data, error } = await supabase
            .from('registros')
            .insert([{ crianca_id, usuario_id, tipo: 'check-in' }]);

        if (error) {
            console.error("Erro Supabase ao registrar check-in:", error);
            return res.status(500).json({ success: false, message: 'Erro ao registrar check-in.' });
        }

        res.status(201).json({ success: true, message: 'Check-in registrado com sucesso.' });

    } catch (error) {
        console.error('Erro no check-in:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// Check-out de criança
router.post('/registros/checkout', authenticateToken, authorizeUser, async (req, res) => {
    const { crianca_id } = req.body;
    const usuario_id = req.user.id; // ID do usuário que fez o check-out

    if (!crianca_id) {
        return res.status(400).json({ success: false, message: 'ID da criança é obrigatório para check-out.' });
    }

    try {
        // Verificar se a criança está presente (tem um check-in sem check-out)
        const { data: lastCheckInEntry, error: checkInEntryError } = await supabase
            .from('registros')
            .select('id, tipo, data_hora')
            .eq('crianca_id', crianca_id)
            .eq('tipo', 'check-in')
            .order('data_hora', { ascending: false })
            .limit(1)
            .single();

        if (checkInEntryError && checkInEntryError.code !== 'PGRST116') {
            console.error("Erro Supabase ao verificar último check-in para check-out:", checkInEntryError);
            return res.status(500).json({ success: false, message: 'Erro ao verificar status de check-in para check-out.' });
        }

        if (!lastCheckInEntry || lastCheckInEntry.tipo !== 'check-in') {
            return res.status(409).json({ success: false, message: 'Criança não tem um check-in ativo para realizar check-out.' });
        }

        // Agora verifica se já existe um check-out posterior ao último check-in
        const { data: lastCheckOutEntry, error: checkOutEntryError } = await supabase
            .from('registros')
            .select('id, data_hora')
            .eq('crianca_id', crianca_id)
            .eq('tipo', 'check-out')
            .gte('data_hora', lastCheckInEntry.data_hora) // Check-out posterior ou igual ao último check-in
            .order('data_hora', { ascending: false })
            .limit(1)
            .single();

        // Se existe um check-out posterior ou igual ao último check-in, a criança já saiu
        if (lastCheckOutEntry && new Date(lastCheckOutEntry.data_hora) >= new Date(lastCheckInEntry.data_hora)) {
            return res.status(409).json({ success: false, message: 'Criança já realizou check-out ou não está presente.' });
        }


        const { data, error } = await supabase
            .from('registros')
            .insert([{ crianca_id, usuario_id, tipo: 'check-out' }]);

        if (error) {
            console.error("Erro Supabase ao registrar check-out:", error);
            return res.status(500).json({ success: false, message: 'Erro ao registrar check-out.' });
        }

        res.status(201).json({ success: true, message: 'Check-out registrado com sucesso.' });

    } catch (error) {
        console.error('Erro no check-out:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// Obter estatísticas do dashboard
router.get('/registros/estatisticas', authenticateToken, authorizeUser, async (req, res) => {
    try {
        // const today = new Date().toISOString().split('T')[0]; // ⬅️ *** LINHA ANTIGA REMOVIDA ***

        // ⬇️ *** CORREÇÃO ***
        // Usa a função de utilitário para definir o dia operacional
        const { inicio: hojeInicio, fim: hojeFim } = getOperationalDayUTC();

        // Total de crianças cadastradas
        const { count: totalCriancasCadastradas, error: countError } = await supabase
            .from('criancas')
            .select('*', { count: 'exact' });

        if (countError) throw countError;

        // Buscando todos os check-ins do dia
        const { data: checkInsDoDia, error: checkInError } = await supabase
            .from('registros')
            .select('crianca_id, data_hora')
            .eq('tipo', 'check-in')
            // ⬇️ *** LINHAS CORRIGIDAS ***
            .gte('data_hora', hojeInicio)
            .lt('data_hora', hojeFim);

        if (checkInError) throw checkInError;

        // Buscando todos os check-outs do dia
        const { data: checkOutsDoDia, error: checkOutError } = await supabase
            .from('registros')
            .select('crianca_id, data_hora')
            .eq('tipo', 'check-out')
            // ⬇️ *** LINHAS CORRIGIDAS ***
            .gte('data_hora', hojeInicio)
            .lt('data_hora', hojeFim);

        if (checkOutError) throw checkOutError;

        // Total de eventos de check-in no dia
        const totalCheckInsHoje = checkInsDoDia.length;

        // Total de eventos de check-out no dia
        const totalCheckOutsHoje = checkOutsDoDia.length;

        // Crianças que fizeram check-in e ainda não fizeram check-out (consideradas "presentes hoje")
        const criancasAindaPresentes = new Set();
        checkInsDoDia.forEach(checkIn => {
            const checkOutCorresp = checkOutsDoDia.find(checkOut =>
                checkOut.crianca_id === checkIn.crianca_id && new Date(checkOut.data_hora) > new Date(checkIn.data_hora)
            );
            if (!checkOutCorresp) {
                criancasAindaPresentes.add(checkIn.crianca_id);
            }
        });
        const totalPresentesHojeCalculated = criancasAindaPresentes.size;


        res.json({
            success: true,
            totalCriancasCadastradas: totalCriancasCadastradas,          // Total geral de crianças cadastradas
            totalPresentesHoje: totalPresentesHojeCalculated,            // Crianças atualmente presentes (check-in sem check-out)
            totalCheckInsHoje: totalCheckInsHoje,                        // Total de eventos de check-in no dia
            totalCheckOutsHoje: totalCheckOutsHoje                       // Total de eventos de check-out no dia
        });

    } catch (error) {
        console.error('Erro ao obter estatísticas do dashboard:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao obter estatísticas.' });
    }
});


// Relatório do dia
router.get('/registros/relatorio-dia', authenticateToken, authorizeUser, async (req, res) => {
    const { data: selectedDate } = req.query; // Espera a data no formato YYYY-MM-DD

    if (!selectedDate) {
        return res.status(400).json({ success: false, message: 'Data é obrigatória para o relatório.' });
    }

    try {
        // Para 'get_daily_report', você deve ter uma função PL/pgSQL no Supabase
        // Certifique-se de que a função existe e retorna o formato esperado
        const { data, error } = await supabase.rpc('get_daily_report', { p_report_date: selectedDate });

        if (error) {
            console.error("Erro Supabase ao obter relatório:", error);
            // Se for um erro de função não encontrada, você pode dar um erro mais específico
            if (error.code === '42883') { // Código para função não encontrada
                 return res.status(500).json({ success: false, message: 'Erro: Função get_daily_report não encontrada no Supabase. Verifique sua criação.' });
            }
            return res.status(500).json({ success: false, message: 'Erro ao obter relatório do dia.' });
        }

        res.json({ success: true, relatorio: data });

    } catch (error) {
        console.error('Erro ao obter relatório:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

module.exports = router;
