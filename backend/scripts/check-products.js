#!/usr/bin/env node
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProducts() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  try {
    console.log('📊 Verificando produtos no banco de dados...\n');
    
    // Total de produtos
    const [total] = await connection.execute('SELECT COUNT(*) as count FROM product_parts');
    console.log(`✅ Total de produtos: ${total[0].count}`);
    
    // Produtos por categoria
    const [byCat] = await connection.execute(`
      SELECT categoria, COUNT(*) as count 
      FROM product_parts 
      WHERE ativo = TRUE
      GROUP BY categoria 
      ORDER BY count DESC
    `);
    
    console.log('\n🏷️  Produtos por categoria:');
    byCat.forEach(row => {
      console.log(`   - ${row.categoria}: ${row.count} produtos`);
    });
    
    // Listar alguns novos produtos
    console.log('\n📌 Novos produtos adicionados:');
    const [newProducts] = await connection.execute(`
      SELECT codigo_sku, nome, categoria, preco_venda, quantidade_estoque 
      FROM product_parts 
      WHERE categoria IN ('Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad')
      ORDER BY categoria, nome
      LIMIT 20
    `);
    
    newProducts.forEach(prod => {
      console.log(`   ✓ ${prod.codigo_sku} - ${prod.nome} (${prod.categoria}) | R$ ${prod.preco_venda} | Estoque: ${prod.quantidade_estoque}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

checkProducts();
