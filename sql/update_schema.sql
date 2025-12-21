-- SQL para atualizar o banco de dados existente
-- Execute este arquivo se você já tem o banco criado

-- Adicionar campo role na tabela users
ALTER TABLE users 
ADD COLUMN role ENUM('admin', 'gerente', 'funcionario') DEFAULT 'admin' AFTER password_hash;

-- Adicionar user_id na tabela products
ALTER TABLE products
ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER id,
ADD COLUMN cost DECIMAL(10,2) DEFAULT 0 AFTER name,
ADD CONSTRAINT fk_user_product FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Adicionar user_id na tabela sales
ALTER TABLE sales
ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER id,
ADD CONSTRAINT fk_user_sale FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Adicionar novos campos na tabela sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS additional DECIMAL(10,2) DEFAULT 0 AFTER discount,
ADD COLUMN IF NOT EXISTS notes TEXT AFTER additional,
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200) AFTER notes,
ADD COLUMN IF NOT EXISTS customer_cpf VARCHAR(20) AFTER customer_name;

-- Criar tabela stores
CREATE TABLE IF NOT EXISTS stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  store_name VARCHAR(200) NOT NULL,
  owner_name VARCHAR(200),
  store_phone VARCHAR(50),
  cnpj VARCHAR(20),
  address TEXT,
  CONSTRAINT fk_user_store FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
