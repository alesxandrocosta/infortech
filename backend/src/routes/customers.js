const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
const selectFields = 'id, nome, tipo, documento, telefone, whatsapp, email, endereco, numero, cep, status, created_at, updated_at';

router.get('/', async (_req, res) => {
  const customers = await query(`SELECT ${selectFields} FROM customers ORDER BY created_at DESC`);
  return res.json({ success: true, data: customers, message: 'Clientes carregados com sucesso.' });
});

router.post('/', requireRoles('admin', 'gerente', 'administrativo', 'atendente'), async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const documento = String(req.body?.documento || '').trim();
  const telefone = String(req.body?.telefone || '').trim();
  const whatsapp = String(req.body?.whatsapp || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const endereco = String(req.body?.endereco || '').trim();
  const numero = String(req.body?.numero || '').trim();
  const cep = String(req.body?.cep || '').trim();
  const tipo = req.body?.tipo === 'PJ' ? 'PJ' : 'PF';
  const status = req.body?.status === 'Inadimplente' ? 'Inadimplente' : 'Adimplente';
  if (!nome || !documento || (!telefone && !whatsapp && !email)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, documento e telefone, WhatsApp ou e-mail são obrigatórios.' } });
  const id = randomUUID();
  await query('INSERT INTO customers (id, nome, tipo, documento, telefone, whatsapp, email, endereco, numero, cep, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, nome, tipo, documento, telefone, whatsapp, email, endereco, numero, cep, status]);
  const customer = await queryOne(`SELECT ${selectFields} FROM customers WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, data: customer, message: 'Cliente cadastrado com sucesso.' });
});

router.put('/:id', requireRoles('admin', 'gerente', 'administrativo', 'atendente'), async (req, res) => {
  const existing = await queryOne('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  const nome = String(req.body?.nome || '').trim();
  const documento = String(req.body?.documento || '').trim();
  const telefone = String(req.body?.telefone || '').trim();
  const whatsapp = String(req.body?.whatsapp || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const endereco = String(req.body?.endereco || '').trim();
  const numero = String(req.body?.numero || '').trim();
  const cep = String(req.body?.cep || '').trim();
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } });
  if (!nome || !documento || (!telefone && !whatsapp && !email)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, documento e telefone, WhatsApp ou e-mail são obrigatórios.' } });
  await query('UPDATE customers SET nome = ?, tipo = ?, documento = ?, telefone = ?, whatsapp = ?, email = ?, endereco = ?, numero = ?, cep = ?, status = ? WHERE id = ?', [nome, req.body?.tipo === 'PJ' ? 'PJ' : 'PF', documento, telefone, whatsapp, email, endereco, numero, cep, req.body?.status === 'Inadimplente' ? 'Inadimplente' : 'Adimplente', req.params.id]);
  const customer = await queryOne(`SELECT ${selectFields} FROM customers WHERE id = ?`, [req.params.id]);
  return res.json({ success: true, data: customer, message: 'Cliente atualizado com sucesso.' });
});

router.delete('/:id', requireRoles('admin', 'gerente', 'administrativo'), async (req, res) => {
  const customer = await queryOne(`SELECT ${selectFields} FROM customers WHERE id = ?`, [req.params.id]);
  if (!customer) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } });
  await query('DELETE FROM customers WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: customer, message: 'Cliente removido com sucesso.' });
});

module.exports = router;
