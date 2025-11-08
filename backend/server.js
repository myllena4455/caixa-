// backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); // Biblioteca para criptografia de senha (Requer npm install bcrypt)

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10; // Custo de criptografia para o bcrypt

// Configuração do Banco de Dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');
        
        // 1. Tabela de USUÁRIOS para Login
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )`);
        
        // 2. Tabela de Configurações da Loja
        db.run(`CREATE TABLE IF NOT EXISTS store_config (
            id INTEGER PRIMARY KEY,
            razao_social TEXT,
            nome_fantasia TEXT,
            cnpj TEXT UNIQUE,
            endereco TEXT,
            telefone TEXT,
            regime_tributario TEXT,
            logo_path TEXT
        )`);
        
        // 3. Tabela de Vendas (Exemplo)
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            sale_date TEXT,
            total REAL,
            payment_method TEXT
        )`);
    }
});

// Middleware: Permite que o servidor processe dados JSON e formulários
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// ==========================================================
// 🚨 ROTA DE REDIRECIONAMENTO INICIAL (FORÇA O LOGIN)
// Esta rota deve ser a primeira a ser configurada!
// Se o usuário acessar http://localhost:3000/, ele vai para a tela de login.
// ==========================================================
app.get('/', (req, res) => {
    // Redireciona para o arquivo login.html na pasta raiz (um nível acima de 'backend')
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Serve arquivos estáticos (CSS, JS, imagens, e outros HTMLs como index.html)
// a partir da raiz do projeto (um nível acima de 'backend')
app.use(express.static(path.join(__dirname, '..'))); 

// ==========================================================
// ROTA: Cadastro (REGISTER)
// ==========================================================
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios para o cadastro.' });
    }
    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const sql = `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`;
        db.run(sql, [name, email, password_hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'E-mail já cadastrado.' });
                }
                console.error('Erro ao cadastrar usuário:', err.message);
                return res.status(500).json({ message: 'Erro interno ao tentar cadastrar.' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criptografar senha.' });
    }
});

// ==========================================================
// ROTA: Login
// ==========================================================
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err) {
            console.error('Erro ao buscar usuário:', err.message);
            return res.status(500).json({ message: 'Erro interno do servidor.' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Usuário não encontrado.' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.status(200).json({ 
                message: 'Login bem-sucedido!',
                user: { id: user.id, name: user.name, email: user.email }
            });
        } else {
            res.status(401).json({ message: 'Senha incorreta.' });
        }
    });
});

// ==========================================================
// ROTA: Configuração da Loja (POST)
// ==========================================================
app.post('/api/loja/configurar', (req, res) => {
    const data = req.body;
    const { razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario } = data;
    if (!cnpj || !razao_social) {
        return res.status(400).json({ message: 'CNPJ e Razão Social são obrigatórios.' });
    }
    const sql = `
        INSERT OR REPLACE INTO store_config (id, razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario) 
        VALUES (1, ?, ?, ?, ?, ?, ?)
    `;
    const params = [razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario];
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Erro ao salvar no DB:', err.message);
            return res.status(500).json({ message: 'Falha ao salvar a configuração no banco de dados.' });
        }
        console.log(`✅ Configuração da loja salva/atualizada. ID: ${this.lastID || 1}`);
        res.status(200).json({ message: 'Configuração salva com sucesso!' });
    });
});

// ==========================================================
// ROTA: Dashboard KPIs (GET - Mockada)
// ==========================================================
app.get('/api/dashboard/kpis', (req, res) => {
    // MOCK DATA (Ainda não busca dados reais de sales/products)
    const mockData = {
        faturamentoHoje: 1852.50,
        ticketMedio: 123.50,
        estoqueCritico: 8,
        clientesCadastrados: 45
    };
    res.json(mockData);
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Node.js rodando em http://localhost:${PORT}`);
    console.log(`🔗 Acesse o Login em: http://localhost:${PORT}/`); 
    console.log(`🔗 Acesse o PDV (Caixa) em: http://localhost:${PORT}/index.html\n`);
});