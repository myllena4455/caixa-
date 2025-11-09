// backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); 

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10; 

// Configuração do Banco de Dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');
        
        // 1. Tabela de USUÁRIOS
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
        
        // 3. Tabela de Vendas (Para contabilização e relatório)
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            sale_date TEXT,
            total REAL,
            payment_method TEXT,
            customer_name TEXT,
            customer_cpf TEXT
        )`);
    }
});

// Middleware
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// ==========================================================
// ROTA DE REDIRECIONAMENTO INICIAL (PARA O LOGIN)
// ==========================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Serve arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, '..'))); 

// ==========================================================
// ROTA: Cadastro e Login
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
                return res.status(500).json({ message: 'Erro interno ao tentar cadastrar.' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao criptografar senha.' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (!user) {
            return res.status(401).json({ message: 'Usuário não encontrado.' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            res.status(200).json({ message: 'Login bem-sucedido!', user: { id: user.id, name: user.name, email: user.email }});
        } else {
            res.status(401).json({ message: 'Senha incorreta.' });
        }
    });
});

// ==========================================================
// ROTA: Configurações da Loja
// ==========================================================
app.post('/api/loja/configurar', (req, res) => {
    const { razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario } = req.body;
    const sql = `INSERT OR REPLACE INTO store_config (id, razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario) VALUES (1, ?, ?, ?, ?, ?, ?)`;
    const params = [razao_social, nome_fantasia, cnpj, endereco, telefone, regime_tributario];
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Erro ao salvar no DB:', err.message);
            return res.status(500).json({ message: 'Falha ao salvar a configuração.' });
        }
        res.status(200).json({ message: 'Configuração salva com sucesso!' });
    });
});

app.get('/api/loja/configuracao', (req, res) => {
    const sql = `SELECT * FROM store_config WHERE id = 1`;
    db.get(sql, [], (err, row) => {
        if (!row) {
            return res.status(404).json({ message: 'Configuração não encontrada.', data: {} });
        }
        res.status(200).json({ data: row });
    });
});

// ==========================================================
// ROTA: Finalizar Venda (SAVE) - NOVO E ESSENCIAL
// ==========================================================
app.post('/api/sales/finish', (req, res) => {
    const { total, payment_method, customer_name, customer_cpf } = req.body;
    
    const sale_id = 'VENDA-' + Date.now();
    const sale_date = new Date().toISOString();

    const sql = `INSERT INTO sales (id, sale_date, total, payment_method, customer_name, customer_cpf) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [sale_id, sale_date, total, payment_method, customer_name, customer_cpf], function(err) {
        if (err) {
            console.error('Erro ao registrar a venda:', err.message);
            return res.status(500).json({ message: 'Falha ao registrar a venda.' });
        }
        console.log(`✅ Venda registrada! ID: ${sale_id}`);
        res.status(200).json({ message: 'Venda finalizada com sucesso!', sale_id: sale_id });
    });
});

// ==========================================================
// ROTA: Buscar Vendas (Para Relatório)
// ==========================================================
app.get('/api/sales/daily', (req, res) => {
    // Busca todas as vendas registradas
    const sql = `SELECT * FROM sales ORDER BY sale_date DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar vendas diárias:', err.message);
            return res.status(500).json({ message: 'Falha ao buscar dados de vendas.' });
        }
        res.status(200).json({ sales: rows });
    });
});

// ==========================================================
// ROTAS MOCK (Dashboard KPIs)
// ==========================================================
app.get('/api/dashboard/kpis', (req, res) => {
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