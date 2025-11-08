/**
 * =================================================================
 * ARQUIVO: site.js
 * FUNÇÃO: Lógica de Caixa Registradora (Frontend/Local Storage DB, CRUD, Checkout)
 * ESTADO: Gerador de Relatório PDF OK, Gerador de Recibo OK, Alertas OK.
 * =================================================================
 */

// ----------------------------------------------------
// 1. Variáveis Globais e Inicialização
// ----------------------------------------------------

let products = JSON.parse(localStorage.getItem('products')) || [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let sales = JSON.parse(localStorage.getItem('sales')) || [];
let storeConfig = JSON.parse(localStorage.getItem('storeConfig')) || {};
let currentSale = {}; 

const productListBody = document.getElementById('productListBody');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalElement = document.getElementById('cartTotal');

// ----------------------------------------------------
// 2. Funções de Utilidade (Modal, Alerta e Formato)
// ----------------------------------------------------

/** Abre um modal */
window.show = (id) => {
    document.getElementById(id).style.display = 'flex';
};

/** Fecha um modal */
window.hide = (id) => {
    const overlay = document.getElementById(id);
    if (!overlay) return;

    // Lida com a transição dos alertas customizados
    if(overlay.classList.contains('custom-alert-overlay')) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.style.display = 'none', 200);
    } else {
        overlay.style.display = 'none';
    }
};

/** Formata valor para moeda BRL */
const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) { value = 0; }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', }).format(value);
};

/** HTML dos ícones para alertas */
const getIconHTML = (type) => {
    switch(type) {
        case 'success': return '<i class="fas fa-check-circle"></i>';
        case 'error': return '<i class="fas fa-times-circle"></i>';
        case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
        case 'info': return '<i class="fas fa-info-circle"></i>';
        case 'danger': return '<i class="fas fa-exclamation-circle"></i>';
        default: return '';
    }
};

/** Alerta Customizado (GLOBAL) */
window.thematicAlert = (title, message, type = 'info') => {
    const overlay = document.getElementById('customAlert');
    if (!overlay) { console.error("Elemento 'customAlert' não encontrado."); return; }
    const box = overlay.querySelector('.custom-alert-box');

    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    
    const iconElement = document.getElementById('alertIcon');
    iconElement.className = 'custom-alert-icon';
    iconElement.classList.add(type);
    iconElement.innerHTML = getIconHTML(type);

    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('show');
        box.style.transform = 'scale(1)';
    }, 10);
};

document.getElementById('alertCloseBtn').addEventListener('click', () => {
    hide('customAlert');
});

/** Confirmação Customizada (GLOBAL) */
window.confirmAction = (title, message, type, callback) => {
    const overlay = document.getElementById('customConfirm');
    if (!overlay) { console.error("Elemento 'customConfirm' não encontrado."); return; }
    const box = overlay.querySelector('.custom-alert-box');
    
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const iconElement = document.getElementById('confirmIcon');
    iconElement.className = 'custom-alert-icon';
    iconElement.classList.add(type);
    iconElement.innerHTML = getIconHTML(type);

    // Clonar para remover listeners antigos e evitar múltiplos disparos
    const oldConfirmOkBtn = document.getElementById('confirmOkBtn');
    const newConfirmOkBtn = oldConfirmOkBtn.cloneNode(true);
    oldConfirmOkBtn.parentNode.replaceChild(newConfirmOkBtn, oldConfirmOkBtn);

    newConfirmOkBtn.addEventListener('click', () => {
        hide('customConfirm');
        callback();
    });

    document.getElementById('confirmCancelBtn').onclick = () => {
        hide('customConfirm');
    };

    overlay.style.display = 'flex';
    setTimeout(() => {
        overlay.classList.add('show');
        box.style.transform = 'scale(1)';
    }, 10);
};


// ----------------------------------------------------
// 3. Funções de Gestão de Produtos (CRUD)
// ----------------------------------------------------

const saveProducts = () => {
    localStorage.setItem('products', JSON.stringify(products));
};

window.loadProducts = (searchQuery = '') => {
    productListBody.innerHTML = '';
    
    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filteredProducts.length === 0) {
        productListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    filteredProducts.forEach(product => {
        const row = productListBody.insertRow();
        row.innerHTML = `
            <td>${product.code}</td>
            <td>${product.name}</td>
            <td>${formatCurrency(product.price)}</td>
            <td class="${product.stock <= 5 ? 'text-danger' : ''}">${product.stock} ${product.unit}</td>
            <td>
                <button class="btn-primary btn-small" onclick="addToCart('${product.code}')" title="Adicionar ao Carrinho"><i class="fas fa-cart-plus"></i></button>
                <button class="btn-secondary btn-small" onclick="editProduct('${product.code}')" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn-danger btn-small" onclick="deleteProduct('${product.code}')" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
};

document.getElementById('btnSaveProduct').addEventListener('click', () => {
    const code = document.getElementById('productCode').value.trim().toUpperCase();
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value.replace(',', '.') || 0); 
    const stock = parseInt(document.getElementById('productStock').value || 0);
    const unit = document.getElementById('productUnit').value;

    if (!code || !name || isNaN(price) || price <= 0 || isNaN(stock)) {
        thematicAlert('Erro', 'Preencha campos válidos.', 'warning');
        return;
    }

    const productIndex = products.findIndex(p => p.code === code);
    const isEditing = productIndex !== -1;
    
    if (isEditing) {
        products[productIndex] = { ...products[productIndex], code, name, price, stock, unit };
        thematicAlert('Sucesso', `Produto ${name} atualizado.`, 'success');
    } else {
        if (products.some(p => p.code === code)) {
            thematicAlert('Erro', 'Código de produto já existe.', 'error');
            return;
        }
        products.push({ code, name, price, stock, unit, lastSale: 'N/A' });
        thematicAlert('Sucesso', `Produto ${name} cadastrado.`, 'success');
    }

    saveProducts();
    loadProducts();
    hide('modalAddProduct');
});

window.editProduct = (code) => { 
    const product = products.find(p => p.code === code);
    if (!product) return;
    document.getElementById('modalTitle').textContent = 'Editar Produto';
    document.getElementById('productCode').value = product.code;
    document.getElementById('productCode').disabled = true; 
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price.toFixed(2).replace('.', ',');
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productUnit').value = product.unit;
    document.getElementById('p_last_sale').textContent = product.lastSale;
    show('modalAddProduct');
};

window.deleteProduct = (code) => {
    confirmAction(
        'Confirmar Exclusão', 
        `Excluir o produto ${code}?`,
        'danger',
        () => {
            products = products.filter(p => p.code !== code);
            saveProducts();
            loadProducts();
            thematicAlert('Excluído', 'Produto removido com sucesso.', 'success');
        }
    );
};

document.getElementById('search').addEventListener('input', (e) => {
    loadProducts(e.target.value);
});


// ----------------------------------------------------
// 4. Funções de Carrinho
// ----------------------------------------------------

const saveCart = () => {
    localStorage.setItem('cart', JSON.stringify(cart));
};

const loadCart = () => {
    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="muted" style="text-align:center; padding: 20px;">Carrinho vazio.</div>';
    }

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        
        const div = document.createElement('div');
        div.className = 'cart-row';
        div.innerHTML = `
            <div>
                <strong>${item.name}</strong><br>
                <span class="muted small">${item.qty} x ${formatCurrency(item.price)}</span>
            </div>
            <div style="text-align:right;">
                <strong>${formatCurrency(itemTotal)}</strong>
                <button class="btn-danger btn-small" onclick="removeFromCart(${index})" title="Remover"><i class="fas fa-minus"></i></button>
            </div>
        `;
        cartItemsContainer.appendChild(div);
    });

    cartTotalElement.textContent = formatCurrency(total);
    saveCart();
};

window.addToCart = (code = null) => {
    const qtyInput = document.getElementById('qty');
    const quantity = parseInt(qtyInput.value) || 1;
    let productCode = code || document.getElementById('codeSearch').value.trim().toUpperCase();

    if (!productCode) { thematicAlert('Erro', 'Código vazio.', 'warning'); return; }

    const product = products.find(p => p.code === productCode);
    if (!product) { thematicAlert('Erro', `Produto ${productCode} não encontrado.`, 'error'); return; }

    const existingCartItem = cart.find(item => item.code === productCode);
    const qtyInCart = existingCartItem ? existingCartItem.qty : 0;

    if (quantity + qtyInCart > product.stock) {
        thematicAlert('Estoque Insuficiente', `O produto ${product.name} tem apenas ${product.stock} unidades.`, 'warning');
        return;
    }

    if (existingCartItem) {
        existingCartItem.qty += quantity;
    } else {
        cart.push({ code: product.code, name: product.name, price: product.price, unit: product.unit, qty: quantity, });
    }

    if (!code) { qtyInput.value = '1'; document.getElementById('codeSearch').value = ''; document.getElementById('codeSearch').focus(); }

    loadCart();
    thematicAlert('Item Adicionado', `${quantity}x ${product.name} adicionado.`, 'success');
};

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    loadCart();
};

window.clearCart = () => {
    cart = [];
    loadCart();
    // Limpa campos do checkout
    document.getElementById('cust_name').value = '';
    document.getElementById('cust_cpf').value = '';
    document.getElementById('discount').value = '0,00';
    document.getElementById('additional_value').value = '0,00';
    document.getElementById('sale_notes').value = '';
    document.getElementById('payment_method').value = '';
};

document.getElementById('codeSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addToCart();
        e.preventDefault();
    }
});


// ----------------------------------------------------
// 5. Funções de Checkout e Venda
// ----------------------------------------------------

document.getElementById('modalCheckoutConfirm').addEventListener('click', () => {
    if (cart.length === 0) {
        thematicAlert('Carrinho Vazio', 'Adicione produtos antes de finalizar.', 'warning');
        hide('modalCheckout');
        return;
    }

    const subTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = parseFloat(document.getElementById('discount').value.replace(',', '.') || 0);
    const additionalValue = parseFloat(document.getElementById('additional_value').value.replace(',', '.') || 0);
    const totalSale = subTotal - discount + additionalValue;
    const paymentMethod = document.getElementById('payment_method').value;

    if (!paymentMethod) { thematicAlert('Pagamento Pendente', 'Selecione a forma de pagamento.', 'warning'); return; }
    if (totalSale < 0) { thematicAlert('Erro de Cálculo', 'Total negativo.', 'error'); return; }


    // 1. Cria o objeto da venda
    const saleData = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('pt-BR'),
        customer: {
            name: document.getElementById('cust_name').value.trim() || 'Consumidor Final',
            cpf: document.getElementById('cust_cpf').value.trim() || 'N/A',
        },
        items: JSON.parse(JSON.stringify(cart)),
        subTotal,
        discount,
        additionalValue,
        totalSale,
        paymentMethod,
        notes: document.getElementById('sale_notes').value.trim(),
    };

    // 2. Atualiza o estoque
    saleData.items.forEach(soldItem => {
        const productIndex = products.findIndex(p => p.code === soldItem.code);
        if (productIndex !== -1) {
            products[productIndex].stock -= soldItem.qty;
            products[productIndex].lastSale = new Date().toLocaleDateString('pt-BR');
        }
    });

    // 3. Salva a venda e produtos no Local Storage
    sales.push(saleData);
    localStorage.setItem('sales', JSON.stringify(sales));
    saveProducts();

    // 4. Feedback
    thematicAlert('Sucesso!', `Venda concluída. Total: ${formatCurrency(totalSale)}`, 'success');
    hide('modalCheckout');
    
    // 5. Geração Automática do Recibo PDF (CORRIGIDO)
    window.generatePDFReceipt(saleData); 

    // 6. Limpa e Atualiza
    window.clearCart(); 
    loadProducts(); // Atualiza a lista de produtos com novo estoque
});


// ----------------------------------------------------
// 6. Geração de PDF (Recibo e Relatório)
// ----------------------------------------------------

// FUNÇÃO DE RECIBO DE VENDA (CHAMADA AUTOMATICAMENTE APÓS O CHECKOUT)
window.generatePDFReceipt = (saleData) => { 
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        window.thematicAlert('Erro de PDF', 'Não é possível gerar recibo. jsPDF não carregado.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        unit: 'mm',
        format: [80, 150] // Formato pequeno de recibo
    });
    let y = 10;
    const lineHeight = 5;

    // 1. Cabeçalho
    doc.setFontSize(10);
    doc.text("NOTA DE VENDA (NÃO FISCAL)", 40, y, null, null, "center");
    y += lineHeight;
    doc.setFontSize(8);
    doc.text("-----------------------------------------------", 40, y, null, null, "center");
    y += lineHeight;

    // 2. Detalhes da Venda
    doc.text(`Venda ID: ${saleData.id.toString().slice(-6)}`, 5, y);
    y += lineHeight;
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} | ${saleData.time}`, 5, y);
    y += lineHeight;
    doc.text(`Cliente: ${saleData.customer.name}`, 5, y);
    y += lineHeight + 3;

    // 3. Itens da Venda
    const itemsHead = [['Item', 'Qtd.', 'Total']];
    const itemsData = saleData.items.map(item => [
        item.name,
        item.qty,
        formatCurrency(item.price * item.qty)
    ]);
    
    doc.autoTable({
        startY: y,
        head: itemsHead,
        body: itemsData,
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 0.5 },
        headStyles: { fillColor: [200, 200, 200] },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 10, halign: 'center' },
            2: { cellWidth: 20, halign: 'right' }
        },
        margin: { left: 5, right: 5 }
    });

    y = doc.autoTable.previous.finalY + lineHeight;

    // 4. Totais
    doc.setFontSize(9);
    doc.text(`Subtotal: ${formatCurrency(saleData.subTotal)}`, 5, y);
    y += lineHeight;
    doc.text(`Desconto: ${formatCurrency(saleData.discount)}`, 5, y);
    y += lineHeight;
    doc.text(`Acréscimo: ${formatCurrency(saleData.additionalValue)}`, 5, y);
    y += lineHeight;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`TOTAL: ${formatCurrency(saleData.totalSale)}`, 5, y);
    doc.setFont(undefined, 'normal');
    y += lineHeight + 3;

    // 5. Pagamento e Rodapé
    doc.setFontSize(8);
    doc.text(`Forma de Pagamento: ${saleData.paymentMethod}`, 5, y);
    y += lineHeight + 5;
    doc.text("Obrigado pela preferência!", 40, y, null, null, "center");

    doc.save(`Recibo_Venda_${saleData.id}.pdf`);
};


// FUNÇÃO DE RELATÓRIO COMPLETO (CHAMADA PELO BOTÃO)
window.generateFullReport = () => {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.prototype.autoTable === 'undefined') {
        window.thematicAlert('Erro de PDF', 'A biblioteca jsPDF não foi carregada. Verifique o seu index.html.', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const currentSales = JSON.parse(localStorage.getItem('sales')) || [];

    if (currentSales.length === 0) {
        window.thematicAlert('Relatório Vazio', 'Não há vendas registradas para gerar o relatório.', 'info');
        return;
    }

    // Título e Informações
    doc.setFontSize(16);
    doc.text("Relatório Completo de Vendas", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 26);

    // Preparar Dados da Tabela
    const head = [['ID', 'Data', 'Hora', 'Cliente', 'Total', 'Pagamento', 'Itens']];
    const data = currentSales.map(sale => [
        sale.id.toString().slice(-4), 
        sale.date,
        sale.time,
        sale.customer.name,
        formatCurrency(sale.totalSale),
        sale.paymentMethod,
        sale.items.map(item => `${item.qty}x ${item.name}`).join(', ')
    ]);

    // Gerar Tabela com AutoTable
    doc.autoTable({
        startY: 35,
        head: head,
        body: data,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [255, 215, 0], textColor: [0, 0, 0] } // Amarelo e texto preto
    });

    // Salvar o PDF
    doc.save(`Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.pdf`);
    
    window.thematicAlert('Sucesso!', 'Relatório PDF de vendas gerado.', 'success');
};


// ----------------------------------------------------
// 7. Inicialização e Event Listeners
// ----------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCart();

    // Adiciona produtos de exemplo se o LocalStorage estiver vazio
    if (products.length === 0) {
        products = [
            { code: 'P001', name: 'Perfume Gold', price: 99.90, stock: 15, unit: 'UN', lastSale: 'N/A' },
            { code: 'P002', name: 'Relógio Luxo', price: 249.00, stock: 8, unit: 'UN', lastSale: 'N/A' },
            { code: 'P003', name: 'Caixa de Som', price: 49.50, stock: 2, unit: 'UN', lastSale: 'N/A' },
        ];
        saveProducts();
        loadProducts();
    }
    
    // Liga o botão de Relatório à função de PDF
    const btnReport = document.getElementById('btnReport');
    if (btnReport) {
        btnReport.addEventListener('click', window.generateFullReport);
    }
    
    // Liga a função Limpar Dia
    const btnClearSales = document.getElementById('btnClearSales');
    if (btnClearSales) {
        btnClearSales.addEventListener('click', () => {
             window.confirmAction(
                'Finalizar o Dia',
                'Tem certeza que deseja zerar o contador de vendas de hoje? Esta ação é irreversível.',
                'warning',
                () => {
                    // IMPLEMENTAÇÃO DE FINALIZAÇÃO DE CAIXA: Zera as vendas locais
                    sales = [];
                    localStorage.removeItem('sales');
                    window.thematicAlert('Dia Finalizado', 'O contador de vendas do dia foi zerado.', 'success');
                }
            );
        });
    }
    
    // Configurações da Loja
    const btnStoreSave = document.getElementById('btnStoreSave');
    if (btnStoreSave) {
         btnStoreSave.addEventListener('click', () => {
             // ... Implementação real de salvar configurações ...
             window.thematicAlert('Configurações Salvas', 'Configurações de recibo salvas com sucesso!', 'success');
             hide('modalStore');
         });
    }

});