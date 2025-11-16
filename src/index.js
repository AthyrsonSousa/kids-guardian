// index.js
const path = require('path');
// Garante que o .env na pasta raiz seja carregado
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

// Inicializa o Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Exporta o 'supabase' para ser usado em outros arquivos (como nas rotas)
// Esta é a forma correta de compartilhar a conexão do Supabase
module.exports = { supabase };

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Logger de requisições

// Importação das Rotas
// Padronizando a importação para maior clareza
const { router: authRouter } = require('./routes/authRoutes');
const criancasRouter = require('./routes/criancasRoutes');
const registrosRouter = require('./routes/registrosRoutes');
const { router: usuariosRouter } = require('./routes/usuariosRoutes');

// Aplica as rotas da API (todas com prefixo /api)
app.use('/api', authRouter);
app.use('/api', criancasRouter);
app.use('/api', registrosRouter);
app.use('/api', usuariosRouter);

// Rota raiz para teste
app.get('/', (req, res) => {
    res.send('🎉 API do Kids Guardian está funcionando!');
});

// Middleware para Rota Não Encontrada (404)
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Rota não encontrada.' });
});

// Middleware de Tratamento de Erro (500)
app.use((err, req, res, next) => {
    console.error('Erro interno do servidor:', err.stack);
    res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 API Kids Guardian (backend) rodando na porta ${port}`);
});

// Não é mais necessário exportar 'app' aqui, a menos que para testes
// module.exports = { app, supabase };
