// app.js — sistema POS totalmente cliente (localStorage)

const { jsPDF } = window.jspdf;
const el = id => document.getElementById(id); 
const money = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

const KEY_PRODUCTS = 'pos_products_v2';
const KEY_SALES = 'pos_sales_v2';
const KEY_STORE = 'pos_store_v1';

let products = JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]');
let sales = JSON.parse(localStorage.getItem(KEY_SALES) || '[]');
let store = JSON.parse(localStorage.getItem(KEY_STORE) || '{"name": "LK Imports"}'); 
let cart = [];
let editingCode = null;
let currentConfirmCallback = null; // Usado para gerenciar o fluxo do customConfirm

// === FUNÇÕES DE ALERTA/CONFIRMAÇÃO CUSTOMIZADAS ===
function thematicAlert(message, title = 'Aviso do Sistema', type = 'info') {
    const overlay = el('customAlert');
    const iconEl = el('alertIcon');
    
    let iconClass = 'fas fa-info-circle'; 
    
    // Define o ícone e classe de cor
    if (type === 'success') {
        iconClass = 'fas fa-check-circle success';
    } else if (type === 'error') {
        iconClass = 'fas fa-times-circle error';
    } else if (type === 'warning') {
        iconClass = 'fas fa-exclamation-triangle warning';
    } else {
        iconClass = 'fas fa-info-circle info';
    }
    
    iconEl.className = 'custom-alert-icon ' + iconClass;
    el('alertTitle').textContent = title;
    el('alertMessage').textContent = message;
    
    // Exibe o modal
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('show'), 10); 
    
    // Fecha o modal ao clicar no botão
    el('alertCloseBtn').onclick = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 200); 
    };
}

function customConfirm(message, title = 'Confirmação Necessária', callback) {
    const overlay = el('customConfirm');
    el('confirmTitle').textContent = title;
    el('confirmMessage').textContent = message;
    
    // Mostra o modal
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('show'), 10);
    
    currentConfirmCallback = callback;

    // Remove listeners antigos para evitar chamadas duplicadas
    el('confirmOkBtn').onclick = null;
    el('confirmCancelBtn').onclick = null;
    
    const closeAndCallback = (result) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 200);
        if (currentConfirmCallback) {
            currentConfirmCallback(result);
            currentConfirmCallback = null;
        }
    };

    el('confirmOkBtn').onclick = () => closeAndCallback(true);
    el('confirmCancelBtn').onclick = () => closeAndCallback(false);
}


function init(){
    el('todayDate').textContent = new Date().toLocaleDateString();
    bindEvents(); 
    renderProducts();
    renderCart();
    updateTodayTotal();
}

// === LIGAÇÃO DE EVENTOS ===
function bindEvents(){
    el('btnAdd').onclick = () => openModal();
    el('modalCancel').onclick = closeModal;
    el('modalSave').onclick = saveProduct;
    el('search').oninput = renderProducts;
    // Usa thematicAlert ao invés de alert
    el('btnEmpty').onclick = () => { cart = []; renderCart(); thematicAlert('Carrinho de compras esvaziado.', 'Limpeza', 'info'); };
    el('btnAddToCart').onclick = addSelectedToCart;
    el('btnCheckout').onclick = () => openCheckoutModal();
    el('btnExport').onclick = exportBackup;
    el('btnImport').onclick = importBackup;
    el('btnReport').onclick = generateReport; 
    el('btnClearSales').onclick = finalizeDay; // Usa customConfirm
    el('btnPrintLast').onclick = printLastReceipt;
    el('codeSearch').addEventListener('keydown', e => { if(e.key === 'Enter') findByCode(); });
    el('modalCheckoutCancel').onclick = () => el('modalCheckout').style.display = 'none';
    el('modalCheckoutConfirm').onclick = confirmCheckout; // Usa customConfirm internamente
    el('btnStoreConfig').onclick = openStoreModal;
    el('modalStoreCancel').onclick = () => el('modalStore').style.display = 'none';
    el('modalStoreSave').onclick = saveStoreConfig;

    el('productList').addEventListener('click', handleProductListClick);
    el('cartItems').addEventListener('click', handleCartItemsClick);
    
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
    else if (action === 'delete') deleteProduct(code); // Usa customConfirm
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
    
    if(!code || !name){ thematicAlert('O Código e o Nome do produto são obrigatórios para o cadastro.', 'Erro de Cadastro', 'error'); return; }
    if(price <= 0){ thematicAlert('O preço deve ser um valor positivo. Verifique o campo Preço.', 'Erro de Valor', 'error'); return; } 
    
    if(!editingCode && products.find(p => p.code === code)){ thematicAlert(`O código "${code}" já está em uso por outro produto. Use um código único.`, 'Conflito de Código', 'error'); return; }
    
    if(editingCode && editingCode !== code){
        products = products.filter(p => p.code !== editingCode);
    }
    const prod = { code, name, price, stock };
    products = products.filter(p => p.code !== code).concat([prod]);
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    closeModal();
    renderProducts();
    thematicAlert(`Produto "${name}" salvo com sucesso!`, 'Sucesso', 'success');
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

// Nova função auxiliar para processar a venda, chamada por confirmCheckout
function processSale(total, totalNoDiscount, discount, additionalValue, saleNotes) {
    const sale = {
        id: 'S' + Date.now(),
        date: new Date().toISOString(),
        items: cart,
        total,
        customer_name: el('cust_name').value.trim(), 
        customer_cpf: el('cust_cpf').value.trim(), 
        payment_method: el('payment_method').value, 
        discount,
        additional_value: additionalValue,
        notes: saleNotes
    };
    
    sales.unshift(sale);
    localStorage.setItem(KEY_SALES, JSON.stringify(sales));
    products.forEach(p => {
        const it = cart.find(ci => ci.code === p.code);
        if(it) p.stock = Math.max(0, (p.stock || 0) - it.qty);
    });
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
    
    generateReceiptPDF(sale);
    localStorage.setItem('pos_last_receipt', JSON.stringify(sale));
    
    cart = [];
    renderCart();
    el('modalCheckout').style.display = 'none';
    updateTodayTotal();
    renderProducts();
    thematicAlert(`Venda ${sale.id} finalizada com sucesso! O recibo em PDF foi gerado.`, 'Venda Concluída', 'success');
}

function confirmCheckout(){
    const totalNoDiscount = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const discount = parseFloat(String(el('discount').value).replace(',', '.')) || 0;
    const additionalValue = parseFloat(String(el('additional_value').value).replace(',', '.')) || 0;
    const total = Math.max(0, totalNoDiscount - discount) + additionalValue;
    const saleNotes = el('sale_notes').value.trim(); 
    
    if (cart.length === 0) {
        thematicAlert('O carrinho está vazio. Adicione itens antes de fechar a venda.', 'Erro de Venda', 'error');
        return;
    }
    
    if (totalNoDiscount > 0 && total <= 0) { 
        // Usa customConfirm
        customConfirm('O desconto zera ou supera o total. Deseja confirmar a venda com total R$ 0,00?', 'Confirmação de Venda', (confirmed) => {
            if (confirmed) processSale(total, totalNoDiscount, discount, additionalValue, saleNotes);
        });
        return;
    }
    
    processSale(total, totalNoDiscount, discount, additionalValue, saleNotes);
}


function generateReceiptPDF(sale){
    const doc = new jsPDF({ unit: 'mm', format: [80, 140 + sale.items.length * 7] });
    const storeName = store.name || 'LK Imports';
    const saleDate = new Date(sale.date).toLocaleString('pt-BR'); 

    let y = 6;
    doc.setFontSize(10);
    doc.text(storeName, 40, y, { align: 'center' }); y += 6; 
    if(store.cnpj) { doc.setFontSize(8); doc.text('CNPJ: ' + store.cnpj, 40, y, { align: 'center' }); y += 5; }
    if(store.address) { doc.setFontSize(7); doc.text(store.address, 40, y, { align: 'center' }); y += 6; }
    doc.setLineWidth(0.2); doc.line(6, y, 74, y); y += 4;
    
    doc.setFontSize(8); doc.text(`RECIBO: ${sale.id}`, 6, y); y += 5;
    doc.text(`Data/Hora: ${saleDate}`, 6, y); y += 5;
    
    if(sale.customer_name) { doc.text(`Cliente: ${sale.customer_name}`, 6, y); y += 5; }
    if(sale.customer_cpf) { doc.text(`CPF: ${sale.customer_cpf}`, 6, y); y += 5; }
    y += 2;
    
    doc.setFontSize(7); doc.text('Item (Qtd.)', 6, y); doc.text('Total', 74, y, { align: 'right' }); y += 4;
    
    sale.items.forEach(it => {
        const left = `${it.name} (${it.qty})`;
        const right = `${Number(it.price * it.qty).toFixed(2).replace('.', ',')}`;
        doc.setFontSize(8);
        doc.text(left.length > 28 ? left.slice(0, 28) + '...' : left, 6, y);
        doc.text(right, 74, y, { align: 'right' });
        y += 5;
    });
    doc.setLineWidth(0.2); doc.line(6, y, 74, y); y += 5;
    
    // Adicionando Desconto
    if(Number(sale.discount)) { 
        doc.text(`Desconto:`, 6, y); 
        doc.text(`- R$ ${Number(sale.discount).toFixed(2).replace('.', ',')}`, 74, y, { align: 'right' }); 
        y += 5; 
    }
    // Adicionando Valor Adicional
    if(Number(sale.additional_value)) { 
        doc.text(`Valor Adicional:`, 6, y); 
        doc.text(`+ R$ ${Number(sale.additional_value).toFixed(2).replace('.', ',')}`, 74, y, { align: 'right' }); 
        y += 5; 
    }
    
    doc.setFontSize(10); 
    doc.text(`TOTAL:`, 6, y); 
    doc.text(`R$ ${Number(sale.total).toFixed(2).replace('.', ',')}`, 74, y, { align: 'right' }); y += 8;
    
    doc.setFontSize(8); doc.text(`Pagamento: ${sale.payment_method}`, 6, y); y += 6;
    
    // Adicionando Observações na nota
    if(sale.notes) {
        doc.setFontSize(7);
        doc.text('OBSERVAÇÕES:', 6, y); y += 4;
        const splitText = doc.splitTextToSize(sale.notes, 68); 
        doc.text(splitText, 6, y);
        y += (splitText.length * 4) + 2; 
    }
    
    doc.setFontSize(8); doc.text('Obrigado pela preferência! Volte sempre à ' + storeName, 40, y, { align: 'center' });
    doc.output('dataurlnewwindow');
}

function generateReport(){
    const today = new Date().toISOString().slice(0,10);
    const todays = sales.filter(s => s.date && s.date.slice(0,10) === today);
    if(todays.length === 0){ thematicAlert('Não há vendas registradas para o dia de hoje.', 'Relatório Vazio', 'info'); return; }
    
    const totalSalesValue = todays.reduce((a, b) => a + (b.total || 0), 0);
    const totalItemsSold = todays.flatMap(s => s.items).reduce((sum, item) => sum + item.qty, 0);
    
    let html = `<h2>Relatório de Vendas — ${new Date().toLocaleDateString()}</h2>`;
    html += `<div>**Total de Itens Vendidos:** ${totalItemsSold}</div>`;
    html += `<div>**Número de Vendas:** ${todays.length}</div>`;
    html += `<hr/><h3>Resumo Detalhado das Vendas</h3>`;
    
    todays.forEach(s => {
        html += `
            <div style="margin-bottom:8px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                <div style="font-size: 14px;">
                    <strong>Venda ${s.id}</strong>
                    <span style="float:right;">${new Date(s.date).toLocaleTimeString()} - ${money(s.total)}</span>
                </div>
                <div style="font-size: 13px; color: #555; padding-left: 10px; margin-top: 5px;">
                    **Itens (Quantidade):**
                    <ul>
                        ${(s.items || []).map(it => `<li>${escapeHtml(it.name)} x${it.qty} (${money(it.price)})</li>`).join('')}
                    </ul>
                    ${s.notes ? `<div style="margin-top:5px; font-weight: bold;">Obs: ${escapeHtml(s.notes)}</div>` : ''}
                </div>
            </div>`;
    });

    html += `<hr/><h2>VALOR FINAL DO DIA: ${money(totalSalesValue)}</h2>`;
        
    const w = window.open('','_blank'); 
    w.document.write(html); 
    w.document.close();
}


// Funções auxiliares restantes
function closeModal(){ el('modal').style.display = 'none'; }
function deleteProduct(code){
    // Usa customConfirm
    customConfirm(`Tem certeza que deseja APAGAR o produto com código ${code}? Esta ação é irreversível.`, 'Confirmação de Exclusão', (confirmed) => {
        if (!confirmed) return;
        
        products = products.filter(p => p.code !== code);
        localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
        renderProducts();
        thematicAlert(`Produto ${code} foi removido do sistema.`, 'Item Apagado', 'info');
    });
}
function quickAdd(code){ 
    const p = products.find(x => x.code === code); 
    if(!p){ thematicAlert('Produto não encontrado no banco de dados.', 'Erro', 'error'); return } 
    if(p.stock <= 0){ thematicAlert('Estoque insuficiente! O produto está esgotado.', 'Estoque Baixo', 'warning'); return; } 
    cart.push({code: p.code, name: p.name, price: p.price, qty: 1}); 
    renderCart(); 
    thematicAlert(`"${p.name}" adicionado ao carrinho (Qtd: 1).`, 'Adicionado', 'success');
}
function addSelectedToCart(){ 
    const qty = Number(el('qty').value) || 1; 
    const q = el('search').value.trim().toLowerCase(); 
    let p = products.find(x => (x.name || '').toLowerCase().includes(q) || (x.code || '').toLowerCase().includes(q) ); 
    
    if(!p){ thematicAlert('Selecione um produto pela busca antes de adicionar.', 'Erro de Seleção', 'error'); return } 
    if(p.stock <= 0){ thematicAlert('Estoque insuficiente! O produto está esgotado.', 'Estoque Baixo', 'warning'); return; } 
    if (qty > p.stock) { thematicAlert(`Não é possível adicionar ${qty} itens. Estoque máximo disponível: ${p.stock}`, 'Estoque Insuficiente', 'warning'); return; }
    
    cart.push({code: p.code, name: p.name, price: p.price, qty}); 
    renderCart(); 
    thematicAlert(`"${p.name}" adicionado ao carrinho (Qtd: ${qty}).`, 'Adicionado', 'success');
}
function changeQty(i, delta){ 
    const productData = products.find(p => p.code === cart[i].code);
    const newQty = Math.max(1, cart[i].qty + delta);
    
    if (delta > 0 && productData && newQty > productData.stock) {
        thematicAlert(`Estoque insuficiente. Máximo disponível: ${productData.stock}`, 'Limite de Estoque', 'warning');
        return;
    }
    
    cart[i].qty = newQty; 
    renderCart(); 
}
function removeItem(i){ cart.splice(i, 1); renderCart(); thematicAlert('Item removido do carrinho.', 'Removido', 'info'); }
function openCheckoutModal(){
    if(cart.length === 0){ thematicAlert('O carrinho está vazio. Adicione itens antes de fechar a venda.', 'Erro de Venda', 'error'); return; }
    el('modalCheckout').style.display = 'flex';
    // Limpar campos
    el('cust_name').value = ''; el('cust_cpf').value = ''; 
    el('discount').value = ''; el('additional_value').value = ''; el('sale_notes').value = ''; 
    el('payment_method').value = 'Dinheiro';
}
function updateTodayTotal(){
    const today = new Date().toISOString().slice(0,10);
    const todays = sales.filter(s => s.date && s.date.slice(0,10) === today);
    const sum = todays.reduce((a, b) => a + (b.total || 0), 0);
    el('todayTotal').textContent = money(sum);
}
function printLastReceipt(){
    const r = localStorage.getItem('pos_last_receipt');
    if(!r){ thematicAlert('Nenhuma nota fiscal foi emitida nesta sessão.', 'Erro de Impressão', 'error'); return; }
    const sale = JSON.parse(r);
    generateReceiptPDF(sale);
    thematicAlert('Reimpressão da última nota em andamento...', 'Imprimindo', 'info');
}
function findByCode(){ 
    const code = el('codeSearch').value.trim(); 
    const p = products.find(x => x.code === code); 
    if(!p){ thematicAlert(`Produto com código "${code}" não encontrado.`, 'Busca Falhou', 'error'); return } 
    if(p.stock <= 0){ thematicAlert('Estoque insuficiente! O produto está esgotado.', 'Estoque Baixo', 'warning'); return; }
    cart.push({code: p.code, name: p.name, price: p.price, qty: 1}); 
    renderCart(); 
    el('codeSearch').value = ''; 
    thematicAlert(`"${p.name}" (Qtd: 1) adicionado por código.`, 'Adicionado', 'success');
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
    const a = document.createElement('a'); a.href = url; a.download = `pos_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    thematicAlert('Backup de todos os dados (Produtos, Vendas, Loja) baixado como pos_backup.json.', 'Backup Concluído', 'success');
}
function importBackup(){
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = e => {
        const f = e.target.files[0]; if(!f) return;
        
        // Usa customConfirm
        customConfirm('Atenção: A importação irá SOBRESCREVER todos os seus dados atuais (Produtos e Vendas) com o conteúdo do arquivo. Deseja continuar?', 'Confirmação de Importação', (confirmed) => {
             if (!confirmed) return;
             
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
                    thematicAlert('Importação concluída com sucesso! Os dados foram carregados.', 'Sucesso na Importação', 'success');
                }catch(err){ thematicAlert('Erro ao processar o arquivo. Certifique-se de que é um arquivo JSON de backup válido.', 'Arquivo Inválido', 'error'); }
            };
            reader.readAsText(f);
        });
    };
    inp.click();
}
function finalizeDay(){
    // Usa customConfirm
    customConfirm('Atenção: Finalizar o dia irá APAGAR TODAS AS VENDAS LOCAIS. Garanta que o relatório do dia foi exportado. Deseja continuar?', 'Finalizar Dia de Vendas', (confirmed) => {
        if (!confirmed) return;

        sales = [];
        localStorage.setItem(KEY_SALES, JSON.stringify(sales));
        updateTodayTotal();
        thematicAlert('Vendas do dia zeradas no sistema.', 'Dia Finalizado', 'info');
    });
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
    thematicAlert('Configuração da loja salva com sucesso!', 'Loja Configurada', 'success');
    el('modalStore').style.display = 'none';
}

// Inicializa a aplicação
init();