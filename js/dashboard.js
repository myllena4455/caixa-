// js/dashboard.js

// Função para buscar os dados de KPIs e Gráficos no Backend
async function loadDashboardData() {
    try {
        // ESSA ROTA DEVE BATER COM O SEU SERVIDOR BACKEND
        const response = await fetch('/api/dashboard/kpis');
        const data = await response.json();

        if (response.ok) {
            // Atualiza os elementos HTML (KPIs) com os dados do banco de dados
            document.getElementById('kpi_faturamento').textContent = formatCurrency(data.faturamentoHoje || 0);
            document.getElementById('kpi_ticket_medio').textContent = formatCurrency(data.ticketMedio || 0);
            document.getElementById('kpi_estoque_critico').textContent = data.estoqueCritico || 0;
            document.getElementById('kpi_clientes').textContent = data.clientesCadastrados || 0;
            
            // Aqui você chamaria a função que desenha o gráfico (usando Chart.js, por exemplo)
            // drawVendasChart(data.vendasSemana);
        } else {
            console.error('Erro ao buscar KPIs:', data.message);
        }

    } catch (error) {
        console.error('Falha na conexão com o servidor de Dashboard.', error);
        // Alerta visual de que os dados não puderam ser carregados
        document.getElementById('kpi_faturamento').textContent = 'Erro de Conexão';
    }
}

// Função utilitária para formatar valores (se não existir no site.js)
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Inicia o carregamento dos dados quando a página carrega
document.addEventListener('DOMContentLoaded', loadDashboardData);