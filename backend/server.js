// server.js

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
        
        // 2. Tabela de PRODUTOS (ESTOQUE)
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL
        )`);
        
        // 3. Tabela de VENDAS (CONTABILIZAÇÃO)
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            sale_date TEXT,
            total REAL,
            payment_method TEXT
        )`);

        // 4. Tabela de ITENS DA VENDA (Detalhamento)
        db.run(`CREATE TABLE IF NOT EXISTS sale_items (
            sale_id TEXT,
            product_id TEXT,
            quantity INTEGER,
            price_unit REAL,
            PRIMARY KEY (sale_id, product_id),
            FOREIGN KEY(sale_id) REFERENCES sales(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);
    }
});

// Middleware
// Garante colunas extras na tabela de vendas (idempotente)
db.serialize(() => {
    db.get("PRAGMA table_info(sales);", [], (err, row) => {});
    db.all("PRAGMA table_info(sales);", [], (err, rows) => {
        if (!rows) return;
        const cols = rows.map(r => r.name);
        const add = [];
        if (!cols.includes('discount')) add.push("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0");
        if (!cols.includes('additional')) add.push("ALTER TABLE sales ADD COLUMN additional REAL DEFAULT 0");
        if (!cols.includes('notes')) add.push("ALTER TABLE sales ADD COLUMN notes TEXT");
    if (!cols.includes('customer_name')) add.push("ALTER TABLE sales ADD COLUMN customer_name TEXT");
    if (!cols.includes('customer_cpf')) add.push("ALTER TABLE sales ADD COLUMN customer_cpf TEXT");
        add.forEach(sql => db.run(sql, ()=>{}));
    });
});
// Middleware
app.use(express.json());
// Garantir colunas extras na tabela users (dados da loja)
db.serialize(() => {
    db.all("PRAGMA table_info(users);", [], (err, rows) => {
        if (!rows) return;
        const cols = rows.map(r => r.name);
        const add = [];
        if (!cols.includes('owner_name')) add.push("ALTER TABLE users ADD COLUMN owner_name TEXT");
        if (!cols.includes('cnpj')) add.push("ALTER TABLE users ADD COLUMN cnpj TEXT");
        if (!cols.includes('address')) add.push("ALTER TABLE users ADD COLUMN address TEXT");
        add.forEach(sql => db.run(sql, ()=>{}));
    });
}); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, '..'))); 

// ==========================================================
// ROTA DE REDIRECIONAMENTO INICIAL (PARA O LOGIN)
// ==========================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'ilogin.html'));
});

// ==========================================================
// ROTA: Cadastro e Login
// ==========================================================
app.post('/api/auth/register', async (req, res) => { const { name, email, password, owner_name = '', cnpj = '', address = '' } = req.body;
    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const sql = `INSERT INTO users (name, email, password_hash, owner_name, cnpj, address) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(sql, [name, email, password_hash, owner_name, cnpj, address], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'E-mail já cadastrado.' });
                }
                return res.status(500).json({ message: 'Erro interno ao tentar cadastrar.' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso! Faça Login.' });
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
            res.status(200).json({ message: 'Login bem-sucedido!' });
        } else {
            res.status(401).json({ message: 'Senha incorreta.' });
        }
    });
});

// ==========================================================
// ROTA: CRUD de Produtos (Estoque)
// ==========================================================
// GET todos os produtos
app.get('/api/products', (req, res) => {
    const sql = `SELECT * FROM products ORDER BY name`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Erro ao buscar produtos.', error: err.message });
        res.status(200).json({ products: rows });
    });
});

// POST ou PUT (Cria/Atualiza produto)
app.post('/api/products', (req, res) => {
    const { id, name, price, stock } = req.body;
    if (!id || !name || price == null || stock == null) {
        return res.status(400).json({ message: 'Dados incompletos do produto.' });
    }
    // INSERT OR REPLACE: Se o ID já existir, atualiza; senão, insere.
    const sql = `INSERT OR REPLACE INTO products (id, name, price, stock) VALUES (?, ?, ?, ?)`;
    db.run(sql, [id, name, price, stock], function(err) {
        if (err) return res.status(500).json({ message: 'Erro ao salvar produto.', error: err.message });
        res.status(200).json({ message: 'Produto salvo com sucesso!', id: id });
    });
});

// DELETE produto
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM products WHERE id = ?`;
    db.run(sql, [id], function(err) {
        if (err) return res.status(500).json({ message: 'Erro ao deletar produto.', error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Produto não encontrado.' });
        res.status(200).json({ message: 'Produto deletado com sucesso!' });
    });
});


// ==========================================================
// ROTA: Finalizar Venda (SAVE e Baixa de Estoque)
// ==========================================================

app.post('/api/sales/finish', (req, res) => {
    const { total, payment_method, cart_items, discount = 0, additional = 0, notes = '', customer_name = '', customer_cpf = '' } = req.body;
    
    if (total == null || !payment_method || !Array.isArray(cart_items) || cart_items.length === 0) {
        return res.status(400).json({ message: 'Dados incompletos para finalizar a venda.' });
    }

    const sale_id = 'VENDA-' + Date.now();
    const sale_date = new Date().toISOString();

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        const saleSql = `INSERT INTO sales (id, sale_date, total, payment_method, discount, additional, notes, customer_name, customer_cpf) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(saleSql, [sale_id, sale_date, total, payment_method, discount, additional, notes, customer_name, customer_cpf], (err) => {
            if (err) {
                db.run("ROLLBACK;");
                return res.status(500).json({ message: 'Erro ao registrar a venda.', error: err.message });
            }

            const itemSql = `INSERT INTO sale_items (sale_id, product_id, quantity, price_unit) VALUES (?, ?, ?, ?)`;

            let hadError = false;
            for (const item of cart_items) {
                db.run(itemSql, [sale_id, item.id, item.qty, item.price], (err2) => {
                    if (err2 && !hadError) {
                        hadError = true;
                        db.run("ROLLBACK;");
                        return res.status(500).json({ message: `Erro ao registrar item ${item.id}.`, error: err2.message });
                    }
                });

                const stockSql = `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`;
                db.run(stockSql, [item.qty, item.id, item.qty], function(err3) {
                    if ((err3 || this.changes === 0) && !hadError) {
                        hadError = true;
                        db.run("ROLLBACK;");
                        return res.status(500).json({ message: `Erro: Estoque insuficiente para ${item.id}.`, error: err3 ? err3.message : 'Estoque insuficiente' });
                    }
                });
            }

            db.run("COMMIT;", (err4) => {
                if (err4) {
                    return res.status(500).json({ message: 'Erro ao finalizar a transação.', error: err4.message });
                }
                db.get("SELECT owner_name, cnpj, address FROM users ORDER BY rowid DESC LIMIT 1", [], (e2, storeRow) => {
                    res.status(200).json({ 
                        message: 'Venda finalizada com sucesso! Estoque atualizado.',
                        sale_id: sale_id,
                        sale_details: { 
                            total, payment_method, discount, additional, notes, customer_name, customer_cpf,
                            cart_items, sale_date,
                            store: storeRow || {}
                        } 
                    });
                });
            });
        });
    });
});



// ==========================================================
// ROTA: Relatório de Vendas (Consulta)
// ==========================================================
app.get('/api/sales/report', (req, res) => {
    // Consulta para buscar todas as vendas
    const sql = `SELECT * FROM sales ORDER BY sale_date DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Falha ao buscar dados de vendas.', error: err.message });
        }
        res.status(200).json({ sales: rows });
    });
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor Node.js rodando em http://localhost:${PORT}`);
    console.log(`🔗 Acesse o Login em: http://localhost:${PORT}/\n`);
});