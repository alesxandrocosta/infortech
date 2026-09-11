#!/usr/bin/env node
// ============================================================================
// techflow-erp/backend/scripts/init-database.js
// Script para inicializar automaticamente o banco de dados MySQL
// Execução: node scripts/init-database.js
// ============================================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length > 0) {
  throw new Error(`Variáveis obrigatórias ausentes: ${missingVariables.join(', ')}`);
}

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME;

async function initDatabase() {
  let connection;

  try {
    console.log('\n🔄 Iniciando configuração do banco de dados...\n');

    // Conectar sem banco de dados
    console.log(`📍 Conectando em ${DB_HOST}:${DB_PORT}...`);
    connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT,
      multipleStatements: true,
      timezone: '+00:00',
    });
    console.log('✓ Conexão estabelecida\n');

    // Verificar e criar banco de dados
    console.log(`📦 Verificando existência do banco "${DB_NAME}"...`);
    const databases = await connection.query(`SHOW DATABASES LIKE '${DB_NAME}'`);

    if (databases[0].length === 0) {
      console.log(`   → Banco não encontrado. Criando "${DB_NAME}"...`);
      await connection.query(`CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✓ Banco "${DB_NAME}" criado com sucesso\n`);
    } else {
      console.log(`✓ Banco "${DB_NAME}" já existe\n`);
    }

    // Conectar ao banco específico
    await connection.changeUser({ database: DB_NAME });

    // Executar script SQL
    const sqlPath = path.join(__dirname, '../../database/init.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ Erro: Arquivo ${sqlPath} não encontrado`);
      process.exit(1);
    }

    console.log('📝 Lendo arquivo SQL...');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔨 Executando script de criação de tabelas...\n');
    
    // mysql2 não interpreta comandos DELIMITER; a procedure será criada por migração própria quando necessário.
    const executableSql = sqlScript
      .replace(/DELIMITER\s+\/\/[\s\S]*?DELIMITER\s+;/g, '')
      .replace(/^\s*--.*$/gm, '');

    // Dividir por ; e executar cada statement
    const statements = executableSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    let tablesCreated = 0;
    for (const statement of statements) {
      try {
        await connection.query(statement);
        if (statement.includes('CREATE TABLE')) {
          tablesCreated++;
        }
      } catch (error) {
        // Ignorar erros de "já existe"
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    console.log(`✓ Script SQL executado com sucesso`);
    console.log(`✓ Tabelas verificadas/criadas: ${tablesCreated}\n`);

    const [inventoryColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'physical_inventories'`,
      [DB_NAME],
    );
    const inventoryColumnNames = inventoryColumns.map((column) => column.COLUMN_NAME);
    if (!inventoryColumnNames.includes('nome')) {
      await connection.query("ALTER TABLE physical_inventories ADD COLUMN nome VARCHAR(255) NOT NULL DEFAULT 'Inventário físico'");
    }
    if (!inventoryColumnNames.includes('observacoes')) {
      await connection.query('ALTER TABLE physical_inventories ADD COLUMN observacoes TEXT');
    }

    const [serviceColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'services'`,
      [DB_NAME],
    );
    if (!serviceColumns.some((column) => column.COLUMN_NAME === 'modalidade')) {
      await connection.query("ALTER TABLE services ADD COLUMN modalidade ENUM('Presencial', 'Remoto') NOT NULL DEFAULT 'Presencial' AFTER categoria");
    }
    await connection.query("ALTER TABLE services MODIFY COLUMN categoria ENUM('Troca', 'Reparo', 'Software', 'Diagnóstico', 'Limpeza', 'Manutenção', 'Formatação', 'Backup', 'Preventiva', 'Redes', 'Suporte', 'Outro') NOT NULL");

    const [orderColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'service_orders'`,
      [DB_NAME],
    );
    if (!orderColumns.some((column) => column.COLUMN_NAME === 'taxa_analise')) await connection.query('ALTER TABLE service_orders ADD COLUMN taxa_analise DECIMAL(10, 2) DEFAULT 120.00 AFTER valor_servico');
    if (!orderColumns.some((column) => column.COLUMN_NAME === 'desconto_taxa_analise')) await connection.query('ALTER TABLE service_orders ADD COLUMN desconto_taxa_analise DECIMAL(10, 2) DEFAULT 0.00 AFTER taxa_analise');
    if (!orderColumns.some((column) => column.COLUMN_NAME === 'valor_pecas')) await connection.query('ALTER TABLE service_orders ADD COLUMN valor_pecas DECIMAL(10, 2) DEFAULT 0.00 AFTER desconto_taxa_analise');

    // Validar tabelas
    console.log('✅ Validando estrutura do banco...');
    const tables = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${DB_NAME}'`
    );

    const expectedTables = [
      'users',
      'customers',
      'services',
      'product_parts',
      'kits',
      'kit_items',
      'service_orders',
      'os_checklists',
      'os_items',
      'os_services',
      'os_medias',
      'os_status_histories',
      'payments',
      'physical_inventories',
      'physical_inventory_items',
      'sequence_counters',
    ];

    const createdTables = tables[0].map(t => t.TABLE_NAME);
    const allTablesCreated = expectedTables.every(table => createdTables.includes(table));

    if (allTablesCreated) {
      console.log(`✓ Todas as ${expectedTables.length} tabelas foram validadas\n`);
      
      // Exibir resumo
      console.log('📊 Resumo das Tabelas Criadas:');
      expectedTables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table}`);
      });
      
      console.log('\n✨ Banco de dados inicializado com sucesso!\n');
      console.log('🚀 Próximos passos:');
      console.log('   1. npm install (no diretório backend)');
      console.log('   2. npm run dev (para iniciar o servidor)\n');
    } else {
      const missingTables = expectedTables.filter(table => !createdTables.includes(table));
      console.error(`✗ Erro: Tabelas faltando: ${missingTables.join(', ')}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Erro ao inicializar banco de dados:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar
initDatabase();
