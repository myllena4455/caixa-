// app.js — sistema POS totalmente cliente (localStorage)

const { jsPDF } = window.jspdf;
const el = id => document.getElementById(id); // O seletor que garante o funcionamento dos IDs
const money = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

const KEY_PRODUCTS = 'pos_products_v2';
const KEY_SALES = 'pos_sales_v2';
const KEY_STORE = 'pos_store_v1';

let products = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
let sales = JSON.parse(localStorage.getItem(KEY_SALES) || '[]');
let store = JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
let cart = [];
let editingCode = null;

function init(){
    // Este é o ponto inicial. Se o script parar antes daqui, nada funciona.
    el('todayDate').textContent = new Date().toLocaleDateString();
    bindEvents(); // Liga todos os eventos estáticos e de delegação
    renderProducts();
    renderCart();
    updateTodayTotal();
}

// === LIGAÇÃO DE EVENTOS ===
function bindEvents(){
    // Eventos estáticos (Verificados contra o index.html)
    el('btnAdd').onclick = () => openModal();
    el('modalCancel').onclick = closeModal;
    el('modalSave').onclick = saveProduct;
    el('search').oninput = renderProducts;
    el('btnEmpty').onclick = () => { cart = []; renderCart(); };
    el('btnAddToCart').onclick = addSelectedToCart;
    el('btnCheckout').onclick = () => openCheckoutModal();
    el('btnExport').onclick = exportBackup;
    el('btnImport').onclick = importBackup;
    el('btnReport').onclick = generateReport; // Gera o relatório em HTML na nova janela
    el('btnClearSales').onclick = finalizeDay;
    el('btnPrintLast').onclick = printLastReceipt;
    el('codeSearch').addEventListener('keydown', e => { if(e.key === 'Enter') findByCode(); });
    el('modalCheckoutCancel').onclick = () => el('modalCheckout').style.display = 'none';
    el('modalCheckoutConfirm').onclick = confirmCheckout;
    el('btnStoreConfig').onclick = openStoreModal;
    el('modalStoreCancel').onclick = () => el('modalStore').style.display = 'none';
    el('modalStoreSave').onclick = saveStoreConfig;

    // Delegação de eventos (Conteúdo dinâmico)
    el('productList').addEventListener('click', handleProductListClick);
    el('cartItems').addEventListener('click', handleCartItemsClick);
    
    // Fechar modais ao clicar fora
    ['modal', 'modalCheckout', 'modalStore'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => {
            if(e.target.id === id) document.getElementById(id).style.display = 'none';
        });
    });
}

function handleProductListClick(e) {
    const btn = e.target.closest('button[data-code]');
    if (!btn) return;

    const code = btn.dataset.code;
    const action = btn.dataset.action;

    if (action === 'edit') openModal(code);
    else if (action === 'delete') deleteProduct(code);
    else if (action === 'quickadd') quickAdd(code);
}

function handleCartItemsClick(e) {
    const btn = e.target.closest('button[data-index]');
    if (!btn) return;

    const index = Number(btn.dataset.index);
    const action = btn.dataset.action;

    if (action === 'qty-add') changeQty(index, 1);
    else if (action === 'qty-sub') changeQty(index, -1);
    else if (action === 'remove') removeItem(index);
}

// === FUNÇÕES PRINCIPAIS ===

function renderProducts(){
    const q = el('search').value.trim().toLowerCase();
    const list = products.filter(p => {
        if(!q) return true;
        return (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
    });
    const elList = el('productList');
    if(list.length === 0){ elList.innerHTML = '<div class="muted">Nenhum produto cadastrado.</div>'; return; }
    
    let html = '<table><thead><tr><th>Código</th><th>Nome</th><th>Preço</th><th>Estoque</th><th></th></tr></thead><tbody>';
    for(const p of list){
        html += `<tr>
            <td>${escapeHtml(p.code)}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${money(p.price)}</td>
            <td>${Number(p.stock || 0)}</td>
            <td>
                <button data-action="edit" data-code="${escapeHtml(p.code)}" class="btn-secondary btn-small"><i class="fas fa-edit"></i></button>
                <button data-action="delete" data-code="${escapeHtml(p.code)}" class="btn-danger btn-small"><i class="fas fa-trash-alt"></i></button>
                <button data-action="quickadd" data-code="${escapeHtml(p.code)}" class="accent btn-primary btn-small"><i class="fas fa-cart-plus"></i></button>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    elList.innerHTML = html;
}

function openModal(code){
    editingCode = null;
    el('modalTitle').textContent = code ? 'Editar Produto' : 'Cadastrar Produto';
    
    el('p_last_sale').textContent = 'N/A';
    
    if(code){
        const p = products.find(x => x.code === code);
        if(p){ 
            el('p_code').value = p.code; 
            el('p_name').value = p.name; 
            el('p_price').value = p.price; 
            el('p_stock').value = p.stock; 
            editingCode = code; 
            
            const lastSale = getLastSaleInfo(code);
            if (lastSale) {
                el('p_last_sale').textContent = `${lastSale.date} por ${lastSale.price}`;
            }
        }
    } else { 
        el('p_code').value = ''; 
        el('p_name').value = ''; 
        el('p_price').value = ''; 
        el('p_stock').value = 1; 
    }
    el('modal').style.display = 'flex';
}

function saveProduct(){
    const code = el('p_code').value.trim();
    const name = el('p_name').value.trim();
    const price = parseFloat(String(el('p_price').value).replace(',', '.')) || 0;
    const stock = Number(el('p_stock').value) || 0;
    
    if(!code || !name){ alert('Código e nome são obrigatórios'); return; }
    if(price <= 0){ alert('O preço deve ser maior que zero.'); return; } 
    
    if(!editingCode && products.find(p => p.code === code)){ alert('Código já existe'); return; }
    
    if(editingCode && editingCode !== code){
        products = products.filter(p => p.code !== editingCode);
    }
    const prod = { code, name, price, stock };
    products = products.filter(p => p.code !== code).concat([prod]);
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    closeModal();
    renderProducts();
}

function renderCart(){
    const elCartItems = el('cartItems');
    if(cart.length === 0){ elCartItems.innerHTML = '<div class="muted">Carrinho vazio</div>'; el('cartTotal').textContent = money(0); return; }
    
    let html = ''; 
    let total = 0;
    
    for(const [i, item] of cart.entries()){
        const line = item.price * item.qty; total += line;
        html += `<div class="cart-row">
            <div style="flex:1"><div><strong>${escapeHtml(item.name)}</strong></div><div class="small">${escapeHtml(item.code)} • ${money(item.price)} x ${item.qty} = ${money(line)}</div></div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                <div>
                    <button data-action="qty-add" data-index="${i}" class="btn-primary btn-small"><i class="fas fa-plus"></i></button>
                    <button data-action="qty-sub" data-index="${i}" class="btn-secondary btn-small"><i class="fas fa-minus"></i></button>
                </div>
                <div>
                    <button data-action="remove" data-index="${i}" class="btn-danger btn-small"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>`;
    }
    elCartItems.innerHTML = html; 
    el('cartTotal').textContent = money(total);
}

function confirmCheckout(){
    // ... (lógica de cálculo e validação) ...
    const totalNoDiscount = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const discount = parseFloat(String(el('discount').value).replace(',', '.')) || 0;
    const total = Math.max(0, totalNoDiscount - discount);
    
    if (totalNoDiscount > 0 && total <= 0) { 
        if (!confirm('O desconto zera ou supera o total. Deseja confirmar a venda com total R$ 0,00?')) return;
    }

    const sale = {
        id: 'S' + Date.now(),
        date: new Date().toISOString(),
        items: cart,
        total,
        customer_name: el('cust_name').value.trim(), 
        customer_cpf: el('cust_cpf').value.trim(), 
        payment_method: el('payment_method').value, 
        discount
    };
    
    // Salva e atualiza estoque
    sales.unshift(sale);
    localStorage.setItem(KEY_SALES, JSON.stringify(sales));
    products.forEach(p => {
        const it = cart.find(ci => ci.code === p.code);
        if(it) p.stock = Math.max(0, (p.stock || 0) - it.qty);
    });
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    
    // GERA O PDF (Recibo)
    generateReceiptPDF(sale);
    localStorage.setItem('pos_last_receipt', JSON.stringify(sale));
    
    cart = [];
    renderCart();
    el('modalCheckout').style.display = 'none';
    updateTodayTotal();
    renderProducts();
}


function generateReceiptPDF(sale){
    // Utiliza jsPDF para gerar o recibo em uma nova janela
    const doc = new jsPDF({ unit: 'mm', format: [80, 140 + sale.items.length * 7] });
    let y = 6;
    doc.setFontSize(10);
    doc.text(store.name || 'Minha Loja', 40, y, { align: 'center' }); y += 6;
    if(store.cnpj) { doc.setFontSize(8); doc.text('CNPJ: ' + store.cnpj, 40, y, { align: 'center' }); y += 5; }
    if(store.address) { doc.setFontSize(7); doc.text(store.address, 40, y, { align: 'center' }); y += 6; }
    doc.setLineWidth(0.2); doc.line(6, y, 74, y); y += 4;
    doc.setFontSize(8); doc.text(`RECIBO: ${sale.id}`, 6, y); y += 5;
    doc.text(`Data: ${new Date(sale.date).toLocaleString()}`, 6, y); y += 5;
    if(sale.customer_name) { doc.text(`Cliente: ${sale.customer_name}`, 6, y); y += 5; }
    if(sale.customer_cpf) { doc.text(`CPF: ${sale.customer_cpf}`, 6, y); y += 5; }
    y += 2;
    sale.items.forEach(it => {
        const left = `${it.name} x${it.qty}`;
        const right = `${Number(it.price * it.qty).toFixed(2).replace('.', ',')}`;
        doc.setFontSize(8);
        doc.text(left.length > 28 ? left.slice(0, 28) + '...' : left, 6, y);
        doc.text(right, 74, y, { align: 'right' });
        y += 5;
    });
    doc.setLineWidth(0.2); doc.line(6, y, 74, y); y += 5;
    if(Number(sale.discount)) { doc.text(`Desconto: R$ ${Number(sale.discount).toFixed(2).replace('.', ',')}`, 6, y); y += 5; }
    doc.setFontSize(10); doc.text(`TOTAL: R$ ${Number(sale.total).toFixed(2).replace('.', ',')}`, 74, y, { align: 'right' }); y += 8;
    doc.setFontSize(8); doc.text(`Pagamento: ${sale.payment_method}`, 6, y); y += 6;
    doc.setFontSize(8); doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });
    doc.output('dataurlnewwindow'); // Abre o PDF em uma nova aba
}

function generateReport(){
    // Gera o Relatório de Vendas em uma nova janela HTML
    const today = new Date().toISOString().slice(0,10);
    const todays = sales.filter(s => s.date && s.date.slice(0,10) === today);
    if(todays.length === 0){ alert('Nenhuma venda hoje'); return; }
    
    let html = `<h2>Relatório de Vendas — ${new Date().toLocaleDateString()}</h2>`;
    html += `<div>Total de vendas: ${todays.length}</div>`;
    html += `<div>Valor total: ${money(todays.reduce((a, b) => a + (b.total || 0), 0))}</div><hr/>`;
    
    todays.forEach(s => html += `
        <div style="margin-bottom:8px; padding-bottom: 8px; border-bottom: 1px dotted #ccc;">
            <strong>${s.id}</strong> — ${new Date(s.date).toLocaleTimeString()} — ${money(s.total)}
            <div style="font-size: 13px; color: #555;">
                Itens: ${(s.items || []).map(it => escapeHtml(it.name) + ' x' + it.qty).join(', ')}
            </div>
        </div>`);
        
    const w = window.open('','_blank'); 
    w.document.write(html); 
    w.document.close();
}


// Funções auxiliares restantes
function closeModal(){ el('modal').style.display = 'none'; }
function deleteProduct(code){
    if(!confirm('Apagar produto ' + code + '?')) return;
    products = products.filter(p => p.code !== code);
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    renderProducts();
}
function quickAdd(code){ 
    const p = products.find(x => x.code === code); 
    if(!p){ alert('Produto não encontrado'); return } 
    if(p.stock <= 0){ alert('Produto esgotado!'); return; } 
    cart.push({code: p.code, name: p.name, price: p.price, qty: 1}); 
    renderCart(); 
}
function addSelectedToCart(){ 
    const qty = Number(el('qty').value) || 1; 
    const q = el('search').value.trim().toLowerCase(); 
    let p = products.find(x => (x.name || '').toLowerCase().includes(q) || (x.code || '').toLowerCase().includes(q) ); 
    
    if(!p){ alert('Nenhum produto selecionado pela busca. Use + Carrinho ao lado do produto ou busque por código.'); return } 
    if(p.stock <= 0){ alert('Produto esgotado!'); return; } 
    
    cart.push({code: p.code, name: p.name, price: p.price, qty}); 
    renderCart(); 
}
function changeQty(i, delta){ 
    const productData = products.find(p => p.code === cart[i].code);
    const newQty = Math.max(1, cart[i].qty + delta);
    
    if (delta > 0 && productData && newQty > productData.stock) {
        alert(`Estoque insuficiente. Máximo disponível: ${productData.stock}`);
        return;
    }
    
    cart[i].qty = newQty; 
    renderCart(); 
}
function removeItem(i){ cart.splice(i, 1); renderCart(); }
function openCheckoutModal(){
    if(cart.length === 0){ alert('Carrinho vazio'); return; }
    el('modalCheckout').style.display = 'flex';
    el('cust_name').value = ''; el('cust_cpf').value = ''; el('discount').value = ''; el('payment_method').value = 'Dinheiro';
}
function updateTodayTotal(){
    const today = new Date().toISOString().slice(0,10);
    const todays = sales.filter(s => s.date && s.date.slice(0,10) === today);
    const sum = todays.reduce((a, b) => a + (b.total || 0), 0);
    el('todayTotal').textContent = money(sum);
}
function printLastReceipt(){
    const r = localStorage.getItem('pos_last_receipt');
    if(!r){ alert('Nenhuma nota disponível. Faça uma venda primeiro.'); return; }
    const sale = JSON.parse(r);
    generateReceiptPDF(sale);
}
function findByCode(){ 
    const code = el('codeSearch').value.trim(); 
    const p = products.find(x => x.code === code); 
    if(!p){ alert('Produto não encontrado'); return } 
    if(p.stock <= 0){ alert('Produto esgotado!'); return; }
    cart.push({code: p.code, name: p.name, price: p.price, qty: 1}); 
    renderCart(); 
    el('codeSearch').value = ''; 
}
function getLastSaleInfo(productCode) {
    const sale = sales.find(s => 
        (s.items || []).some(item => item.code === productCode)
    );
    if (!sale) return null;
    const itemInSale = sale.items.find(item => item.code === productCode);
    return {
        date: new Date(sale.date).toLocaleDateString(),
        price: money(itemInSale.price)
    };
}
function escapeHtml(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function exportBackup(){
    const data = { store, products, sales };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pos_backup.json'; a.click(); URL.revokeObjectURL(url);
}
function importBackup(){
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = e => {
        const f = e.target.files[0]; if(!f) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try{
                const data = JSON.parse(ev.target.result);
                store = data.store || store;
                products = data.products || products;
                sales = data.sales || sales;
                localStorage.setItem(KEY_STORE, JSON.stringify(store));
                localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
                localStorage.setItem(KEY_SALES, JSON.stringify(sales));
                renderProducts(); updateTodayTotal();
                alert('Importação concluída localmente.');
            }catch(err){ alert('Arquivo inválido'); }
        };
        reader.readAsText(f);
    };
    inp.click();
}
function finalizeDay(){
    if(!confirm('Finalizar o dia apagará todas as vendas locais. Deseja continuar?')) return;
    sales = [];
    localStorage.setItem(KEY_SALES, JSON.stringify(sales));
    updateTodayTotal();
    alert('Vendas apagadas localmente.');
}
function openStoreModal(){
    el('store_name').value = store.name || '';
    el('store_cnpj').value = store.cnpj || '';
    el('store_address').value = store.address || '';
    el('modalStore').style.display = 'flex';
}
function saveStoreConfig(){
    store.name = el('store_name').value.trim();
    store.cnpj = el('store_cnpj').value.trim();
    store.address = el('store_address').value.trim();
    localStorage.setItem(KEY_STORE, JSON.stringify(store));
    alert('Configuração da loja salva localmente.');
    el('modalStore').style.display = 'none';
}

// Inicializa a aplicação
init();