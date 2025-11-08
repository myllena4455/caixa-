/* === Bootstrap de UI para index.html === */
(function(){
  // Helpers básicos
  const el = (id) => document.getElementById(id);
  const sel = (q) => document.querySelector(q);
  const KEY_STORE = 'LK_STORE';
  const safeParse = (t) => { try { return JSON.parse(t||'{}') } catch(e){ return {} } };
  window.el = el; // expõe porque o resto do código usa
  window.KEY_STORE = window.KEY_STORE || KEY_STORE;
  window.store = window.store || safeParse(localStorage.getItem(window.KEY_STORE));

  // Util: esconder elementos por id
  function hide(id){ const n = el(id); if(n) n.style.display='none'; }
  function showFlex(id){ const n = el(id); if(n) n.style.display='flex'; }

  // Fallbacks para funções ausentes
  const notImpl = (name) => () => { console.warn(name + " não está implementada no site.js atual."); };
  const maybe = (fnName) => (typeof window[fnName] === 'function' ? window[fnName] : notImpl(fnName));

  window.addEventListener('DOMContentLoaded', function(){
    const bind = (id, fn) => { const b = el(id); if(b) b.addEventListener('click', fn); };

    // Botões principais (Produtos / Vendas / Relatórios)
    bind('btnAdd',           maybe('addProduct'));
    bind('btnImport',        maybe('importProducts'));
    bind('btnExport',        maybe('exportProducts'));
    bind('btnEmpty',         maybe('clearForm'));
    bind('btnAddToCart',     maybe('addToCart'));
    bind('btnCheckout',      maybe('openCheckoutModal'));
    bind('btnPrintLast',     maybe('printLastReceipt'));
    bind('btnReport',        maybe('generateReport'));
    bind('btnClearSales',    maybe('closeDay'));

    // Configuração da Loja (existem em site.js)
    bind('btnStoreConfig',   () => (typeof openStoreModal === 'function' ? openStoreModal() : showFlex('modalStore')));
    bind('modalStoreSave',   maybe('saveStoreConfig'));
    bind('modalStoreCancel', () => hide('modalStore'));

    // Modais genéricos
    bind('modalCancel',        () => hide('modal'));
    bind('modalCheckoutCancel',() => hide('modalCheckout'));
    bind('modalCheckoutConfirm', maybe('confirmCheckout'));

    // Alertas e Confirmações custom
    bind('alertCloseBtn',    () => hide('customAlert'));
    bind('confirmCancelBtn', () => hide('customConfirm'));
    bind('confirmOkBtn',     maybe('onConfirmOk'));

    console.log('[Bootstrap] Listeners de botões ligados.');
  });
})(); 
/* === Fim do Bootstrap === */


// ... (Código anterior do seu app.js, incluindo as chaves KEY_STORE e a função openStoreModal)

// === FUNÇÕES DE CONFIGURAÇÃO DA LOJA (MODIFICADAS) ===

// openStoreModal (Atualizada para carregar todos os novos campos do HTML)
function openStoreModal(){
    // Este GET para o servidor deve ser implementado no backend para carregar dados
    // Por enquanto, carregamos os dados antigos do localStorage para não quebrar a UI
    el('store_razao_social').value = store.razao_social || '';
    el('store_name').value = store.name || '';
    el('store_cnpj').value = store.cnpj || '';
    el('store_address').value = store.address || '';
    el('store_phone').value = store.phone || '';
    el('store_tax_regime').value = store.regime_tributario || '';

    // Limpa o campo de arquivo (logo)
    el('store_logo_upload').value = ''; 

    el('modalStore').style.display = 'flex';
}


// saveStoreConfig (MODIFICADA para enviar dados ao Backend)
async function saveStoreConfig(){
    // 1. Coleta os dados do formulário (incluindo os novos campos do HTML)
    const storeData = {
        razao_social: el('store_razao_social').value.trim(),
        nome_fantasia: el('store_name').value.trim(),
        cnpj: el('store_cnpj').value.trim(),
        endereco: el('store_address').value.trim(),
        telefone: el('store_phone').value.trim(),
        regime_tributario: el('store_tax_regime').value
    };
    
    const logoFile = el('store_logo_upload').files[0];

    // VERIFICAÇÃO BÁSICA
    if (!storeData.cnpj || !storeData.razao_social) {
        thematicAlert('Atenção!', 'CNPJ e Razão Social são obrigatórios.', 'warning');
        return;
    }

    // 2. Criação do corpo da requisição
    let requestBody;
    let contentType;

    if (logoFile) {
        // Se houver arquivo, usa FormData (multipart)
        const formData = new FormData();
        formData.append('logo', logoFile);
        for (const key in storeData) {
            formData.append(key, storeData[key]);
        }
        requestBody = formData;
        contentType = null; // fetch define automaticamente o Content-Type para FormData
    } else {
        // Se não houver arquivo, usa JSON
        requestBody = JSON.stringify(storeData);
        contentType = 'application/json';
    }

    // 3. TENTATIVA DE COMUNICAÇÃO COM O BACKEND/DB
    try {
        // ATENÇÃO: /api/loja/configurar é o endpoint que você criará no seu backend
        const response = await fetch('/api/loja/configurar', { 
            method: 'POST',
            headers: contentType ? { 'Content-Type': contentType } : {},
            body: requestBody
        });

        if (response.ok) {
            // Se o backend retornar sucesso, atualiza o localStorage localmente (opcional, mas bom para cache)
            // No sistema final, você buscaria o objeto 'store' atualizado do BD
            Object.assign(store, storeData);
            localStorage.setItem(KEY_STORE, JSON.stringify(store));
            
            thematicAlert('Configurações da loja salvas com sucesso no Banco de Dados!', 'Loja Configurada', 'success');
            el('modalStore').style.display = 'none';
        } else {
            const errorData = await response.json();
            thematicAlert('Erro de Servidor!', 'Falha ao salvar: ' + (errorData.message || 'Erro desconhecido'), 'error');
        }
    } catch (error) {
        thematicAlert('Erro de Conexão!', 'Não foi possível conectar ao servidor (Backend).', 'error');
        console.error('Erro de rede:', error);
    }
}

// ... (Resto do seu código app.js)