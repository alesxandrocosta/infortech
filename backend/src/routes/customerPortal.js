const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { query, queryOne, getTransaction } = require('../config/database');

const router = express.Router();
const paymentMethods = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Outro'];

function getPortalCustomer(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const id = token.startsWith('portal-token-') ? token.slice('portal-token-'.length) : '';
  return id ? queryOne('SELECT id, nome, tipo, documento, telefone, email, status FROM customers WHERE id = ?', [id]) : null;
}

async function requirePortalCustomer(req, res, next) {
  const customer = await getPortalCustomer(req);
  if (!customer) return res.status(401).json({ success: false, error: { code: 'PORTAL_UNAUTHORIZED', message: 'Acesso do cliente inválido.' } });
  req.customer = customer;
  return next();
}

router.post('/register', async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const documento = String(req.body?.documento || '').trim();
  const telefone = String(req.body?.telefone || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!nome || !documento || !email || password.length < 6) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, documento, e-mail e senha de 6 caracteres são obrigatórios.' } });
  if (await queryOne('SELECT id FROM customers WHERE email = ?', [email])) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'E-mail já cadastrado.' } });
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await query('INSERT INTO customers (id, nome, tipo, documento, telefone, email, portal_password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, nome, req.body?.tipo === 'PJ' ? 'PJ' : 'PF', documento, telefone, email, passwordHash, 'Adimplente']);
  return res.status(201).json({ success: true, data: { token: `portal-token-${id}`, customer: { id, nome, email, telefone } }, message: 'Cadastro realizado com sucesso.' });
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const customer = await queryOne('SELECT id, nome, email, telefone, portal_password_hash FROM customers WHERE email = ?', [email]);
  if (!customer || !customer.portal_password_hash || !(await bcrypt.compare(password, customer.portal_password_hash))) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } });
  return res.json({ success: true, data: { token: `portal-token-${customer.id}`, customer: { id: customer.id, nome: customer.nome, email: customer.email, telefone: customer.telefone } } });
});

router.get('/me', requirePortalCustomer, (req, res) => res.json({ success: true, data: req.customer }));

router.get('/orders', requirePortalCustomer, async (req, res) => {
  const orders = await query(`SELECT so.id, so.protocolo_os AS protocolo, so.status, so.equipamento_modelo AS equipamento, so.defeito_relatado AS defeito, so.valor_total, so.created_at
    FROM service_orders so WHERE so.cliente_id = ? ORDER BY so.created_at DESC`, [req.customer.id]);
  return res.json({ success: true, data: orders });
});

router.post('/orders', requirePortalCustomer, async (req, res) => {
  const equipamento = String(req.body?.equipamento || '').trim();
  const defeito = String(req.body?.defeito || '').trim();
  const formaPagamento = String(req.body?.forma_pagamento || 'Pix').trim();
  if (!equipamento || !defeito || !paymentMethods.includes(formaPagamento)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Equipamento, defeito e forma de pagamento são obrigatórios.' } });
  const transaction = await getTransaction();
  try {
    const operator = await transaction.query("SELECT id, full_name FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1");
    if (!operator.length) {
      await transaction.rollback();
      return res.status(503).json({ success: false, error: { code: 'NO_OPERATOR', message: 'Não há usuário interno disponível para receber a solicitação.' } });
    }
    await transaction.query("UPDATE sequence_counters SET counter_value = counter_value + 1 WHERE counter_type = 'protocolo_os'");
    const [counter] = await transaction.query("SELECT counter_value FROM sequence_counters WHERE counter_type = 'protocolo_os'");
    const id = randomUUID();
    const protocolo = `OS-${String(counter[0].counter_value).padStart(5, '0')}`;
    await transaction.query(`INSERT INTO service_orders (id, protocolo_os, cliente_id, atendente_id, status, equipamento_modelo, equipamento_tipo, defeito_relatado, valor_servico, taxa_analise, desconto_taxa_analise, valor_pecas, valor_total) VALUES (?, ?, ?, ?, 'Recebido', ?, ?, ?, 0, 120, 0, 0, 120)`, [id, protocolo, req.customer.id, operator[0].id, equipamento, req.body?.equipamento_tipo || 'Não informado', defeito]);
    await transaction.query('INSERT INTO payments (id, os_id, valor, forma_pagamento, observacao) VALUES (?, ?, 0, ?, ?)', [randomUUID(), id, formaPagamento, 'Forma de pagamento informada pelo cliente.']);
    await transaction.query('INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, NULL, ?, ?)', [randomUUID(), id, 'Recebido', req.customer.nome, 'Solicitação aberta pelo portal do cliente.']);
    await transaction.commit();
    return res.status(201).json({ success: true, data: { id, protocolo, status: 'Recebido', equipamento, defeito, cliente: req.customer.nome, forma_pagamento: formaPagamento, valor_total: 120 }, message: 'Solicitação aberta com sucesso.' });
  } catch (error) { await transaction.rollback(); throw error; } finally { await transaction.close(); }
});

router.get('/orders/:id/shipping-label', requirePortalCustomer, async (req, res) => {
  const order = await queryOne(`SELECT so.id, so.protocolo_os AS protocolo, c.nome AS cliente, c.documento, c.telefone, c.email, so.equipamento_modelo AS equipamento, so.defeito_relatado AS defeito, so.status FROM service_orders so JOIN customers c ON c.id = so.cliente_id WHERE so.id = ? AND so.cliente_id = ?`, [req.params.id, req.customer.id]);
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  return res.json({ success: true, data: order });
});

module.exports = router;