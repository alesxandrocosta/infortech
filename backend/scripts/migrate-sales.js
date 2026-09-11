#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateSales() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
  });
  try {
    const [userColumns] = await connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'marca'", [process.env.DB_NAME]);
    if (!userColumns.length) await connection.query("ALTER TABLE users ADD COLUMN marca VARCHAR(255) NOT NULL DEFAULT 'TechFlow' AFTER email");
    const [saleColumns] = await connection.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales'", [process.env.DB_NAME]);
    const saleColumnNames = new Set(saleColumns.map((column) => column.COLUMN_NAME));
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(36) PRIMARY KEY,
        customer_name VARCHAR(255), subtotal DECIMAL(10, 2) NOT NULL,
        tax_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.0865,
        tax_amount DECIMAL(10, 2) NOT NULL, total DECIMAL(10, 2) NOT NULL,
        payment_method ENUM('Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito') NOT NULL,
        pix_key VARCHAR(100), status ENUM('paid', 'cancelled') NOT NULL DEFAULT 'paid',
        user_id VARCHAR(36), user_name VARCHAR(255), created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_sales_created_at (created_at), INDEX idx_sales_payment_method (payment_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    if (!saleColumnNames.has('amount_paid')) await connection.query('ALTER TABLE sales ADD COLUMN amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER total');
    if (!saleColumnNames.has('change_amount')) await connection.query('ALTER TABLE sales ADD COLUMN change_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER amount_paid');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(36) PRIMARY KEY, sale_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL,
        sku VARCHAR(50) NOT NULL, product_name VARCHAR(255) NOT NULL, quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL, line_total DECIMAL(10, 2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES product_parts(id) ON DELETE RESTRICT,
        INDEX idx_sale_items_sale_id (sale_id), INDEX idx_sale_items_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabelas de vendas validadas.');
  } finally {
    await connection.end();
  }
}

migrateSales().catch((error) => {
  console.error(`Erro na migração de vendas: ${error.message}`);
  process.exit(1);
});
