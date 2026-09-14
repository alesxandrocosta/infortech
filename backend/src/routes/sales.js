const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne, getTransaction } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
const allowedPaymentMethods = ['Dinheiro', 'Pix', 'Cartão Crédito', 'Cartão Débito'];
const PIX_KEY = '31993968438';
const TAX_RATE = Number(process.env.SALES_TAX_RATE || 0.0865);
router.use(requireAuth, requireRoles('admin', 'gerente', 'administrativo', 'atendente'));

function calculateTax(subtotal) {
  return Number((subtotal * TAX_RATE).toFixed(2));
}

function normalizeHardware(input = {}) {
  const source = input.hardware || input;
  const value = (key) => String(source[key] ?? '').trim() || null;
  const hwid = value('hwid_equipamento') || value('ID_Equipamento');
  return {
    hwid_equipamento: hwid ? hwid.toUpperCase().slice(0, 16) : null,
    serial_bios: value('serial_bios') || value('Serial_BIOS'),
    uuid_sistema: value('uuid_sistema') || value('UUID_Sistema'),
    mac_rede: value('mac_rede') || value('MAC_Rede'),
    serial_disco: value('serial_disco') || value('Serial_Disco'),
    especificacoes_json: source.especificacoes_json || { Processador: source.Processador || null, Memoria_RAM: source.Memoria_RAM || null, Armazenamento: source.Armazenamento || null, Data_Cadastro: source.Data_Cadastro || null },
  };
}

router.post('/', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const paymentMethod = String(req.body?.payment_method || 'Pix');
  const amountPaid = paymentMethod === 'Dinheiro' ? Number(req.body?.amount_paid || 0) : null;
  if (!items.length) return res.status(400).json({ success: false, error: { code: 'EMPTY_CART', message: 'Adicione pelo menos um item à venda.' } });
  if (!allowedPaymentMethods.includes(paymentMethod)) return res.status(400).json({ success: false, error: { code: 'INVALID_PAYMENT_METHOD', message: 'Forma de pagamento inválida.' } });

  const quantities = new Map();
  for (const item of items) {
    const id = String(item.id || '');
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
    if (id && quantity) quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  if (!quantities.size) return res.status(400).json({ success: false, error: { code: 'INVALID_ITEMS', message: 'Itens inválidos.' } });

  const ids = [...quantities.keys()];
  const placeholders = ids.map(() => '?').join(', ');
  const products = await query(`SELECT id, codigo_sku, nome, preco_venda, quantidade_estoque FROM product_parts WHERE id IN (${placeholders}) AND ativo = TRUE`, ids);
  if (products.length !== ids.length) return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Um ou mais produtos não foram encontrados.' } });
  const unavailable = products.find((product) => Number(product.quantidade_estoque) < quantities.get(product.id));
  if (unavailable) return res.status(409).json({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: `Estoque insuficiente para ${unavailable.nome}.` } });

  const saleItems = products.map((product) => ({
    product,
    quantity: quantities.get(product.id),
    unitPrice: Number(product.preco_venda || 0),
  }));
  const subtotal = Number(saleItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0).toFixed(2));
  const tax = calculateTax(subtotal);
  const total = Number((subtotal + tax).toFixed(2));
  const changeAmount = paymentMethod === 'Dinheiro' ? Number((amountPaid - total).toFixed(2)) : 0;
  if (paymentMethod === 'Dinheiro' && (!Number.isFinite(amountPaid) || amountPaid < total)) return res.status(400).json({ success: false, error: { code: 'INSUFFICIENT_PAYMENT', message: 'O valor recebido é menor que o total da venda.' } });
  const saleId = randomUUID();
  const hardware = normalizeHardware(req.body);
  const customer = req.body?.customer_id
    ? await queryOne('SELECT id, nome FROM customers WHERE id = ?', [req.body.customer_id])
    : String(req.body?.customer_name || '').trim()
      ? await queryOne('SELECT id, nome FROM customers WHERE nome = ? ORDER BY created_at DESC LIMIT 1', [String(req.body.customer_name).trim()])
      : null;
  const transaction = await getTransaction();

  try {
    await transaction.query(
      `INSERT INTO sales (id, customer_name, customer_id, hwid_equipamento, serial_bios, uuid_sistema, mac_rede, serial_disco, especificacoes_json, subtotal, tax_rate, tax_amount, total, amount_paid, change_amount, payment_method, pix_key, status, user_id, user_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)`,
      [saleId, customer?.nome || String(req.body?.customer_name || '').trim() || null, customer?.id || null, hardware.hwid_equipamento, hardware.serial_bios, hardware.uuid_sistema, hardware.mac_rede, hardware.serial_disco, JSON.stringify(hardware.especificacoes_json), subtotal, TAX_RATE, tax, total, amountPaid ?? total, changeAmount, paymentMethod, PIX_KEY, req.user.id, req.user.full_name],
    );
    for (const item of saleItems) {
      await transaction.query(
        'INSERT INTO sale_items (id, sale_id, product_id, sku, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), saleId, item.product.id, item.product.codigo_sku, item.product.nome, item.quantity, item.unitPrice, item.unitPrice * item.quantity],
      );
      await transaction.query(
        'UPDATE product_parts SET quantidade_estoque = quantidade_estoque - ? WHERE id = ? AND quantidade_estoque >= ?',
        [item.quantity, item.product.id, item.quantity],
      );
      await transaction.query(
        `INSERT INTO inventory_movements (id, peca_id, origem, responsavel_id, responsavel_nome, quantidade, valor)
         VALUES (?, ?, 'Venda em Loja', ?, ?, ?, ?)`,
        [randomUUID(), item.product.id, req.user.id, req.user.full_name, item.quantity, item.unitPrice * item.quantity],
      );
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await transaction.close();
  }

  return res.status(201).json({
    success: true,
    data: {
      id: saleId,
      items: saleItems.map((item) => ({ id: item.product.id, nome: item.product.nome, quantidade: item.quantity, unit_price: item.unitPrice, line_total: item.unitPrice * item.quantity })),
      subtotal,
      tax_rate: TAX_RATE,
      tax_amount: tax,
      total,
      amount_paid: amountPaid ?? total,
      change_amount: changeAmount,
      payment_method: paymentMethod,
      pix_key: paymentMethod === 'Pix' ? PIX_KEY : null,
      status: 'paid',
    },
    message: 'Venda registrada com sucesso e estoque atualizado.',
  });
});

router.get('/', async (_req, res) => {
  const sales = await query('SELECT id, customer_name, subtotal, tax_amount, total, payment_method, status, user_name, created_at FROM sales ORDER BY created_at DESC LIMIT 100');
  return res.json({ success: true, data: sales });
});

router.get('/today', async (_req, res) => {
  const summary = await queryOne(
    `SELECT COUNT(*) AS sales_count, COALESCE(SUM(total), 0) AS total_amount
     FROM sales
     WHERE status = 'paid' AND created_at >= CURRENT_DATE()`,
  );
  return res.json({ success: true, data: { sales_count: Number(summary.sales_count || 0), total_amount: Number(summary.total_amount || 0) } });
});

module.exports = router;
