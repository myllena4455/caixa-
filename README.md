# LK Caixa - Sistema PDV

Sistema de ponto de venda com gestão de estoque.

## Funcionalidades

- Login e autenticação (Admin, Gerente, Funcionário)
- Gestão de produtos (cadastro, edição, exclusão)
- Carrinho de compras e finalização de vendas
- Impressão automática de recibo
- Relatórios em PDF
- Dashboard com indicadores de vendas
- Controle de estoque com alertas
- Descontos e acréscimos
- Registro de dados do cliente

## Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** PHP 7.4+
- **Banco:** MySQL
- **Bibliotecas:** jsPDF, FontAwesome

## Instalação

1. Clone o repositório
2. Copie `config/db.example.php` para `config/db.php`
3. Configure credenciais do banco em `config/db.php`
4. Importe `sql/schema.sql` no MySQL
5. Acesse `ilogin.html` e crie sua conta
