#!/usr/bin/env node
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) throw new Error(`Variáveis obrigatórias ausentes: ${missingVariables.join(', ')}`);

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    multipleStatements: true,
    timezone: '+00:00',
  });
  try {
    const filePath = path.join(__dirname, '../../database/migration-20260909-service-bench.sql');
    const script = fs.readFileSync(filePath, 'utf8').replace(/^USE\s+[^;]+;/im, '');
    await connection.query(script);
    console.log('Migração do módulo de bancada aplicada com sucesso.');
  } finally {
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`Erro na migração da bancada: ${error.message}`);
  process.exitCode = 1;
});
