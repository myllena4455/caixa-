// js/login.js

const el = id => document.getElementById(id);
const loginCard = el('loginCard');
let isRegistering = false; // Estado para alternar entre Login e Cadastro

// 1. Alterna entre Login e Cadastro
el('btnToggleRegister').addEventListener('click', () => {
    isRegistering = !isRegistering;
    el('nameWrapper').style.display = isRegistering ? 'block' : 'none';
    el('registerActions').style.display = isRegistering ? 'block' : 'none';
    el('btnLogin').style.display = isRegistering ? 'none' : 'block';
    
    el('btnToggleRegister').textContent = isRegistering ? 'Voltar ao Login' : 'Novo Cadastro';
    
    // Altera a cor do botão de toggle quando está em modo cadastro
    el('btnToggleRegister').classList.toggle('btn-secondary');
    el('btnToggleRegister').classList.toggle('btn-danger');
});

// 2. Tenta fazer Login
el('btnLogin').addEventListener('click', () => {
    handleAuth('login');
});

// 3. Tenta Cadastrar
el('btnRegister').addEventListener('click', () => {
    handleAuth('register');
});


// Função principal de comunicação com o backend
async function handleAuth(type) {
    const email = el('email').value.trim();
    const password = el('password').value.trim();
    const rememberMe = el('rememberMe').checked;
    const name = isRegistering ? el('name').value.trim() : '';

    if (!email || !password || (type === 'register' && !name)) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }

    const endpoint = (type === 'login') ? '/api/auth/login' : '/api/auth/register';
    const payload = (type === 'login') ? { email, password } : { email, password, name };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            // Sucesso!
            if (type === 'register') {
                alert('✅ Cadastro realizado com sucesso! Faça login agora.');
                // Volta para o modo login
                isRegistering = false;
                el('btnToggleRegister').click(); 
                el('name').value = ''; // Limpa o campo nome
            } else {
                // Login bem-sucedido
                saveLogin(email, rememberMe);
                alert(`Bem-vindo, ${result.user.name || result.user.email}! Redirecionando...`);
                // Redireciona para o Dashboard (sua tela inicial)
                window.location.href = 'dashboard.html'; 
            }
        } else {
            alert(`🛑 Erro de Autenticação: ${result.message}`);
        }

    } catch (error) {
        alert('❌ Erro de Conexão. O servidor (Node.js) está rodando?');
        console.error('Erro de rede:', error);
    }
}

// === Lógica de Salvar/Carregar E-mail ===
function saveLogin(email, remember) {
    if (remember) {
        localStorage.setItem('lk_remember_email', email);
    } else {
        localStorage.removeItem('lk_remember_email');
    }
}

function loadSavedEmail() {
    const savedEmail = localStorage.getItem('lk_remember_email');
    if (savedEmail) {
        el('email').value = savedEmail;
        el('rememberMe').checked = true;
    }
}

// Inicializa a carga do email salvo
document.addEventListener('DOMContentLoaded', loadSavedEmail);