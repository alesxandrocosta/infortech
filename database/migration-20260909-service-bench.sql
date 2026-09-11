USE bd_infortec;

ALTER TABLE service_orders
  MODIFY COLUMN status ENUM('Recebido', 'Aguardando Análise', 'Em Análise', 'Aguardando Peça', 'Aguardando Aprovação', 'Aprovado', 'Em Execução', 'Concluído', 'Finalizado', 'Entregue', 'Retorno Assistência', 'Desistência do Cliente') DEFAULT 'Recebido';

SET @has_budget_status = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'orcamento_status');
SET @sql_budget_status = IF(@has_budget_status = 0, "ALTER TABLE service_orders ADD COLUMN orcamento_status ENUM('pendente', 'aprovado', 'recusado') NOT NULL DEFAULT 'pendente' AFTER status", 'SELECT 1');
PREPARE stmt_budget_status FROM @sql_budget_status;
EXECUTE stmt_budget_status;
DEALLOCATE PREPARE stmt_budget_status;

SET @has_services_done = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'servicos_realizados');
SET @sql_services_done = IF(@has_services_done = 0, 'ALTER TABLE service_orders ADD COLUMN servicos_realizados TEXT NULL AFTER laudo_tecnico', 'SELECT 1');
PREPARE stmt_services_done FROM @sql_services_done;
EXECUTE stmt_services_done;
DEALLOCATE PREPARE stmt_services_done;

SET @has_warranty_services = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'garantia_servicos_dias');
SET @sql_warranty_services = IF(@has_warranty_services = 0, 'ALTER TABLE service_orders ADD COLUMN garantia_servicos_dias INT NOT NULL DEFAULT 30 AFTER servicos_realizados', 'SELECT 1');
PREPARE stmt_warranty_services FROM @sql_warranty_services;
EXECUTE stmt_warranty_services;
DEALLOCATE PREPARE stmt_warranty_services;

SET @has_warranty_parts = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'garantia_pecas_dias');
SET @sql_warranty_parts = IF(@has_warranty_parts = 0, 'ALTER TABLE service_orders ADD COLUMN garantia_pecas_dias INT NOT NULL DEFAULT 90 AFTER garantia_servicos_dias', 'SELECT 1');
PREPARE stmt_warranty_parts FROM @sql_warranty_parts;
EXECUTE stmt_warranty_parts;
DEALLOCATE PREPARE stmt_warranty_parts;

SET @has_stock_debited = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'estoque_baixado_em');
SET @sql_stock_debited = IF(@has_stock_debited = 0, 'ALTER TABLE service_orders ADD COLUMN estoque_baixado_em DATETIME NULL AFTER garantia_pecas_dias', 'SELECT 1');
PREPARE stmt_stock_debited FROM @sql_stock_debited;
EXECUTE stmt_stock_debited;
DEALLOCATE PREPARE stmt_stock_debited;

CREATE TABLE IF NOT EXISTS os_contracts (
  id VARCHAR(36) PRIMARY KEY,
  os_id VARCHAR(36) NOT NULL UNIQUE,
  tipo ENUM('termo', 'contrato') NOT NULL DEFAULT 'contrato',
  conteudo LONGTEXT NOT NULL,
  garantia_servicos_dias INT NOT NULL DEFAULT 30,
  garantia_pecas_dias INT NOT NULL DEFAULT 90,
  created_by VARCHAR(36),
  created_by_name VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (os_id) REFERENCES service_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_contract_os (os_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE service_orders SET orcamento_status = CASE
  WHEN status IN ('Aprovado', 'Em Execução', 'Concluído', 'Finalizado', 'Entregue') THEN 'aprovado'
  WHEN status = 'Desistência do Cliente' THEN 'recusado'
  ELSE 'pendente'
END WHERE orcamento_status = 'pendente';
