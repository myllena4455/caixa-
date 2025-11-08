// backend/server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); // Requer npm install bcrypt

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10; 

// Configuração do Banco de Dados SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');
        
        // 1. Tabela de USUÁRIOS para Login (SQL CLEAN)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )`);
        
        // 2. Tabela de Configurações da Loja (SQL CLEAN)
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
        
        // 3. Tabela de Vendas (SQL CLEAN)
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            sale_date TEXT,
            total REAL,
            payment_method TEXT
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
    // Redireciona para o arquivo login.html
    res.sendFile(path.join(__dirname, '..', 'login.html'));
});

// Serve arquivos estáticos (CSS, JS, imagens)
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
// CÓDIGO DENTRO DE backend/server.js (Adicione a Rota de Vendas)

// ==========================================================
// ROTA: Finalizar Venda (POST)
// ==========================================================
app.post('/api/vendas/finalizar', (req, res) => {
    const { total, items, payment_method } = req.body;
    
    if (!total || !items || items.length === 0 || !payment_method) {
        return res.status(400).json({ message: 'Dados de venda incompletos.' });
    }

    // Gerar um ID único simples para a venda (ex: timestamp + número aleatório)
    const saleId = `VENDA-${Date.now()}`;
    const saleDate = new Date().toISOString();

    // 1. Inserir a venda principal na tabela `sales`
    const sqlSale = `INSERT INTO sales (id, sale_date, total, payment_method) VALUES (?, ?, ?, ?)`;
    db.run(sqlSale, [saleId, saleDate, total, payment_method], function(err) {
        if (err) {
            console.error('Erro ao salvar venda:', err.message);
            return res.status(500).json({ message: 'Falha ao salvar a venda principal no banco de dados.' });
        }
        
        // 🚨 OBS: Para salvar os 'items' da venda, você precisaria de uma tabela `sale_items`.
        // Por enquanto, apenas confirmamos a venda principal para avançar.
        
        console.log(`✅ Venda finalizada. ID: ${saleId}`);
        res.status(201).json({ 
            message: `Venda ${saleId} concluída com sucesso.`, 
            saleId: saleId 
        });
    });
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