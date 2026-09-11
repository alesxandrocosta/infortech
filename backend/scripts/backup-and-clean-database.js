#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const databaseName = process.env.DB_NAME;
const confirmation = process.env.CONFIRM_ZERO_DATABASE;

if (!databaseName || !process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) {
  throw new Error('Defina DB_HOST, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env.');
}

if (confirmation !== `ZERO:${databaseName}`) {
  throw new Error(`Operação bloqueada. Para confirmar, use CONFIRM_ZERO_DATABASE=ZERO:${databaseName}`);
}

async function backupAndCleanDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: databaseName,
    timezone: '+00:00',
  });

  try {
    const [tableRows] = await connection.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [databaseName],
    );
    const tables = tableRows.map((row) => row.TABLE_NAME);
    const backup = {
      database: databaseName,
      createdAt: new Date().toISOString(),
      tables: {},
    };

    for (const table of tables) {
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      backup.tables[table] = rows;
    }

    const backupDirectory = path.join(__dirname, '..', 'backups');
    await fs.mkdir(backupDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDirectory, `before-zero-${timestamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`Backup criado: ${backupPath}`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tables) {
        await connection.query(`DELETE FROM \`${table}\``);
        console.log(`Tabela limpa: ${table}`);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`Banco ${databaseName} zerado com sucesso. Estrutura preservada.`);
  } finally {
    await connection.end();
  }
}

backupAndCleanDatabase().catch((error) => {
  console.error(`Erro ao limpar o banco: ${error.message}`);
  process.exit(1);
});
