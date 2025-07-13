const express = require('express');
const { supabase } = require('../index');
const { authenticateToken } = require('./authRoutes');
const { authorizeAdmin } = require('./usuariosRoutes');

const router = express.Router();

// Middleware de autorização para administradores ou voluntários
const authorizeUser = (req, res, next) => {
  if (!['administrador', 'voluntario'].includes(req.user.tipo)) {
    return res.status(403).json({ success: false, message: 'Acesso negado: Somente administradores ou voluntários podem realizar esta operação.' });
  }
  next();
};

// Cadastrar nova criança
router.post('/criancas/cadastrar', authenticateToken, authorizeUser, async (req, res) => {
  const { nome, nome_responsavel, numero_responsavel, idade, sala, observacoes } = req.body;

  if (!nome || !nome_responsavel || !numero_responsavel || !idade || !sala) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
  }

  if (![1, 2, 3, 4].includes(parseInt(sala))) {
    return res.status(400).json({ success: false, message: 'Sala inválida. Deve ser 1, 2, 3 ou 4.' });
  }

  try {
    const { error } = await supabase
      .from('criancas')
      .insert([{ nome, nome_responsavel, numero_responsavel, idade, sala, observacoes }]);

    if (error) {
      console.error("Erro Supabase ao cadastrar criança:", error);
      return res.status(500).json({ success: false, message: 'Erro ao cadastrar criança.' });
    }

    res.status(201).json({ success: true, message: 'Criança cadastrada com sucesso!' });
  } catch (error) {
    console.error('Erro ao cadastrar criança:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// Listar todas as crianças ativas
router.get('/criancas', authenticateToken, authorizeUser, async (req, res) => {
  try {
    const { data: criancas, error } = await supabase
      .from('criancas')
      .select('*')
      .eq('is_active', true)
      .order('nome', { ascending: true });

    if (error) {
      console.error("Erro Supabase ao listar crianças:", error);
      return res.status(500).json({ success: false, message: 'Erro ao listar crianças.' });
    }

    res.json({ success: true, criancas });
  } catch (error) {
    console.error('Erro ao listar crianças:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
});

// Desativar criança (apenas administradores)
router.delete('/criancas/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const criancaIdNumerico = parseInt(id, 10);

    const { data, error } = await supabase
      .from('criancas')
      .update({ is_active: false })
      .eq('id', criancaIdNumerico)
      .select();

    if (error) {
      console.error("Erro Supabase ao desativar criança:", error);
      return res.status(500).json({ success: false, message: 'Erro ao desativar criança.' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: 'Criança não encontrada para desativar.' });
    }

    res.json({ success: true, message: 'Criança desativada com sucesso.' });
  } catch (error) {
    console.error('Erro ao desativar criança:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor ao desativar criança.' });
  }
});

// Listar crianças disponíveis para check-in (não estão presentes hoje)
router.get('/criancas/checkin', authenticateToken, authorizeUser, async (req, res) => {
  try {
    const hoje = new Date();
    const hojeInicio = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
    const hojeFim = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();

    // Buscar todos os check-ins do dia
    const { data: checkInsHoje, error: erroCheckIns } = await supabase
      .from('registros')
      .select('crianca_id, data_hora')
      .gte('data_hora', hojeInicio)
      .lte('data_hora', hojeFim)
      .eq('tipo', 'check-in');

    if (erroCheckIns) throw erroCheckIns;

    // Buscar todos os check-outs do dia
    const { data: checkOutsHoje, error: erroCheckOuts } = await supabase
      .from('registros')
      .select('crianca_id, data_hora')
      .gte('data_hora', hojeInicio)
      .lte('data_hora', hojeFim)
      .eq('tipo', 'check-out');

    if (erroCheckOuts) throw erroCheckOuts;

    // Identificar crianças presentes (que fizeram check-in sem check-out posterior)
    const presentesHoje = checkInsHoje.filter(checkIn => {
      const temCheckOutDepois = checkOutsHoje.some(checkOut =>
        checkOut.crianca_id === checkIn.crianca_id && new Date(checkOut.data_hora) > new Date(checkIn.data_hora)
      );
      return !temCheckOutDepois;
    }).map(c => c.crianca_id);

    // Buscar crianças ativas que não estão presentes hoje
    const { data: criancas, error } = await supabase
      .from('criancas')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(${presentesHoje.length > 0 ? presentesHoje.join(',') : 0})`)
      .order('nome', { ascending: true });

    if (error) throw error;

    res.json({ success: true, criancas });

  } catch (error) {
    console.error('Erro ao buscar crianças para check-in:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar crianças para check-in.' });
  }
});

// Listar crianças disponíveis para check-out (já fizeram check-in hoje e ainda não fizeram check-out)
router.get('/criancas/checkout', authenticateToken, authorizeUser, async (req, res) => {
  try {
    const hoje = new Date();
    const hojeInicio = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
    const hojeFim = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();

    // Buscar todos os check-ins do dia
    const { data: presentesHoje, error: erroCheckin } = await supabase
      .from('registros')
      .select('crianca_id')
      .gte('data_hora', hojeInicio)
      .lte('data_hora', hojeFim)
      .eq('tipo', 'check-in');

    if (erroCheckin) throw erroCheckin;

    const idsPresentes = presentesHoje.map(r => r.crianca_id);

    if (idsPresentes.length === 0) {
      return res.json({ success: true, criancas: [] });
    }

    // Buscar crianças ativas que estão presentes (fizeram check-in)
    const { data: criancas, error } = await supabase
      .from('criancas')
      .select('*')
      .eq('is_active', true)
      .in('id', idsPresentes)
      .order('nome', { ascending: true });

    if (error) throw error;

    res.json({ success: true, criancas });
  } catch (error) {
    console.error('Erro ao buscar crianças para check-out:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar crianças para check-out.' });
  }
});

module.exports = router;
