#!/usr/bin/env node
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
require('dotenv').config();

const users = [
  { full_name: 'Alesxandro Costa de Souza', username: 'alesxandro', email: 'alesxandrocosta@gmail.com', telefone: '31993968438', roles: ['admin'], password: '46302113' },
  { full_name: 'Pedro', username: 'pedro', email: 'pedro@techflow.local', telefone: '', roles: ['tecnico'], password: 'mudar@123' },
  { full_name: 'Amanda', username: 'amanda', email: 'amanda@techflow.local', telefone: '', roles: ['atendente'], password: 'mudar@123' },
  { full_name: 'Henrique', username: 'henrique', email: 'henrique@techflow.local', telefone: '', roles: ['gerente'], password: 'mudar@123' },
];

async function seedUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  try {
    const [columns] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'telefone'`,
      [process.env.DB_NAME],
    );
    if (columns[0].total === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN telefone VARCHAR(20) AFTER email');
    }

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 12);
      await connection.execute(
        `INSERT INTO users (id, full_name, username, email, telefone, password_hash, role, roles)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           username = VALUES(username),
           telefone = VALUES(telefone),
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           roles = VALUES(roles),
           updated_at = CURRENT_TIMESTAMP`,
        [randomUUID(), user.full_name, user.username, user.email, user.telefone, passwordHash, user.roles[0], JSON.stringify(user.roles)],
      );

      console.log(`Usuário configurado: ${user.full_name} <${user.email}> [${user.role}]`);
    }
  } finally {
    await connection.end();
  }
}

seedUsers().catch((error) => {
  console.error(`Erro ao criar usuários: ${error.message}`);
  process.exitCode = 1;
});
