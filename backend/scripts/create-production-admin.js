#!/usr/bin/env node
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
require('dotenv').config();

const requiredVariables = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'ADMIN_FULL_NAME',
  'ADMIN_USERNAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length > 0) {
  throw new Error(`Variáveis obrigatórias ausentes: ${missingVariables.join(', ')}`);
}
if (process.env.ADMIN_PASSWORD.length < 11) {
  throw new Error('ADMIN_PASSWORD deve ter pelo menos 11 caracteres.');
}

async function createProductionAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
  });

  try {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await connection.execute(
      `INSERT INTO users (id, full_name, username, email, telefone, marca, password_hash, role, roles)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         username = VALUES(username),
         telefone = VALUES(telefone),
         marca = VALUES(marca),
         password_hash = VALUES(password_hash),
         role = 'admin',
         roles = VALUES(roles),
         updated_at = CURRENT_TIMESTAMP`,
      [
        randomUUID(),
        process.env.ADMIN_FULL_NAME,
        process.env.ADMIN_USERNAME,
        process.env.ADMIN_EMAIL,
        process.env.ADMIN_PHONE || null,
        process.env.ADMIN_BRAND || 'TechFlow',
        passwordHash,
        JSON.stringify(['admin']),
      ],
    );
    console.log(`Administrador de produção configurado: ${process.env.ADMIN_EMAIL}`);
  } finally {
    await connection.end();
  }
}

createProductionAdmin().catch((error) => {
  console.error(`Erro ao criar administrador: ${error.message}`);
  process.exitCode = 1;
});
