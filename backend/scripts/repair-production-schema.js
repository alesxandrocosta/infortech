#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config();

async function repairProductionSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
  });

  try {
    const [userColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [process.env.DB_NAME],
    );
    const columns = new Set(userColumns.map((column) => column.COLUMN_NAME));

    if (!columns.has('username')) {
      await connection.execute("ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL AFTER full_name");
      await connection.execute("UPDATE users SET username = LOWER(SUBSTRING_INDEX(email, '@', 1)) WHERE username IS NULL OR username = ''");
      await connection.execute("ALTER TABLE users MODIFY COLUMN username VARCHAR(100) NOT NULL UNIQUE");
      console.log('Coluna users.username criada.');
    }
    if (!columns.has('roles')) {
      await connection.execute("ALTER TABLE users ADD COLUMN roles JSON NULL AFTER role");
      await connection.execute("UPDATE users SET roles = JSON_ARRAY(role) WHERE roles IS NULL");
      console.log('Coluna users.roles criada.');
    }
    if (!columns.has('telefone')) {
      await connection.execute("ALTER TABLE users ADD COLUMN telefone VARCHAR(20) NULL AFTER email");
      console.log('Coluna users.telefone criada.');
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sequence_counters (
        id INT PRIMARY KEY AUTO_INCREMENT,
        counter_type VARCHAR(50) NOT NULL UNIQUE,
        counter_value INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.execute(
      "INSERT INTO sequence_counters (counter_type, counter_value) VALUES ('protocolo_os', 0) ON DUPLICATE KEY UPDATE counter_type = counter_type",
    );
    console.log('Contador de protocolos validado.');
  } finally {
    await connection.end();
  }
}

repairProductionSchema().catch((error) => {
  console.error(`Erro ao reparar schema: ${error.message}`);
  process.exit(1);
});
