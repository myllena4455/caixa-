// site.js

// VariÃ¡veis Globais
let products = []; // Lista de produtos do estoque
let cart = [];     // Carrinho de compras atual
let lastSale = null; // Armazena a Ãºltima venda para impressÃ£o imediata

// VerificaÃ§Ã£o de login
function checkAuth() {
    const userId = localStorage.getItem('user_id');
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');
    
    if (!userId) {
        // NÃ£o estÃ¡ logado - redireciona para login
        window.location.href = 'ilogin.html';
        return false;
    }
    
    // Exibe informaÃ§Ãµes do usuÃ¡rio na interface
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        const roleText = userRole === 'admin' ? 'Administrador' : 
                         userRole === 'gerente' ? 'Gerente' : 'FuncionÃ¡rio';
        userInfo.textContent = `${userName} (${roleText})`;
    }
    
    // Controla visibilidade de botÃµes baseado na role
    if (userRole === 'funcionario') {
        // FuncionÃ¡rios nÃ£o podem cadastrar/editar/deletar produtos
        const btnNewProduct = document.querySelector('[onclick*="openProductModal"]');
        if (btnNewProduct) btnNewProduct.style.display = 'none';
    }
    
    return true;
}

// ==========================================================
// FUNÃ‡Ã•ES UTILITÃRIAS (show/hide/alert)
// ==========================================================
function show(id) { document.getElementById(id).style.display = 'flex'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function thematicAlert(title, message, type) {
    const alertBox = document.getElementById('customAlert');
    const icon = document.getElementById('alertIcon');

    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;

    icon.innerHTML = ''; 
    icon.style.color = '';

    if (type === 'success') {
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        icon.style.color = 'var(--color-success)';
    } else if (type === 'error') {
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        icon.style.color = 'var(--color-danger)';
    } else { // info/default
        icon.innerHTML = '<i class="fas fa-info-circle"></i>';
        icon.style.color = 'var(--color-primary)';
    }
    
    alertBox.style.display = 'flex';
}
// Registro defensivo do botÃ£o de fechar alerta (previne erro se elemento ausente)
const _alertCloseBtn = document.getElementById('alertCloseBtn');
if (_alertCloseBtn) _alertCloseBtn.onclick = () => hide('customAlert');

function formatCurrency(value) {
    // Garante que o valor Ã© um nÃºmero
    const num = parseFloat(value) || 0; 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

function parseCurrency(text) {
    // Converte R$ 1.000,00 para 1000.00
    if (typeof text !== 'string') return text;
    return parseFloat(text.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
}

// ==========================================================
// PRODUTOS E ESTOQUE (CRUD e Display)
// ==========================================================

async function loadProducts(searchQuery = '') {
    try {
        const response = await fetch('/api/products');
        const result = await response.json();

        if (response.ok) {
            products = result.products;
            
            // Filtra se houver busca
            const filteredProducts = products.filter(p => 
                p.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase())
            );

            renderProducts(filteredProducts);
            loadSalesData(); // Atualiza KPIs tambÃ©m
        } else {
            thematicAlert('Erro de Produto', result.message || 'Falha ao carregar lista de produtos.', 'error');
        }
    } catch (error) {
        thematicAlert('Erro de ConexÃ£o', 'NÃ£o foi possÃ­vel buscar produtos.', 'error');
        console.error('Erro ao buscar produtos:', error);
    }
}

function renderProducts(productsToRender) {
    const tbody = document.getElementById('productListBody');
    tbody.innerHTML = '';

    if (productsToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted" style="text-align: center;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    productsToRender.forEach(p => {
        const row = tbody.insertRow();
        
        // Define classe CSS baseada no estoque
        let stockClass = 'text-success';
        let stockWarning = '';
        if (p.stock === 0) {
            stockClass = 'stock-critical';
            stockWarning = ' âš ï¸ ESGOTADO';
        } else if (p.stock <= 3) {
            stockClass = 'stock-critical';
            stockWarning = ' âš ï¸ CRÃTICO';
        } else if (p.stock <= 10) {
            stockClass = 'stock-low';
            stockWarning = ' âš ï¸';
        }
        
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${formatCurrency(p.price)}</td>
            <td class="${stockClass}">${p.stock}${stockWarning}</td>
            <td>
    <button class="btn-success btn-small" title="Adicionar ao carrinho" onclick="addProductToCartById('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}>
        <i class="fas fa-cart-plus"></i>
    </button>
    <button class="btn-primary btn-small" onclick="openProductModal('edit', '${p.id}')"><i class="fas fa-edit"></i></button>
    <button class="btn-danger btn-small" onclick="deleteProduct('${p.id}')"><i class="fas fa-trash-alt"></i></button>
</td>
        `;
    });
}

function openProductModal(mode, productId = '') {
    console.log('openProductModal chamado:', mode, productId);
    
    const modal = document.getElementById('modalProduct');
    const title = document.getElementById('productModalTitle');
    const btnSave = document.getElementById('btnSaveProduct');
    
    if (!modal || !title || !btnSave) {
        console.error('Elementos do modal nÃ£o encontrados!');
        return;
    }
    
    document.getElementById('productId').value = '';
    document.getElementById('productCode').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productCost').value = '0.00';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStock').value = 0;
    
    if (mode === 'add') {
        title.textContent = 'Cadastrar Novo Produto';
        document.getElementById('productCode').readOnly = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Salvar Produto';
    } else {
        title.textContent = 'Editar Produto';
        document.getElementById('productCode').readOnly = true;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Atualizar Produto';
        
        const product = products.find(p => p.id === productId);
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productCode').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCost').value = (product.cost || 0).toFixed(2);
            document.getElementById('productPrice').value = product.price.toFixed(2);
            document.getElementById('productStock').value = product.stock;
        }
    }
    
    console.log('Abrindo modal...');
    show('modalProduct');
    console.log('Modal aberto!');
}

async function saveProduct() {
    const id = document.getElementById('productCode').value.trim();
    const name = document.getElementById('productName').value.trim();
    const cost = parseFloat(document.getElementById('productCost').value) || 0;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);

    if (!id || !name || isNaN(price) || isNaN(stock)) {
        return thematicAlert('Erro', 'Preencha todos os campos corretamente.', 'error');
    }

    const productData = { id, name, cost, price, stock };

    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        const result = await response.json();

        if (response.ok) {
            thematicAlert('Sucesso!', result.message, 'success');
            hide('modalProduct');
            loadProducts(); // Recarrega a lista
        } else {
            thematicAlert('Erro', result.message || 'Falha ao salvar o produto.', 'error');
        }
    } catch (error) {
        thematicAlert('Erro de ConexÃ£o', 'NÃ£o foi possÃ­vel comunicar com o servidor.', 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm(`Tem certeza que deseja DELETAR o produto ${id}?`)) return;

    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            thematicAlert('Sucesso!', result.message, 'success');
            loadProducts(); // Recarrega a lista
        } else {
            thematicAlert('Erro', result.message || 'Falha ao deletar o produto.', 'error');
        }
    } catch (error) {
        thematicAlert('Erro de ConexÃ£o', 'NÃ£o foi possÃ­vel comunicar com o servidor.', 'error');
    }
}

// ==========================================================
// CARRINHO E VENDAS (PDV)
// ==========================================================


function updateCartTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    // Ajustes de desconto/adicional (se os campos existirem no checkout)
    const discount = document.getElementById('discount_amount') ? getNumberValue('discount_amount') : 0;
    const additional = document.getElementById('additional_amount') ? getNumberValue('additional_amount') : 0;
    const adjustedTotal = Math.max(0, total - discount + additional);

    const el = document.getElementById('cartTotal');
    if (el) el.textContent = formatCurrency(adjustedTotal);
    // Atualiza tambÃ©m o total exibido no modal de checkout quando existente
    const checkoutEl = document.getElementById('checkoutTotalValue');
    if (checkoutEl) checkoutEl.textContent = formatCurrency(adjustedTotal);
    return adjustedTotal;
}



function updateChange() {
    const total = updateCartTotal();
    const paid = parseFloat(document.getElementById('paid_amount')?.value || '0') || 0;
    const change = paid - total;
    const changeSpan = document.getElementById('checkoutChangeValue');

    if (changeSpan) {
        changeSpan.textContent = formatCurrency(Math.max(0, change));

        if (change < 0) {
            changeSpan.style.color = 'var(--color-danger)';
        } else if (change > 0) {
            changeSpan.style.color = 'var(--color-success)';
        } else {
            changeSpan.style.color = 'var(--color-secondary)';
        }
    }

    // Habilita o botÃ£o de confirmaÃ§Ã£o apenas se o valor pago for suficiente
    const confirmBtn = document.getElementById('modalCheckoutConfirm');
    if (confirmBtn) confirmBtn.disabled = change < 0;
}

function clearCart() {
    cart = [];
    renderCart();
}

function renderCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    cartItemsDiv.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="muted" style="text-align:center; padding: 20px;">Carrinho vazio.</div>';
    }

    cart.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <span class="item-qty">${item.qty}x</span>
            <div class="item-info">
                ${item.name} (${item.id})
                <br>
                <small>${formatCurrency(item.price)} x ${item.qty} = <strong>${formatCurrency(item.price * item.qty)}</strong></small>
            </div>
            <span class="item-remove" onclick="removeFromCart(${index})"><i class="fas fa-times-circle"></i></span>
        `;
        cartItemsDiv.appendChild(itemDiv);
    });

    updateCartTotal();
}

function addToCartLogic() {
    const code = document.getElementById('inputProductCode').value.trim();
    const qty = parseInt(document.getElementById('inputQuantity').value);

    if (!code || qty < 1) {
        return thematicAlert('Erro', 'Informe o cÃ³digo do produto e a quantidade.', 'error');
    }
    
    const product = products.find(p => p.id.toLowerCase() === code.toLowerCase());

    if (!product) {
        return thematicAlert('Erro', `Produto com cÃ³digo '${code}' nÃ£o encontrado no estoque.`, 'error');
    }
    
    if (product.stock < qty) {
        return thematicAlert('Estoque Insuficiente', `O produto ${product.name} tem apenas ${product.stock} unidades em estoque.`, 'error');
    }

    const existingItemIndex = cart.findIndex(item => item.id === product.id);

    if (existingItemIndex > -1) {
        // Se jÃ¡ existe, apenas atualiza a quantidade (com checagem de estoque)
        const newQty = cart[existingItemIndex].qty + qty;
        if (product.stock < newQty) {
            return thematicAlert('Estoque Insuficiente', `Adicionando ${qty} excederia o estoque.`, 'error');
        }
        cart[existingItemIndex].qty = newQty;
    } else {
        // SenÃ£o, adiciona um novo item
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            qty: qty
        });
    }

    document.getElementById('inputProductCode').value = '';
    document.getElementById('inputQuantity').value = 1;
    document.getElementById('inputProductCode').focus();
    renderCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

// ==========================================================
// AÃ‡ÃƒO: Finalizar Venda (SAVE e Baixa de Estoque)
// ==========================================================
async function finishSale() {
    const total = updateCartTotal();
    if (total === 0) {
        thematicAlert('Carrinho vazio', 'Adicione itens ao carrinho antes de finalizar a venda.', 'error');
        return;
    }
    
    const payment_method = document.getElementById('payment_method').value;
    const paid_amount = parseFloat(document.getElementById('paid_amount').value) || 0;
    const change = paid_amount - total;

    if (!payment_method) {
        return thematicAlert('Erro', 'Selecione a Forma de Pagamento.', 'error');
    }
    
    if (change < 0) {
         return thematicAlert('Erro', 'Valor pago insuficiente.', 'error');
    }

    
const saleData = {
    total: total,
    payment_method: payment_method,
    discount: document.getElementById('discount_amount') ? getNumberValue('discount_amount') : 0,
    additional: document.getElementById('additional_amount') ? getNumberValue('additional_amount') : 0,
    notes: document.getElementById('sale_notes') ? document.getElementById('sale_notes').value.trim() : '',
    cart_items: cart,

    customer_name: document.getElementById('customer_name') ? document.getElementById('customer_name').value.trim() : '',
    customer_cpf: document.getElementById('customer_cpf') ? document.getElementById('customer_cpf').value.replace(/\D/g,'') : '',
};


    try {
        const response = await fetch('/api/sales/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });

        const result = await response.json();

        if (response.ok) {
            lastSale = Object.assign({}, result.sale_details, { sale_id: result.sale_id }); // Armazena para impressÃ£o
            thematicAlert('Venda ConcluÃ­da', `Venda #${result.sale_id.substring(6)} registrada e estoque atualizado!`, 'success');
            
            hide('modalCheckout');
            clearCart();
            loadProducts(); // Recarrega produtos e KPIs
            
            // Imprime automaticamente a nota/recibo imediatamente (sem prompt)
            try {
                printReceipt(lastSale);
            } catch (e) {
                console.error('Erro ao imprimir recibo automaticamente:', e);
            }

        } else {
            thematicAlert('Erro de Venda', result.message || 'Falha ao finalizar a venda.', 'error');
        }
    } catch (error) {
        thematicAlert('Erro de ConexÃ£o', 'NÃ£o foi possÃ­vel conectar ao servidor para finalizar a venda.', 'error');
        console.error('Erro ao finalizar venda:', error);
    }
}

// ==========================================================
// HELPER numÃ©rico para inputs (retorna 0 se vazio/Nan)
function getNumberValue(elId) {
    const v = parseFloat((document.getElementById(elId)?.value || '0').replace(',', '.'));
    return isNaN(v) ? 0 : v;
}

// ==========================================================
// IMPRESSÃƒO DE NOTA/RECIBO
// ==========================================================
function printReceipt(sale) {
    if (!sale) {
        return thematicAlert('Erro', 'Nenhuma venda para imprimir.', 'error');
    }

    const receiptWindow = window.open('', '_blank', 'width=300,height=500');
    if (!receiptWindow) {
        thematicAlert('Erro', 'Pop-ups bloqueados. NÃ£o foi possÃ­vel abrir a janela de impressÃ£o.', 'error');
        return;
    }

    // Busca dados da loja (tenta de window.storeInfo, senÃ£o de localStorage, senÃ£o valores padrÃ£o)
    const store = window.storeInfo || {
        name: localStorage.getItem('store_name') || 'Minha Loja',
        owner: localStorage.getItem('store_owner') || '',
        cnpj: localStorage.getItem('store_cnpj') || '',
        address: localStorage.getItem('store_address') || '',
        phone: localStorage.getItem('store_phone') || ''
    };

    // ConteÃºdo HTML Simples para Recibo com dados da loja
    let content = `
        <html>
        <head>
            <title>Recibo - ${sale.sale_id}</title>
            <style>
                body { font-family: monospace; font-size: 11px; padding: 8px; }
                h1, h2, h3 { text-align: center; margin: 4px 0; }
                .line { border-bottom: 1px dashed black; margin: 6px 0; }
                .item { display: flex; justify-content: space-between; margin: 3px 0; }
                .total { font-size: 12px; font-weight: bold; margin-top: 8px; }
                .store-info { text-align: center; margin-bottom: 6px; }
                .small { font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="store-info">
                <h2>${store.name}</h2>
                ${store.owner ? `<div class="small">ProprietÃ¡rio: ${store.owner}</div>` : ''}
                ${store.address ? `<div class="small">${store.address}</div>` : ''}
                ${(store.cnpj || store.phone) ? `<div class="small">${store.cnpj ? 'CNPJ: ' + store.cnpj : ''}${(store.cnpj && store.phone) ? ' | ' : ''}${store.phone ? 'Tel: ' + store.phone : ''}</div>` : ''}
            </div>
            <h3>RECIBO DE VENDA</h3>
            <div class="line"></div>
            <p class="small">Venda ID: ${sale.sale_id ? sale.sale_id.substring(6) : ''}</p>
            <p class="small">Data: ${new Date(sale.sale_date || Date.now()).toLocaleString('pt-BR')}</p>
            <div class="line"></div>
            <p class="small">Qtd.  DescriÃ§Ã£o                     PreÃ§o Un.   Total</p>
    `;

    sale.cart_items.forEach(item => {
        const desc = (item.name || '').substring(0, 22).padEnd(22, ' ');
        content += `
            <div class="item small">
                <span>${String(item.qty).padEnd(3,' ')} ${desc}</span>
                <span>${formatCurrency(item.price)}   ${formatCurrency(item.price * item.qty)}</span>
            </div>
        `;
    });

    content += `
            <div class="line"></div>
            <div class="item total">
                <span>TOTAL:</span>
                <span>${formatCurrency(sale.total)}</span>
            </div>
            <div class="item small">
                <span>Pagamento:</span>
                <span>${sale.payment_method || ''}</span>
            </div>
            <div class="line"></div>
            <div class="small">
                <p><strong>Desconto:</strong> ${formatCurrency((sale.discount||0))}</p>
                <p><strong>Adicional:</strong> ${formatCurrency((sale.additional||0))}</p>
                ${ sale.notes ? `<p><strong>ObservaÃ§Ãµes:</strong> ${sale.notes}</p>` : '' }
            </div>
            <div class="line"></div>
            <h3>Obrigado! Volte Sempre.</h3>
        </body>
        </html>
    `;

    receiptWindow.document.write(content);
    receiptWindow.document.close();
    receiptWindow.print();
    receiptWindow.onafterprint = () => receiptWindow.close();
}


// ==========================================================
// RELATÃ“RIOS (Busca e GeraÃ§Ã£o de PDF)
// ==========================================================
async function loadSalesData() {
    try {
        // Pega datas dos filtros se existirem
        const fromDate = document.getElementById('reportFrom')?.value || '';
        const toDate = document.getElementById('reportTo')?.value || '';
        
        let url = '/api/sales/report';
        if (fromDate && toDate) {
            url += `?from=${fromDate}&to=${toDate}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.ok) {
            const salesList = result.sales;
            const totalRevenue = salesList.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
            
            // Calcula lucro estimado baseado nos produtos vendidos
            let totalProfit = 0;
            for (const sale of salesList) {
                // Para cada venda, busca os itens e calcula lucro
                // Como nÃ£o temos os itens detalhados na resposta, vamos estimar 30% de margem
                // Em produÃ§Ã£o, vocÃª pode melhorar isso consultando sale_items
                totalProfit += totalRevenue * 0.3; // Estimativa de 30% de lucro
            }

            document.getElementById('kpiSalesCount').textContent = salesList.length;
            document.getElementById('kpiTotalRevenue').textContent = formatCurrency(totalRevenue);
            document.getElementById('kpiProfit').textContent = formatCurrency(totalProfit);
            
            return salesList;
        }
    } catch (error) {
        console.error('Falha ao carregar dados de vendas para KPIs:', error);
    }
    return [];
}


async function generateReport() {
    const { jsPDF } = window.jspdf;
    const salesList = await loadSalesData();

    if (salesList.length === 0) {
        return thematicAlert('RelatÃ³rio Vazio', 'NÃ£o hÃ¡ vendas registradas no perÃ­odo selecionado.', 'info');
    }
        
    const totalSales = salesList.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    const estimatedProfit = totalSales * 0.3; // 30% de margem estimada
    
    // Configurar o PDF
    const doc = new jsPDF();
    
    // Dados da loja para o cabeÃ§alho (se disponÃ­veis)
    const store = window.storeInfo || {
        name: localStorage.getItem('store_name') || 'Minha Loja',
        owner: localStorage.getItem('store_owner') || '',
        cnpj: localStorage.getItem('store_cnpj') || '',
        phone: localStorage.getItem('store_phone') || '',
        address: localStorage.getItem('store_address') || ''
    };

    // PerÃ­odo do relatÃ³rio
    const fromDate = document.getElementById('reportFrom')?.value || '';
    const toDate = document.getElementById('reportTo')?.value || '';
    const period = (fromDate && toDate) ? ` (${fromDate} a ${toDate})` : ' (Todas as vendas)';

    doc.setFontSize(18);
    doc.text(store.name, 14, 20);
    doc.setFontSize(10);
    const storeMeta = [];
    if (store.owner) storeMeta.push(`ProprietÃ¡rio: ${store.owner}`);
    if (store.cnpj) storeMeta.push(`CNPJ: ${store.cnpj}`);
    if (store.phone) storeMeta.push(`Tel: ${store.phone}`);
    if (store.address) storeMeta.push(store.address);
    if (storeMeta.length) doc.text(storeMeta.join(' | '), 14, 26);

    doc.setFontSize(14);
    doc.text(`RELATÃ“RIO DE VENDAS${period}`, 14, 36);
    
    doc.setFontSize(12);
    doc.text(`Faturamento Total: ${formatCurrency(totalSales)}`, 14, 44);
    doc.text(`Lucro Estimado (30%): ${formatCurrency(estimatedProfit)}`, 14, 50);
    doc.text(`Total de TransaÃ§Ãµes: ${salesList.length}`, 14, 56);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 62);

    // Preparar dados para a tabela
    const tableData = salesList.map(sale => [
        sale.id.substring(6), // ID mais curto
        new Date(sale.sale_date).toLocaleString('pt-BR'),
        formatCurrency(sale.total),
        sale.payment_method
    ]);
    
    // Gerar Tabela (usando autotable)
    doc.autoTable({
        startY: 70, 
        head: [['ID Venda', 'Data/Hora', 'Valor', 'Pagamento']],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] } // Preto no CabeÃ§alho
    });
    
    doc.save(`Relatorio_PDV_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    thematicAlert('Sucesso!', 'RelatÃ³rio PDF gerado com sucesso!', 'success');
}


// ==========================================================
// InicializaÃ§Ã£o e ConexÃµes de BotÃµes

// Adiciona 1 unidade ao carrinho direto pela listagem
function addProductToCartById(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        return thematicAlert('Erro', 'Produto nÃ£o encontrado.', 'error');
    }
    const qty = 1;
    const existingIndex = cart.findIndex(item => item.id === product.id);
    const desiredQty = (existingIndex > -1 ? cart[existingIndex].qty : 0) + qty;
    if (product.stock < desiredQty) {
        return thematicAlert('Estoque Insuficiente', `SÃ³ hÃ¡ ${product.stock} unidade(s) de ${product.name}.`, 'error');
    }
    if (existingIndex > -1) {
        cart[existingIndex].qty += qty;
    } else {
        cart.push({ id: product.id, name: product.name, price: product.price, qty });
    }
    renderCart();
    updateCartTotal();
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
        console.warn('Erro ao fazer logout no servidor:', e);
    }
    // Limpa localStorage
    localStorage.clear();
    // Redireciona para login
    window.location.href = 'ilogin.html';
}

// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica autenticaÃ§Ã£o
    if (!checkAuth()) return;
    
    // Define data padrÃ£o nos filtros (hoje)
    const today = new Date().toISOString().split('T')[0];
    const fromInput = document.getElementById('reportFrom');
    const toInput = document.getElementById('reportTo');
    if (fromInput) fromInput.value = today;
    if (toInput) toInput.value = today;
    
    // Carrega os dados iniciais
    loadProducts(); 
    loadSalesData();
    
    // Eventos do Modal de Produto (registro defensivo)
    const _btnSaveProduct = document.getElementById('btnSaveProduct');
    if (_btnSaveProduct) _btnSaveProduct.addEventListener('click', saveProduct);

    const _searchProduct = document.getElementById('searchProduct');
    if (_searchProduct) _searchProduct.addEventListener('input', (e) => loadProducts(e.target.value));

    // Eventos do Carrinho
    const _btnAddToCart = document.getElementById('btnAddToCart');
    if (_btnAddToCart) _btnAddToCart.addEventListener('click', addToCartLogic);

    const _btnClearCart = document.getElementById('btnClearCart');
    if (_btnClearCart) _btnClearCart.addEventListener('click', clearCart);

    const _btnCheckout = document.getElementById('btnCheckout');
    if (_btnCheckout) _btnCheckout.addEventListener('click', () => {
        if (cart.length === 0) {
            return thematicAlert('Carrinho Vazio', 'Adicione produtos ao carrinho antes de finalizar a venda.', 'info');
        }
        // Reset/ajusta campos do checkout e abre modal
        const paidEl = document.getElementById('paid_amount');
        if (paidEl) paidEl.value = '0.00';
        // Atualiza totais exibidos (leva em conta desconto/adicional)
        updateChange();
        show('modalCheckout');
    });

    // Eventos do Checkout e Troco
    const _paidAmount = document.getElementById('paid_amount');
    if (_paidAmount) _paidAmount.addEventListener('input', updateChange);

    const _modalCheckoutConfirm = document.getElementById('modalCheckoutConfirm');
    if (_modalCheckoutConfirm) _modalCheckoutConfirm.addEventListener('click', finishSale);

    // Inputs que afetam o total (desconto/adicional) â€” recalculam troco quando alterados
    const _discount = document.getElementById('discount_amount');
    if (_discount) _discount.addEventListener('input', updateChange);

    const _additional = document.getElementById('additional_amount');
    if (_additional) _additional.addEventListener('input', updateChange);

    // Eventos do RelatÃ³rio
    const _btnGenerateReport = document.getElementById('btnGenerateReport');
    if (_btnGenerateReport) _btnGenerateReport.addEventListener('click', generateReport);

    // Evento de Sair (Logout)
    const _btnLogout = document.getElementById('btnLogout');
    if (_btnLogout) _btnLogout.addEventListener('click', logout);
});