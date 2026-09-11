-- ============================================================================
-- TECHFLOW ERP - Script de Inicialização do Banco de Dados
-- Banco de Dados: bd_infortec
-- MySQL 8.0+
-- ============================================================================

-- Criar banco de dados se não existir
CREATE DATABASE IF NOT EXISTS bd_infortec
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE bd_infortec;

-- ============================================================================
-- Tabela: users
-- Descrição: Usuários do sistema com diferentes roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  marca VARCHAR(255) NOT NULL DEFAULT 'TechFlow',
  telefone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'gerente', 'administrativo', 'atendente', 'tecnico') NOT NULL,
  roles JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: customers
-- Descrição: Cadastro de clientes (Pessoa Física ou Jurídica)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo ENUM('PF', 'PJ') DEFAULT 'PF',
  documento VARCHAR(20),
  telefone VARCHAR(20),
  email VARCHAR(255),
  portal_password_hash VARCHAR(255),
  endereco TEXT,
  observacoes TEXT,
  status ENUM('Adimplente', 'Inadimplente') DEFAULT 'Adimplente',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_documento (documento),
  INDEX idx_email (email),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: services
-- Descrição: Catálogo de serviços disponíveis
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(36) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  notas TEXT,
  categoria ENUM('Troca', 'Reparo', 'Software', 'Diagnóstico', 'Limpeza', 'Manutenção', 'Formatação', 'Backup', 'Preventiva', 'Redes', 'Suporte', 'Outro') NOT NULL,
  modalidade ENUM('Presencial', 'Remoto') NOT NULL DEFAULT 'Presencial',
  preco_sugerido DECIMAL(10, 2),
  tempo_estimado_horas DECIMAL(5, 2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categoria (categoria),
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: product_parts
-- Descrição: Catálogo de peças do estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_parts (
  id VARCHAR(36) PRIMARY KEY,
  codigo_sku VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  categoria ENUM('Tela', 'Placa-Mãe', 'Processador', 'Memória RAM', 'Bateria', 'Conector', 'Fonte', 'Adaptador', 'Insumo', 'Acessório', 'Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad', 'Outro') NOT NULL,
  condicao ENUM('Nova', 'Remanufaturada') DEFAULT 'Nova',
  equipamento_tipo ENUM('Desktop', 'Notebook', 'Tablet', 'Smartphone', 'Console', 'Universal', 'Outro') DEFAULT 'Universal',
  technical_specs JSON,
  quantidade_estoque INT DEFAULT 0,
  quantidade_minima INT DEFAULT 0,
  preco_custo DECIMAL(10, 2),
  preco_venda DECIMAL(10, 2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_codigo_sku (codigo_sku),
  INDEX idx_categoria (categoria),
  INDEX idx_equipamento_tipo (equipamento_tipo),
  INDEX idx_ativo (ativo),
  INDEX idx_estoque (quantidade_estoque)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: kits
-- Descrição: Kits compostos por múltiplas peças
-- ============================================================================
CREATE TABLE IF NOT EXISTS kits (
  id VARCHAR(36) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco_kit DECIMAL(10, 2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: kit_items
-- Descrição: Itens que compõem um kit
-- ============================================================================
CREATE TABLE IF NOT EXISTS kit_items (
  id VARCHAR(36) PRIMARY KEY,
  kit_id VARCHAR(36) NOT NULL,
  peca_id VARCHAR(36) NOT NULL,
  quantidade INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kit_id) REFERENCES kits(id) ON DELETE CASCADE,
  FOREIGN KEY (peca_id) REFERENCES product_parts(id) ON DELETE CASCADE,
  INDEX idx_kit_id (kit_id),
  INDEX idx_peca_id (peca_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: service_orders
-- Descrição: Ordens de Serviço com informações de cliente, técnico, equipamento
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_orders (
  id VARCHAR(36) PRIMARY KEY,
  protocolo_os VARCHAR(20) NOT NULL UNIQUE,
  cliente_id VARCHAR(36) NOT NULL,
  tecnico_id VARCHAR(36),
  atendente_id VARCHAR(36) NOT NULL,
  status ENUM('Recebido', 'Em Análise', 'Aguardando Peça', 'Aprovado', 'Concluído', 'Entregue', 'Retorno Assistência', 'Desistência do Cliente') DEFAULT 'Recebido',
  equipamento_marca VARCHAR(100),
  equipamento_modelo VARCHAR(100),
  equipamento_serie VARCHAR(100),
  equipamento_tipo VARCHAR(100),
  defeito_relatado TEXT,
  laudo_tecnico TEXT,
  data_abertura DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_previsao DATE,
  data_conclusao DATETIME,
  valor_servico DECIMAL(10, 2) DEFAULT 0.00,
  taxa_analise DECIMAL(10, 2) DEFAULT 120.00,
  desconto_taxa_analise DECIMAL(10, 2) DEFAULT 0.00,
  valor_pecas DECIMAL(10, 2) DEFAULT 0.00,
  valor_total DECIMAL(10, 2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (tecnico_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (atendente_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_protocolo_os (protocolo_os),
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_tecnico_id (tecnico_id),
  INDEX idx_atendente_id (atendente_id),
  INDEX idx_status (status),
  INDEX idx_data_abertura (data_abertura)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: os_checklists
-- Descrição: Checklist de inspeção para cada OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS os_checklists (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL UNIQUE,
  itens JSON,
  observacoes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  INDEX idx_os_id (os_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: os_items
-- Descrição: Peças e Kits associados a uma OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS os_items (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL,
  tipo_item ENUM('peca', 'kit') NOT NULL,
  referencia_id VARCHAR(36),
  nome_item VARCHAR(255) NOT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(10, 2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  INDEX idx_os_id (os_id),
  INDEX idx_tipo_item (tipo_item)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: os_services
-- Descrição: Serviços associados a uma OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS os_services (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL,
  service_id VARCHAR(36),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  preco DECIMAL(10, 2) NOT NULL,
  quantidade INT DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  INDEX idx_os_id (os_id),
  INDEX idx_service_id (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: os_medias
-- Descrição: Fotos e mídia das OS (entrada/saída)
-- ============================================================================
CREATE TABLE IF NOT EXISTS os_medias (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL,
  url_foto TEXT NOT NULL,
  tipo ENUM('entrada', 'saida') DEFAULT 'entrada',
  descricao VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  INDEX idx_os_id (os_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: os_status_histories
-- Descrição: Histórico de mudanças de status das OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS os_status_histories (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL,
  status VARCHAR(50) NOT NULL,
  usuario_id VARCHAR(36),
  usuario_nome VARCHAR(255),
  observacao TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_os_id (os_id),
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: payments
-- Descrição: Pagamentos associados a OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  forma_pagamento ENUM('Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Outro') DEFAULT 'Pix',
  data_pagamento DATETIME,
  observacao TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  INDEX idx_os_id (os_id),
  INDEX idx_forma_pagamento (forma_pagamento),
  INDEX idx_data_pagamento (data_pagamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: physical_inventories
-- Descrição: Inventários físicos realizados
-- ============================================================================
CREATE TABLE IF NOT EXISTS physical_inventories (
  id VARCHAR(36) PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  observacoes TEXT,
  data_inventario DATETIME DEFAULT CURRENT_TIMESTAMP,
  responsavel_id VARCHAR(36),
  responsavel_nome VARCHAR(255),
  status ENUM('aberto', 'concluido') DEFAULT 'aberto',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_responsavel_id (responsavel_id),
  INDEX idx_status (status),
  INDEX idx_data_inventario (data_inventario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: physical_inventory_items
-- Descrição: Itens de cada inventário físico
-- ============================================================================
CREATE TABLE IF NOT EXISTS physical_inventory_items (
  id VARCHAR(36) PRIMARY KEY,
  inventario_id VARCHAR(36) NOT NULL,
  peca_id VARCHAR(36) NOT NULL,
  peca_nome VARCHAR(255),
  quantidade_sistema INT,
  quantidade_fisica INT,
  divergencia INT GENERATED ALWAYS AS (quantidade_fisica - quantidade_sistema) STORED,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventario_id) REFERENCES physical_inventories(id) ON DELETE CASCADE,
  FOREIGN KEY (peca_id) REFERENCES product_parts(id) ON DELETE CASCADE,
  INDEX idx_inventario_id (inventario_id),
  INDEX idx_peca_id (peca_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: inventory_movements
-- Descrição: Livro de saídas de peças por venda ou atribuição em OS
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(36) PRIMARY KEY,
  peca_id VARCHAR(36) NOT NULL,
  origem ENUM('Venda em Loja', 'Atribuição em OS') NOT NULL,
  referencia_id VARCHAR(36),
  responsavel_id VARCHAR(36),
  responsavel_nome VARCHAR(255),
  quantidade INT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  status ENUM('Vendido', 'Cancelado') DEFAULT 'Vendido',
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (peca_id) REFERENCES product_parts(id) ON DELETE CASCADE,
  FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_movement_part (peca_id),
  INDEX idx_movement_reference (referencia_id),
  INDEX idx_movement_date (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(36) PRIMARY KEY,
  customer_name VARCHAR(255),
  subtotal DECIMAL(10, 2) NOT NULL,
  tax_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.0865,
  tax_amount DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  change_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method ENUM('Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito') NOT NULL,
  pix_key VARCHAR(100),
  status ENUM('paid', 'cancelled') NOT NULL DEFAULT 'paid',
  user_id VARCHAR(36),
  user_name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sales_created_at (created_at),
  INDEX idx_sales_payment_method (payment_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id VARCHAR(36) PRIMARY KEY,
  sale_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES product_parts(id) ON DELETE RESTRICT,
  INDEX idx_sale_items_sale_id (sale_id),
  INDEX idx_sale_items_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: sequence_counters (para gerar protocolo_os sequencial)
-- Descrição: Contador de sequência para números de protocolo
-- ============================================================================
CREATE TABLE IF NOT EXISTS sequence_counters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  counter_type VARCHAR(50) NOT NULL UNIQUE,
  counter_value INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir contador inicial para protocolo_os
INSERT INTO sequence_counters (counter_type, counter_value) VALUES ('protocolo_os', 0) ON DUPLICATE KEY UPDATE counter_value = counter_value;

-- ============================================================================
-- TRIGGERS E PROCEDURES
-- ============================================================================

-- Stored Procedure: Gerar próximo protocolo_os
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_get_next_protocol()
BEGIN
  UPDATE sequence_counters 
  SET counter_value = counter_value + 1 
  WHERE counter_type = 'protocolo_os';
  
  SELECT CONCAT('OS-', LPAD(counter_value, 5, '0')) as next_protocol 
  FROM sequence_counters 
  WHERE counter_type = 'protocolo_os';
END //
DELIMITER ;

-- ============================================================================
-- Fim do script
-- ============================================================================
