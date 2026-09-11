// ============================================================================
// techflow-erp/backend/src/config/database.js
// Configuração e Pool de Conexão MySQL com suporte a transações
// ============================================================================

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const requiredDatabaseVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
if (process.env.NODE_ENV === 'production') {
  const missingVariables = requiredDatabaseVariables.filter((name) => !process.env[name]);
  if (!process.env.JWT_SECRET) missingVariables.push('JWT_SECRET');
  if (missingVariables.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missingVariables.join(', ')}`);
  }
}

// Criar pool de conexões
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  multipleStatements: false,
  timezone: '+00:00',
  supportBigNumbers: true,
  bigNumberStrings: true,
});

// Verificar conexão ao iniciar
pool.getConnection()
  .then(connection => {
    console.log('✓ Conexão com MySQL estabelecida com sucesso');
    connection.release();
  })
  .catch(error => {
    console.error('✗ Erro ao conectar ao MySQL:', error.message);
    process.exit(1);
  });

// ============================================================================
// Classe para gerenciar Transações
// ============================================================================
class Transaction {
  constructor(connection) {
    this.connection = connection;
    this.isActive = false;
  }

  async begin() {
    if (!this.isActive) {
      await this.connection.beginTransaction();
      this.isActive = true;
    }
  }

  async commit() {
    if (this.isActive) {
      await this.connection.commit();
      this.isActive = false;
    }
  }

  async rollback() {
    if (this.isActive) {
      await this.connection.rollback();
      this.isActive = false;
    }
  }

  async query(sql, params = []) {
    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  async close() {
    if (this.isActive) {
      await this.rollback();
    }
    await this.connection.release();
  }
}

// ============================================================================
// Funções auxiliares para execução de queries
// ============================================================================

/**
 * Executar query simples
 * @param {string} sql - Query SQL
 * @param {array} params - Parâmetros da query
 * @returns {object} Resultado da query
 */
async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Executar query com retorno de uma única linha
 * @param {string} sql - Query SQL
 * @param {array} params - Parâmetros da query
 * @returns {object} Primeira linha do resultado
 */
async function queryOne(sql, params = []) {
  const result = await query(sql, params);
  return result.length > 0 ? result[0] : null;
}

/**
 * Iniciar uma transação
 * @returns {Transaction} Objeto de transação
 */
async function getTransaction() {
  const connection = await pool.getConnection();
  const transaction = new Transaction(connection);
  await transaction.begin();
  return transaction;
}

/**
 * Executar query com retorno de ID inserido
 * @param {string} sql - Query SQL INSERT
 * @param {array} params - Parâmetros da query
 * @returns {string} ID da linha inserida
 */
async function insertAndGetId(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return result.insertId;
  } finally {
    connection.release();
  }
}

/**
 * Fechar pool de conexões (útil para shutdown)
 */
async function closePool() {
  await pool.end();
  console.log('✓ Pool de conexões MySQL fechado');
}

// ============================================================================
// Exportar funções e pool
// ============================================================================
module.exports = {
  pool,
  query,
  queryOne,
  getTransaction,
  insertAndGetId,
  closePool,
  Transaction,
};
