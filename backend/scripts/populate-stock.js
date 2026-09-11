#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function populateStock() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const sqlPath = path.join(__dirname, '../../database/populate-stock.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await connection.query(sql);
    const [rows] = await connection.query(`
      SELECT COUNT(*) AS total,
             SUM(quantidade_estoque = 20) AS quantity_20,
             SUM(quantidade_minima = 5) AS minimum_5,
             SUM(preco_venda IS NULL) AS without_price
      FROM product_parts
      WHERE codigo_sku LIKE 'MON-%'
         OR codigo_sku LIKE 'CEL-%'
         OR codigo_sku LIKE 'FON-%'
         OR codigo_sku LIKE 'MOU-%'
         OR codigo_sku LIKE 'TEC-%'
         OR codigo_sku LIKE 'PAD-%'
    `);
    console.log(`Estoque comercial: ${rows[0].total} SKUs`);
    console.log(`Quantidade 20: ${rows[0].quantity_20}`);
    console.log(`Mínimo 5: ${rows[0].minimum_5}`);
    console.log(`Sem preço para preencher no CRUD: ${rows[0].without_price}`);
  } finally {
    await connection.end();
  }
}

populateStock().catch((error) => {
  console.error(`Erro ao popular estoque: ${error.message}`);
  process.exit(1);
});
