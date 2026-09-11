const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
const serviceFields = 'id, nome, descricao, notas, categoria, modalidade, preco_sugerido, tempo_estimado_horas, ativo, created_at, updated_at';
const partFields = 'id, codigo_sku, nome, categoria, condicao, equipamento_tipo, technical_specs, quantidade_estoque, quantidade_minima, preco_custo, preco_venda, ativo, created_at, updated_at';
const serviceCategories = ['Troca', 'Reparo', 'Software', 'Diagnóstico', 'Limpeza', 'Manutenção', 'Formatação', 'Backup', 'Preventiva', 'Redes', 'Suporte', 'Outro'];
const partCategories = ['Tela', 'Placa-Mãe', 'Processador', 'Memória RAM', 'Bateria', 'Conector', 'Fonte', 'Adaptador', 'Insumo', 'Acessório', 'Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad', 'Outro'];
router.use(requireAuth);

router.get('/inventory', async (req, res) => {
  const parts = await query(`SELECT ${partFields} FROM product_parts ORDER BY created_at DESC`);
  for (const part of parts) {
    part.movements = await query('SELECT origem, responsavel_nome, quantidade, valor, status, occurred_at FROM inventory_movements WHERE peca_id = ? ORDER BY occurred_at DESC', [part.id]);
  }
  return res.json({ success: true, data: parts, message: 'Estoque carregado com sucesso.' });
});

router.post('/inventory/:id/movements', requireRoles('admin', 'gerente', 'administrativo', 'atendente'), async (req, res) => {
  const quantity = Math.max(1, Number(req.body?.quantidade) || 1);
  const item = await queryOne('SELECT id, preco_venda, quantidade_estoque FROM product_parts WHERE id = ? AND ativo = TRUE', [req.params.id]);
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Peça não encontrada.' } });
  if (item.quantidade_estoque < quantity) return res.status(409).json({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'Estoque insuficiente.' } });
  const movementId = randomUUID();
  const transaction = await require('../config/database').getTransaction();
  try {
    await transaction.query('UPDATE product_parts SET quantidade_estoque = quantidade_estoque - ? WHERE id = ? AND quantidade_estoque >= ?', [quantity, item.id, quantity]);
    await transaction.query('INSERT INTO inventory_movements (id, peca_id, origem, responsavel_id, responsavel_nome, quantidade, valor) VALUES (?, ?, \'Venda em Loja\', ?, ?, ?, ?)', [movementId, item.id, req.user.id, req.user.full_name, quantity, Number(item.preco_venda || 0) * quantity]);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; } finally { await transaction.close(); }
  return res.status(201).json({ success: true, data: { id: movementId }, message: 'Venda registrada e estoque atualizado.' });
});

router.post('/inventory', requireRoles('admin', 'gerente', 'administrativo'), async (req, res) => {
  const codigo = String(req.body?.codigo || '').trim();
  const nome = String(req.body?.nome || '').trim();
  const estoque = Number(req.body?.estoque);
  const minimo = Number(req.body?.minimo);
  const preco = Number(req.body?.preco);
  const categoria = String(req.body?.categoria || 'Outro').trim();
  const technicalSpecs = req.body?.specs && typeof req.body.specs === 'object' ? JSON.stringify(req.body.specs) : '{}';
  if (!codigo || !nome || !Number.isFinite(estoque) || estoque < 0 || !Number.isFinite(minimo) || minimo < 0 || !Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'SKU, nome, quantidades válidas e preço maior que zero são obrigatórios.' } });
  if (!partCategories.includes(categoria)) return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Categoria de peça inválida.' } });
  if (await queryOne('SELECT id FROM product_parts WHERE codigo_sku = ?', [codigo])) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_SKU', message: 'Este SKU já está cadastrado.' } });
  const id = randomUUID();
  await query('INSERT INTO product_parts (id, codigo_sku, nome, categoria, condicao, equipamento_tipo, technical_specs, quantidade_estoque, quantidade_minima, preco_venda, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)', [id, codigo, nome, categoria, req.body?.condicao || 'Nova', req.body?.equipamento_tipo || 'Universal', technicalSpecs, estoque, minimo, preco]);
  const item = await queryOne(`SELECT ${partFields} FROM product_parts WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, data: item, message: 'Peça cadastrada com sucesso.' });
});

router.put('/inventory/:id', requireRoles('admin', 'gerente', 'administrativo'), async (req, res) => {
  const item = await queryOne('SELECT id FROM product_parts WHERE id = ?', [req.params.id]);
  const codigo = String(req.body?.codigo || '').trim();
  const nome = String(req.body?.nome || '').trim();
  const estoque = Number(req.body?.estoque);
  const minimo = Number(req.body?.minimo);
  const preco = Number(req.body?.preco);
  const categoria = String(req.body?.categoria || 'Outro').trim();
  const technicalSpecs = req.body?.specs && typeof req.body.specs === 'object' ? JSON.stringify(req.body.specs) : '{}';
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Peça não encontrada.' } });
  if (!codigo || !nome || !Number.isFinite(estoque) || estoque < 0 || !Number.isFinite(minimo) || minimo < 0 || !Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'SKU, nome, quantidades válidas e preço maior que zero são obrigatórios.' } });
  if (!partCategories.includes(categoria)) return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Categoria de peça inválida.' } });
  if (await queryOne('SELECT id FROM product_parts WHERE codigo_sku = ? AND id <> ?', [codigo, req.params.id])) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_SKU', message: 'Este SKU já está cadastrado.' } });
  await query('UPDATE product_parts SET codigo_sku = ?, nome = ?, categoria = ?, condicao = ?, equipamento_tipo = ?, technical_specs = ?, quantidade_estoque = ?, quantidade_minima = ?, preco_venda = ? WHERE id = ?', [codigo, nome, categoria, req.body?.condicao || 'Nova', req.body?.equipamento_tipo || 'Universal', technicalSpecs, estoque, minimo, preco, req.params.id]);
  const updated = await queryOne(`SELECT ${partFields} FROM product_parts WHERE id = ?`, [req.params.id]);
  return res.json({ success: true, data: updated, message: 'Peça atualizada com sucesso.' });
});

router.delete('/inventory/:id', requireRoles('admin', 'gerente'), async (req, res) => {
  const item = await queryOne(`SELECT ${partFields} FROM product_parts WHERE id = ?`, [req.params.id]);
  if (!item) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Peça não encontrada.' } });
  try {
    await query('DELETE FROM product_parts WHERE id = ?', [req.params.id]);
    return res.json({ success: true, data: item, message: 'Peça removida com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ success: false, error: { code: 'PART_IN_USE', message: 'A peça está vinculada a kits ou inventários.' } });
    throw error;
  }
});

router.get('/services', async (_req, res) => {
  const services = await query(`SELECT ${serviceFields} FROM services ORDER BY created_at DESC`);
  return res.json({ success: true, data: services, message: 'Serviços carregados com sucesso.' });
});

router.post('/services', requireRoles('admin', 'gerente'), async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const tempo = Number(req.body?.tempo);
  const preco = Number(req.body?.preco);
  const categoria = String(req.body?.categoria || 'Reparo').trim();
  const modalidade = req.body?.modalidade === 'Remoto' ? 'Remoto' : 'Presencial';
  if (!nome || !Number.isFinite(tempo) || tempo <= 0 || !Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, tempo estimado e preço maior que zero são obrigatórios.' } });
  if (!serviceCategories.includes(categoria)) return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Categoria de serviço inválida.' } });
  const id = randomUUID();
  await query('INSERT INTO services (id, nome, descricao, notas, categoria, modalidade, preco_sugerido, tempo_estimado_horas, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)', [id, nome, req.body?.descricao || '', req.body?.notas || '', categoria, modalidade, preco, tempo]);
  const service = await queryOne(`SELECT ${serviceFields} FROM services WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, data: service, message: 'Serviço cadastrado com sucesso.' });
});

router.put('/services/:id', requireRoles('admin', 'gerente'), async (req, res) => {
  const existing = await queryOne('SELECT id FROM services WHERE id = ?', [req.params.id]);
  const nome = String(req.body?.nome || '').trim();
  const tempo = Number(req.body?.tempo);
  const preco = Number(req.body?.preco);
  const categoria = String(req.body?.categoria || 'Reparo').trim();
  const modalidade = req.body?.modalidade === 'Remoto' ? 'Remoto' : 'Presencial';
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } });
  if (!nome || !Number.isFinite(tempo) || tempo <= 0 || !Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, tempo e preço maior que zero são obrigatórios.' } });
  if (!serviceCategories.includes(categoria)) return res.status(400).json({ success: false, error: { code: 'INVALID_CATEGORY', message: 'Categoria de serviço inválida.' } });
  await query('UPDATE services SET nome = ?, descricao = ?, notas = ?, categoria = ?, modalidade = ?, preco_sugerido = ?, tempo_estimado_horas = ? WHERE id = ?', [nome, req.body?.descricao || '', req.body?.notas || '', categoria, modalidade, preco, tempo, req.params.id]);
  const service = await queryOne(`SELECT ${serviceFields} FROM services WHERE id = ?`, [req.params.id]);
  return res.json({ success: true, data: service, message: 'Serviço atualizado com sucesso.' });
});

router.delete('/services/:id', requireRoles('admin', 'gerente'), async (req, res) => {
  const service = await queryOne(`SELECT ${serviceFields} FROM services WHERE id = ?`, [req.params.id]);
  if (!service) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } });
  await query('DELETE FROM services WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: service, message: 'Serviço removido com sucesso.' });
});

module.exports = router;
