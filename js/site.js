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