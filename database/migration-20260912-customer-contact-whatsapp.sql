USE bd_infortec;

SET @has_cep = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'cep');
SET @sql_cep = IF(@has_cep = 0, 'ALTER TABLE customers ADD COLUMN cep VARCHAR(9) NULL AFTER endereco', 'SELECT 1');
PREPARE stmt_cep FROM @sql_cep;
EXECUTE stmt_cep;
DEALLOCATE PREPARE stmt_cep;

SET @has_numero = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'numero');
SET @sql_numero = IF(@has_numero = 0, 'ALTER TABLE customers ADD COLUMN numero VARCHAR(20) NULL AFTER cep', 'SELECT 1');
PREPARE stmt_numero FROM @sql_numero;
EXECUTE stmt_numero;
DEALLOCATE PREPARE stmt_numero;

SET @has_whatsapp = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'whatsapp');
SET @sql_whatsapp = IF(@has_whatsapp = 0, 'ALTER TABLE customers ADD COLUMN whatsapp VARCHAR(20) NULL AFTER telefone', 'SELECT 1');
PREPARE stmt_whatsapp FROM @sql_whatsapp;
EXECUTE stmt_whatsapp;
DEALLOCATE PREPARE stmt_whatsapp;
