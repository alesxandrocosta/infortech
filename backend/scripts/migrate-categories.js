#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateCategoriesEnum() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔄 Alterando ENUM de categoria na tabela product_parts...');
    
    await connection.execute(`
      ALTER TABLE product_parts 
      MODIFY COLUMN categoria ENUM(
        'Tela', 'Placa-Mãe', 'Processador', 'Memória RAM', 'Bateria', 
        'Conector', 'Fonte', 'Adaptador', 'Insumo', 'Acessório', 
        'Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad', 'Outro'
      ) NOT NULL
    `);
    
    console.log('✅ ENUM de categoria atualizado com sucesso!');
    console.log('✅ Novas categorias disponíveis:');
    console.log('   - Monitor');
    console.log('   - Smartphone');
    console.log('   - Fone');
    console.log('   - Mouse');
    console.log('   - Teclado');
    console.log('   - Mousepad');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrateCategoriesEnum();
