// Variáveis Globais (Se faltarem, adicione as declarações necessárias)
let cart = []; // Carrinho de compras
let products = []; // Lista de produtos
let storeData = {}; // Dados da Loja

// ==========================================================
// FUNÇÕES UTILITÁRIAS (show/hide/formatCurrency)
// ==========================================================
function show(id) { document.getElementById(id).style.display = 'flex'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function formatCurrency(value) {
    if (typeof value === 'string') {
        value = value.replace('R$', '').replace('.', '').replace(',', '.').trim();
    }
    // Garante que o valor é um número antes de formatar
    const numValue = parseFloat(value) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numValue);
}

// ==========================================================
// FUNÇÃO DE ALERTA CUSTOMIZADO (Implementação Completa)
// Requer Font Awesome icons na página HTML
// ==========================================================
function thematicAlert(title, message, type = 'info') {
    const alertModal = document.getElementById('customAlert');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const alertIcon = document.getElementById('alertIcon');

    // Mapeamento de ícones e classes
    let iconClass = 'fas fa-info-circle';
    let typeClass = 'info';

    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            typeClass = 'success';
            break;
        case 'error':
            iconClass = 'fas fa-times-circle';
            typeClass = 'error';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            typeClass = 'warning';
            break;
        case 'info':
        default:
            iconClass = 'fas fa-info-circle';
            typeClass = 'info';
            break;
    }

    alertTitle.textContent = title;
    alertMessage.textContent = message;

    // Remove classes anteriores e aplica o ícone e a cor corretos
    alertIcon.className = `custom-alert-icon ${iconClass} ${typeClass}`;
    
    // Exibe o modal (assumindo que o alertCloseBtn já está conectado no DOMContentLoaded)
    alertModal.style.display = 'flex';
    alertModal.classList.add('show');
}

// Conexão do botão de fechar o alerta
document.addEventListener('DOMContentLoaded', () => {
    const alertCloseBtn = document.getElementById('alertCloseBtn');
    if (alertCloseBtn) {
        alertCloseBtn.onclick = () => {
            const alertModal = document.getElementById('customAlert');
            alertModal.classList.remove('show');
            // Pequeno delay para a animação de opacidade
            setTimeout(() => { hide('customAlert'); }, 300); 
        };
    }
});


// ==========================================================
// FUNÇÃO CARREGAR CONFIGURAÇÃO DA LOJA (para recibo/relatório)
// ==========================================================
async function loadStoreConfig() {
    try {
        // Simulação de busca no backend
        const response = { 
            ok: true, 
            json: async () => ({
                data: JSON.parse(localStorage.getItem('storeConfig')) || { 
                    nome_fantasia: 'LK Imports PDV', 
                    cnpj: '00.000.000/0000-00', 
                    endereco: 'Endereço Padrão' 
                } 
            })
        };
        const result = await response.json();

        if (response.ok && result.data && Object.keys(result.data).length > 0) {
            storeData = result.data;
        } else {
            storeData = { nome_fantasia: 'LK Imports PDV', cnpj: '00.000.000/0000-00', endereco: 'Endereço Padrão' };
        }
        
        // Pré-preenche modal de configuração
        document.getElementById('configRazaoSocial').value = storeData.razao_social || storeData.nome_fantasia;
        document.getElementById('configCNPJ').value = storeData.cnpj || '';
        document.getElementById('configEndereco').value = storeData.endereco || '';

    } catch (error) {
        // Se a busca falhar, usa dados padrão
        storeData = { nome_fantasia: 'LK Imports (OFFLINE)', cnpj: '00.000.000/0000-00', endereco: 'Servidor Desconectado' };
        console.error('Erro ao buscar config da loja. Usando dados padrão:', error);
    }
}


// ==========================================================
// FUNÇÕES DE CARRINHO
// ==========================================================
function renderCartItems() {
    const cartItemsEl = document.getElementById('cartItems');
    if (!cartItemsEl) return;
    
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<div class="muted" style="text-align:center; padding: 20px;">Carrinho vazio. Adicione itens.</div>';
        return;
    }

    cartItemsEl.innerHTML = cart.map((item, index) => `
        <div class="cart-row" data-index="${index}">
            <span class="small">${item.qty}x ${item.name}</span>
            <span>${formatCurrency(item.price * item.qty)}</span>
            <button onclick="removeFromCart(${index})" class="btn-danger btn-small">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

function updateCartTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const cartTotalEl = document.getElementById('cartTotal');
    if (cartTotalEl) {
        cartTotalEl.textContent = formatCurrency(total);
    }
    return total;
}

function clearCart() {
    cart = [];
    renderCartItems();
    updateCartTotal();
}

function removeFromCart(index) {
    if (index >= 0 && index < cart.length) {
        const removedItem = cart[index];
        cart.splice(index, 1);
        renderCartItems();
        updateCartTotal();
        thematicAlert('Removido', `${removedItem.name} removido do carrinho.`, 'warning');
    }
}

function addToCart() {
    const codeEl = document.getElementById('codeSearch');
    const qtyEl = document.getElementById('qty');
    
    const code = codeEl ? codeEl.value.trim() : '';
    const qty = parseInt(qtyEl ? qtyEl.value : '0');

    if (!code || qty < 1) {
        thematicAlert('Atenção', 'Insira um código de produto e uma quantidade válida.', 'warning');
        return;
    }
    
    // Simulação de busca de produto:
    const mockProduct = { code: code, name: `Produto ${code}`, price: 10.00 + (Math.random() * 5) };

    const existingItemIndex = cart.findIndex(item => item.code === code);

    if (existingItemIndex !== -1) {
        cart[existingItemIndex].qty += qty;
    } else {
        cart.push({ ...mockProduct, qty: qty });
    }
    
    renderCartItems();
    updateCartTotal();
    thematicAlert('Item Adicionado', `${qty}x ${mockProduct.name} adicionado ao carrinho.`, 'success');

    // Limpa campos após adicionar
    if (codeEl) codeEl.value = '';
    if (qtyEl) qtyEl.value = '1';
    if (codeEl) codeEl.focus();
}


// ==========================================================
// AÇÃO: Finalizar Venda (Para salvar no DB)
// ==========================================================
async function finishSale() {
    const total = updateCartTotal(); 
    if (total === 0) {
        thematicAlert('Carrinho Vazio', 'Adicione produtos ao carrinho antes de finalizar a venda.', 'info');
        return;
    }
    
    const paymentMethodEl = document.getElementById('payment_method');
    const customerNameEl = document.getElementById('cust_name');
    const customerCpfEl = document.getElementById('cust_cpf');

    const payment_method = paymentMethodEl ? paymentMethodEl.value : '';
    const customer_name = customerNameEl ? customerNameEl.value : '';
    const customer_cpf = customerCpfEl ? customerCpfEl.value : '';

    if (!payment_method) {
        thematicAlert('Erro', 'Selecione a Forma de Pagamento.', 'error');
        return;
    }

    const saleData = {
        id: crypto.randomUUID(), // ID único para simulação
        sale_date: new Date().toISOString(),
        totalSale: total, // Nome ajustado para simular o backend/dashboard
        payment_method: payment_method,
        cart_items: cart
        // ... (resto dos dados do cliente)
    };

    try {
        // Simulação de POST para o backend
        // No mundo real, você faria um fetch('/api/sales/finish', ...)
        const response = { ok: true, json: async () => ({ sale_id: saleData.id.substring(0, 8), message: 'Venda registrada com sucesso!' }) };
        const result = await response.json();

        if (response.ok) {
            thematicAlert('Venda Concluída', `Venda #${result.sale_id} registrada com sucesso!`, 'success');
            hide('modalCheckout');
            
            // SIMULAÇÃO DE SALVAR NO LOCAL STORAGE (Se estivesse usando DB, isso seria desnecessário)
            const currentSales = JSON.parse(localStorage.getItem('sales')) || [];
            currentSales.push(saleData);
            localStorage.setItem('sales', JSON.stringify(currentSales));
            
            clearCart();
            
            // Chama o recarregamento do dashboard (se estiver presente)
            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData();
            }

        } else {
            thematicAlert('Erro', result.message || 'Falha ao finalizar a venda no servidor.', 'error');
        }
    } catch (error) {
        thematicAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para finalizar a venda.', 'error');
        console.error('Erro ao finalizar venda:', error);
    }
}

// ==========================================================
// AÇÃO: Gerar Relatório (Usando jsPDF) - Renomeada para evitar conflito
// ==========================================================
async function generateReport() {
    const { jsPDF } = window.jspdf;
    
    try {
        // 1. Buscar os dados de vendas
        const salesList = JSON.parse(localStorage.getItem('sales')) || [];
        
        if (salesList.length === 0) {
            thematicAlert('Relatório Vazio', 'Não há vendas registradas na memória local.', 'info');
            return;
        }
        
        // 2. Processar os dados
        const totalSales = salesList.reduce((sum, sale) => sum + sale.totalSale, 0); // Usando totalSale
        
        // 3. Configurar o PDF
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text("Relatório Detalhado de Vendas", 14, 22);
        
        doc.setFontSize(11);
        doc.text(`Loja: ${storeData.nome_fantasia}`, 14, 30);
        doc.text(`Total de Vendas: ${salesList.length}`, 14, 37);
        doc.text(`Faturamento Total: ${formatCurrency(totalSales)}`, 14, 44);
        doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 51);

        // Preparar dados para a tabela
        const tableData = salesList.map(sale => [
            sale.id.substring(0, 8),
            new Date(sale.sale_date).toLocaleString('pt-BR'),
            formatCurrency(sale.totalSale),
            sale.payment_method
        ]);
        
        // Gerar Tabela (usando autotable)
        doc.autoTable({
            startY: 65, 
            head: [['ID', 'Data/Hora', 'Valor', 'Pagamento']],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 212, 0], textColor: [17, 17, 17] } // Cores Amarelo/Preto
        });
        
        doc.save(`Relatorio_Vendas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
        thematicAlert('Sucesso!', 'Relatório de vendas gerado com sucesso!', 'success');

    } catch (error) {
        thematicAlert('Erro de Geração', 'Falha ao gerar o PDF. Verifique se as bibliotecas (jsPDF/autotable) estão carregadas.', 'error');
        console.error('Erro ao gerar relatório:', error);
    }
}

// ==========================================================
// AÇÃO: ZERAR VENDAS (Finalizar o Dia)
// ==========================================================
function clearSales() {
    // Implementa um alerta de confirmação via thematicAlert
    thematicAlert('Confirmar Finalização', 'Deseja realmente **FINALIZAR O DIA**? Isso irá zerar o total de vendas na memória local. Esta ação é irreversível.', 'danger');
    
    // Adicionar um listener temporário para o botão OK do alerta para a ação de limpeza
    const confirmOkBtn = document.getElementById('alertCloseBtn'); // Reusando o botão OK do alerta simples
    
    // Remove o listener de fechar padrão temporariamente
    confirmOkBtn.onclick = null; 

    // Altera o texto do botão para refletir a ação de confirmação
    confirmOkBtn.textContent = 'SIM, ZERAR DADOS';
    confirmOkBtn.classList.remove('btn-primary');
    confirmOkBtn.classList.add('btn-danger');


    confirmOkBtn.onclick = () => {
        // Limpar o localStorage de vendas
        localStorage.removeItem('sales');
        thematicAlert('Dia Finalizado!', 'O contador de vendas de hoje foi zerado com sucesso.', 'success');
        
        // Se a função loadDashboardData for global, chame-a:
        if (typeof window.loadDashboardData === 'function') {
            window.loadDashboardData();
        }

        // Restaura o botão de alerta para o estado padrão
        confirmOkBtn.onclick = () => {
             const alertModal = document.getElementById('customAlert');
             alertModal.classList.remove('show');
             setTimeout(() => { hide('customAlert'); }, 300);
        };
        confirmOkBtn.textContent = 'OK';
        confirmOkBtn.classList.add('btn-primary');
        confirmOkBtn.classList.remove('btn-danger');
    };
}


// ==========================================================
// AÇÃO: SALVAR CONFIGURAÇÃO DA LOJA
// ==========================================================
function saveStoreConfig() {
    const razaoSocial = document.getElementById('configRazaoSocial').value.trim();
    const cnpj = document.getElementById('configCNPJ').value.trim();
    const endereco = document.getElementById('configEndereco').value.trim();

    if (!razaoSocial || !cnpj) {
        thematicAlert('Atenção', 'Razão Social e CNPJ são obrigatórios.', 'warning');
        return;
    }

    const newConfig = {
        razao_social: razaoSocial,
        nome_fantasia: razaoSocial, // Usando o mesmo
        cnpj: cnpj,
        endereco: endereco,
    };
    
    // Salva na variável global e no localStorage
    storeData = newConfig;
    localStorage.setItem('storeConfig', JSON.stringify(newConfig));
    
    thematicAlert('Configurações Salvas', 'Os dados da loja foram atualizados e carregados.', 'success');
    hide('modalStore');
}


// ==========================================================
// Inicialização e Conexões de Botões (FINAL)
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    loadStoreConfig(); // Carrega os dados da loja ao iniciar
    
    // -----------------------------------------------------------------
    // CONEXÕES DO PDV (CARRINHO E CHECKOUT)
    // -----------------------------------------------------------------
    
    // 1. Botão Adicionar ao Carrinho
    const btnAddCart = document.getElementById('btnAddToCart');
    if (btnAddCart) {
        btnAddCart.addEventListener('click', addToCart);
    }
    
    // 2. Botão Confirmar Venda (no modal de checkout)
    const btnCheckoutConfirm = document.getElementById('modalCheckoutConfirm');
    if (btnCheckoutConfirm) {
        btnCheckoutConfirm.addEventListener('click', finishSale);
    }
    
    // 3. Botão Limpar Carrinho
    const btnClearCart = document.getElementById('btnClearCart');
    if (btnClearCart) {
        btnClearCart.addEventListener('click', clearCart);
    }


    // -----------------------------------------------------------------
    // CONEXÕES DE GESTÃO (DASHBOARD)
    // -----------------------------------------------------------------
    
    // 4. Botão Gerar Relatório
    const btnReport = document.getElementById('btnReport');
    if (btnReport) {
        btnReport.addEventListener('click', generateReport);
    }
    
    // 5. Botão Finalizar Dia / Zerar Vendas
    const btnClearSales = document.getElementById('btnClearSales');
    if (btnClearSales) {
        btnClearSales.addEventListener('click', clearSales);
    }

    // 6. Botão Salvar Configurações (no modal)
    const btnStoreSave = document.getElementById('btnStoreSave');
    if (btnStoreSave) {
        btnStoreSave.addEventListener('click', saveStoreConfig);
    }
    
    // Inicializa a renderização do carrinho
    renderCartItems(); 
});