// usuariosRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../index');
const { authenticateToken } = require('./authRoutes'); // Importa o middleware de autenticação

const router = express.Router();

// Middleware de autorização para administradores
const authorizeAdmin = (req, res, next) => {
    if (req.user.tipo !== 'administrador') {
        return res.status(403).json({ success: false, message: 'Acesso negado: Somente administradores podem realizar esta operação.' });
    }
    next();
};

// Cadastrar novo usuário (apenas administradores)
// Cadastrar novo usuário (apenas administradores)
router.post('/usuarios/cadastrar', authenticateToken, authorizeAdmin, async (req, res) => {
    const { nome, tipo, senha } = req.body;

    if (!nome || !tipo || !senha) {
        return res.status(400).json({ success: false, message: 'Nome, tipo e senha são obrigatórios.' });
    }
    if (!['administrador', 'voluntario'].includes(tipo)) {
        return res.status(400).json({ success: false, message: 'Tipo de usuário inválido.' });
    }

    try {
        // Verificar se o usuário já existe
        const { data: existingUser, error: findError } = await supabase
            .from('usuarios')
            .select('id')
            .eq('nome', nome)
            .single(); // Usando .single() aqui

        // Log para depuração
        console.log("DEBUG: Resultado da busca por usuário existente:");
        console.log("  existingUser:", existingUser);
        console.log("  findError:", findError);

        // Se houver um erro e não for o erro "nenhuma linha encontrada", é um erro real do Supabase
        if (findError && findError.code !== 'PGRST116') {
            console.error("Erro Supabase ao verificar usuário existente:", findError);
            return res.status(500).json({ success: false, message: 'Erro ao verificar usuário existente.' });
        }

        // Se existingUser não for null, significa que um usuário com esse nome já existe
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Nome de usuário já existe.' });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        // Inserir novo usuário
        const { data, error: insertError } = await supabase
            .from('usuarios')
            .insert([{ nome, tipo, senha: hashedPassword }]);

        if (insertError) {
            console.error("Erro Supabase ao cadastrar usuário:", insertError);
            return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário.' });
        }

        res.status(201).json({ success: true, message: 'Usuário cadastrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar todos os usuários (apenas administradores)
router.get('/usuarios', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select('id, nome, tipo'); // Não retornar a senha

        if (error) {
            console.error("Erro Supabase ao listar usuários:", error);
            return res.status(500).json({ success: false, message: 'Erro ao listar usuários.' });
        }

        res.json({ success: true, usuarios });

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Remover usuário (apenas administradores)
router.delete('/usuarios/:id', authenticateToken, authorizeAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        // Impedir que o administrador remova a si mesmo (opcional, mas recomendado)
        if (req.user.id == id && req.user.tipo === 'administrador') {
            return res.status(403).json({ success: false, message: 'Você não pode remover sua própria conta de administrador.' });
        }

        const { error, count } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id)
            .select('*', { count: 'exact' }); // Para verificar se algo foi deletado

        if (error) {
            console.error("Erro Supabase ao remover usuário:", error);
            return res.status(500).json({ success: false, message: 'Erro ao remover usuário.' });
        }

        // Se count for 0, significa que o usuário não foi encontrado para remover
        if (count === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        res.json({ success: true, message: 'Usuário removido com sucesso.' });

    } catch (error) {
        console.error('Erro ao remover usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

module.exports = { router, authorizeAdmin }; // <--- Mude esta linha para exportar ambos