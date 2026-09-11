USE bd_infortec;

SET @has_portal_password = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'portal_password_hash');
SET @sql_portal_password = IF(@has_portal_password = 0, 'ALTER TABLE customers ADD COLUMN portal_password_hash VARCHAR(255) NULL AFTER email', 'SELECT 1');
PREPARE stmt_portal_password FROM @sql_portal_password;
EXECUTE stmt_portal_password;
DEALLOCATE PREPARE stmt_portal_password;

SET @has_username = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username');
SET @sql_username = IF(@has_username = 0, 'ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL UNIQUE AFTER full_name', 'SELECT 1');
PREPARE stmt_username FROM @sql_username;
EXECUTE stmt_username;
DEALLOCATE PREPARE stmt_username;

SET @has_roles = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'roles');
SET @sql_roles = IF(@has_roles = 0, 'ALTER TABLE users ADD COLUMN roles JSON NULL AFTER role', 'SELECT 1');
PREPARE stmt_roles FROM @sql_roles;
EXECUTE stmt_roles;
DEALLOCATE PREPARE stmt_roles;
UPDATE users SET username = LOWER(REPLACE(SUBSTRING_INDEX(email, '@', 1), '.', '_')) WHERE username IS NULL OR username = '';
UPDATE users SET roles = JSON_ARRAY(role) WHERE roles IS NULL;
ALTER TABLE users MODIFY COLUMN username VARCHAR(100) NOT NULL;
SET @has_service_notes = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'notas');
SET @sql_service_notes = IF(@has_service_notes = 0, 'ALTER TABLE services ADD COLUMN notas TEXT AFTER descricao', 'SELECT 1');
PREPARE stmt_service_notes FROM @sql_service_notes;
EXECUTE stmt_service_notes;
DEALLOCATE PREPARE stmt_service_notes;

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