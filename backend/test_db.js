const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error('Erro abrindo DB:', err.message);
});

db.all("SELECT id, sale_date, total, payment_method, discount, additional, notes, customer_name, customer_cpf FROM sales ORDER BY sale_date DESC LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error('Erro ao consultar vendas:', err.message);
    process.exit(1);
  }
  console.log('Últimas vendas (max 5):');
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});