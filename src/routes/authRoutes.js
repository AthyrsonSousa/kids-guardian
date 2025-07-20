// authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabaseclient');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("Erro na verificação do token:", err);
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Rota de Login (mantenha o restante da rota como está)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nome de usuário e senha são obrigatórios.' });
    }

    try {
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('nome', username)
            .single();

        if (error && error.code === 'PGRST116') {
            return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
        }
        if (error) {
            console.error("Erro Supabase ao buscar usuário:", error);
            return res.status(500).json({ success: false, message: 'Erro no servidor ao buscar usuário.' });
        }

        const isPasswordValid = await bcrypt.compare(password, usuario.senha);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ success: true, message: 'Login realizado com sucesso.', token, user: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo } });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Altere ESTAS DUAS LINHAS:
// module.exports = router;
// exports.authenticateToken = authenticateToken;
// PARA ISSO:
module.exports = {
    router,
    authenticateToken
};
