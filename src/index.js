// index.js
const path = require('path'); // Certifique-se de que esta linha está presente
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: SUPABASE_URL ou SUPABASE_KEY não estão definidas no arquivo .env.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.supabase = supabase;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Altere ESTAS DUAS LINHAS:
// const authRoutes = require('./routes/authRoutes').router;
// const authenticateToken = authRoutes.authenticateToken;
// PARA ISSO:
const { router: authRouter } = require('./routes/authRoutes'); // Importa o router de authRoutes
const criancasRoutes = require('./routes/criancasRoutes');
const registrosRoutes = require('./routes/registrosRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes').router; // <--- ADICIONE .router AQUI!

// Aplica as rotas da API
app.use('/api', authRouter); // <--- Use authRouter aqui
app.use('/api', criancasRoutes);
app.use('/api', registrosRoutes);
app.use('/api', usuariosRoutes);

app.get('/', (req, res) => {
    res.send('🎉 API do Kids Guardian está funcionando!');
});

app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
    console.error('Erro interno do servidor:', err.stack);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
});

module.exports = { app, supabase };