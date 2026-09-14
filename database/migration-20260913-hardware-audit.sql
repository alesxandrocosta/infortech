USE bd_infortec;

-- Auditoria do equipamento na OS e no histórico de vendas.
SET @columns = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND COLUMN_NAME = 'hwid_equipamento'
);
SET @sql = IF(@columns = 0, 'ALTER TABLE service_orders ADD COLUMN hwid_equipamento VARCHAR(16) NULL AFTER equipamento_tipo, ADD COLUMN serial_bios VARCHAR(255) NULL AFTER hwid_equipamento, ADD COLUMN uuid_sistema VARCHAR(255) NULL AFTER serial_bios, ADD COLUMN mac_rede VARCHAR(255) NULL AFTER uuid_sistema, ADD COLUMN serial_disco VARCHAR(255) NULL AFTER mac_rede, ADD COLUMN especificacoes_json JSON NULL AFTER serial_disco, ADD COLUMN hardware_validacao_status VARCHAR(30) NULL AFTER especificacoes_json, ADD COLUMN hardware_divergencias_json JSON NULL AFTER hardware_validacao_status, ADD COLUMN hardware_validado_em DATETIME NULL AFTER hardware_divergencias_json', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_orders' AND INDEX_NAME = 'idx_service_orders_hwid'
);
SET @sql = IF(@index_exists = 0, 'ALTER TABLE service_orders ADD INDEX idx_service_orders_hwid (hwid_equipamento)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columns = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'customer_id'
);
SET @sql = IF(@columns = 0, 'ALTER TABLE sales ADD COLUMN customer_id VARCHAR(36) NULL AFTER customer_name, ADD COLUMN hwid_equipamento VARCHAR(16) NULL AFTER customer_id, ADD COLUMN serial_bios VARCHAR(255) NULL AFTER hwid_equipamento, ADD COLUMN uuid_sistema VARCHAR(255) NULL AFTER serial_bios, ADD COLUMN mac_rede VARCHAR(255) NULL AFTER uuid_sistema, ADD COLUMN serial_disco VARCHAR(255) NULL AFTER mac_rede, ADD COLUMN especificacoes_json JSON NULL AFTER serial_disco', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND INDEX_NAME = 'idx_sales_hwid'
);
SET @sql = IF(@index_exists = 0, 'ALTER TABLE sales ADD INDEX idx_sales_hwid (hwid_equipamento), ADD INDEX idx_sales_customer_id (customer_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND CONSTRAINT_NAME = 'fk_sales_customer'
);
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE sales ADD CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
