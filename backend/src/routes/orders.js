const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne, getTransaction } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const allowedStatuses = ['Recebido', 'Em Análise', 'Aguardando Peça', 'Aprovado', 'Concluído', 'Entregue', 'Retorno Assistência', 'Desistência do Cliente'];
const orderSelect = `SELECT so.id, so.protocolo_os AS protocolo, so.cliente_id, c.nome AS cliente, so.tecnico_id, tech.full_name AS tecnico,
  so.atendente_id, so.status, so.equipamento_marca, so.equipamento_modelo, so.equipamento_serie, so.equipamento_tipo,
  so.equipamento_modelo AS equipamento, so.defeito_relatado AS defeito, so.laudo_tecnico, so.data_abertura, so.data_previsao, so.valor_servico, so.taxa_analise, so.desconto_taxa_analise, so.valor_pecas, so.valor_total, oc.itens AS checklist,
  COALESCE((SELECT GROUP_CONCAT(osv.nome ORDER BY osv.nome SEPARATOR ', ') FROM os_services osv WHERE osv.os_id = so.id), '') AS servicos,
  COALESCE((SELECT GROUP_CONCAT(CONCAT(oi.nome_item, ' (', oi.quantidade, 'x)') ORDER BY oi.nome_item SEPARATOR ', ') FROM os_items oi WHERE oi.os_id = so.id), '') AS pecas
  FROM service_orders so JOIN customers c ON c.id = so.cliente_id LEFT JOIN users tech ON tech.id = so.tecnico_id LEFT JOIN os_checklists oc ON oc.os_id = so.id`;

async function resolveCustomerId(body) {
  if (body.cliente_id) return queryOne('SELECT id FROM customers WHERE id = ?', [body.cliente_id]);
  const name = String(body.cliente || '').trim();
  return name ? queryOne('SELECT id FROM customers WHERE nome = ? ORDER BY created_at DESC LIMIT 1', [name]) : null;
}

async function resolveTechnicianId(body) {
  if (!body.tecnico_id && !String(body.tecnico || '').trim()) return null;
  if (body.tecnico_id) return queryOne("SELECT id FROM users WHERE id = ? AND role = 'tecnico'", [body.tecnico_id]);
  const name = String(body.tecnico || '').trim();
  return name ? queryOne("SELECT id FROM users WHERE full_name = ? AND role = 'tecnico' LIMIT 1", [name]) : null;
}

function canAlterOrder(user, order) {
  return ['admin', 'gerente', 'atendente'].includes(user.role) || (user.role === 'tecnico' && (!order.tecnico_id || order.tecnico_id === user.id));
}

async function resolveServices(serviceIds = []) {
  if (!Array.isArray(serviceIds) || !serviceIds.length) return [];
  const placeholders = serviceIds.map(() => '?').join(', ');
  return query(`SELECT id, nome, categoria, preco_sugerido FROM services WHERE id IN (${placeholders}) AND ativo = TRUE`, serviceIds);
}

async function resolveParts(partItems = []) {
  const normalized = Array.isArray(partItems) ? partItems.map((item) => ({ id: item.id || item.peca_id, quantidade: Math.max(1, Number(item.quantidade) || 1) })).filter((item) => item.id) : [];
  if (!normalized.length) return [];
  const ids = normalized.map((item) => item.id);
  const placeholders = ids.map(() => '?').join(', ');
  const parts = await query(`SELECT id, nome, preco_venda FROM product_parts WHERE id IN (${placeholders}) AND ativo = TRUE`, ids);
  return parts.map((part) => ({ ...part, quantidade: normalized.find((item) => item.id === part.id)?.quantidade || 1 }));
}

function calculateOrderTotals(status, services, parts) {
  const taxaAnalise = 120;
  const valorServicos = services.reduce((total, service) => total + Number(service.preco_sugerido || 0), 0);
  const valorPecas = parts.reduce((total, part) => total + (Number(part.preco_venda || 0) * part.quantidade), 0);
  const isAnalysisWaived = status === 'Aprovado' || status === 'Concluído' || status === 'Entregue';
  const descontoAnalise = isAnalysisWaived ? taxaAnalise : 0;
  return { taxaAnalise, descontoAnalise, valorServicos, valorPecas, valorTotal: taxaAnalise + valorServicos + valorPecas - descontoAnalise };
}

router.get('/', async (_req, res) => {
  const orders = await query(`${orderSelect} ORDER BY so.created_at DESC`);
  return res.json({ success: true, data: orders, message: 'Ordens carregadas com sucesso.' });
});

router.post('/', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const cliente = String(req.body?.cliente || '').trim();
  const equipamento = String(req.body?.equipamento || '').trim();
  const defeito = String(req.body?.defeito || '').trim();
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : 'Recebido';
  if (!cliente || !equipamento || !defeito) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cliente, equipamento e defeito são obrigatórios.' } });

  const customer = await resolveCustomerId(req.body);
  const technician = await resolveTechnicianId(req.body);
  if (!customer) return res.status(400).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente não encontrado.' } });
  if (req.body.tecnico || req.body.tecnico_id) {
    if (!technician) return res.status(400).json({ success: false, error: { code: 'TECHNICIAN_NOT_FOUND', message: 'Técnico não encontrado.' } });
  }
  const selectedServices = await resolveServices(req.body?.service_ids);
  const selectedParts = await resolveParts(req.body?.part_items);
  if (Array.isArray(req.body?.service_ids) && selectedServices.length !== req.body.service_ids.length) return res.status(400).json({ success: false, error: { code: 'SERVICE_NOT_FOUND', message: 'Um ou mais serviços selecionados não foram encontrados.' } });
  const totals = calculateOrderTotals(status, selectedServices, selectedParts);

  const transaction = await getTransaction();
  try {
    await transaction.query("UPDATE sequence_counters SET counter_value = counter_value + 1 WHERE counter_type = 'protocolo_os'");
    const counter = await transaction.query("SELECT counter_value FROM sequence_counters WHERE counter_type = 'protocolo_os'");
    const protocol = `OS-${String(counter[0].counter_value).padStart(5, '0')}`;
    const id = randomUUID();
    await transaction.query(
      `INSERT INTO service_orders (id, protocolo_os, cliente_id, tecnico_id, atendente_id, status, equipamento_modelo, equipamento_tipo, defeito_relatado, valor_servico, taxa_analise, desconto_taxa_analise, valor_pecas, valor_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, protocol, customer.id, technician?.id || null, req.user.id, status, equipamento, req.body?.equipamento_tipo || 'Não informado', defeito, totals.valorServicos, totals.taxaAnalise, totals.descontoAnalise, totals.valorPecas, totals.valorTotal],
    );
    await transaction.query('INSERT INTO os_checklists (id, os_id, itens, observacoes) VALUES (?, ?, ?, ?)', [randomUUID(), id, JSON.stringify(Array.isArray(req.body?.checklist) ? req.body.checklist : []), String(req.body?.observacao || '').trim()]);
    for (const service of selectedServices) await transaction.query('INSERT INTO os_services (id, os_id, service_id, nome, categoria, preco, quantidade, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1, FALSE)', [randomUUID(), id, service.id, service.nome, service.categoria, service.preco_sugerido]);
    for (const part of selectedParts) await transaction.query('INSERT INTO os_items (id, os_id, tipo_item, referencia_id, nome_item, quantidade, valor_unitario) VALUES (?, ?, \'peca\', ?, ?, ?, ?)', [randomUUID(), id, part.id, part.nome, part.quantidade, part.preco_venda]);
    await transaction.query(
      'INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), id, status, req.user.id, req.user.full_name, String(req.body?.observacao || '').trim() || 'OS criada.'],
    );
    await transaction.commit();
    const order = await queryOne(`${orderSelect} WHERE so.id = ?`, [id]);
    return res.status(201).json({ success: true, data: order, message: 'OS criada com sucesso.' });
  } catch (error) {
    await transaction.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_PROTOCOL', message: 'Não foi possível gerar um protocolo único.' } });
    throw error;
  } finally {
    await transaction.close();
  }
});

router.put('/:id', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const existing = await queryOne('SELECT id, tecnico_id, status FROM service_orders WHERE id = ?', [req.params.id]);
  const cliente = String(req.body?.cliente || '').trim();
  const equipamento = String(req.body?.equipamento || '').trim();
  const defeito = String(req.body?.defeito || '').trim();
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, existing)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  if (!cliente || !equipamento || !defeito) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cliente, equipamento e defeito são obrigatórios.' } });
  const customer = await resolveCustomerId(req.body);
  const technician = await resolveTechnicianId(req.body);
  if (!customer || ((req.body.tecnico || req.body.tecnico_id) && !technician)) return res.status(400).json({ success: false, error: { code: 'REFERENCE_NOT_FOUND', message: 'Cliente ou técnico não encontrado.' } });
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : 'Recebido';
  const selectedServices = await resolveServices(req.body?.service_ids);
  const selectedParts = await resolveParts(req.body?.part_items);
  const totals = calculateOrderTotals(status, selectedServices, selectedParts);
  const transaction = await getTransaction();
  try {
    await transaction.query('UPDATE service_orders SET cliente_id = ?, tecnico_id = ?, status = ?, equipamento_modelo = ?, equipamento_tipo = ?, defeito_relatado = ?, valor_servico = ?, taxa_analise = ?, desconto_taxa_analise = ?, valor_pecas = ?, valor_total = ? WHERE id = ?', [customer.id, technician?.id || null, status, equipamento, req.body?.equipamento_tipo || 'Não informado', defeito, totals.valorServicos, totals.taxaAnalise, totals.descontoAnalise, totals.valorPecas, totals.valorTotal, req.params.id]);
    await transaction.query('DELETE FROM os_checklists WHERE os_id = ?', [req.params.id]);
    await transaction.query('INSERT INTO os_checklists (id, os_id, itens, observacoes) VALUES (?, ?, ?, ?)', [randomUUID(), req.params.id, JSON.stringify(Array.isArray(req.body?.checklist) ? req.body.checklist : []), String(req.body?.observacao || '').trim()]);
  await transaction.query('DELETE FROM os_services WHERE os_id = ?', [req.params.id]);
  await transaction.query('DELETE FROM os_items WHERE os_id = ?', [req.params.id]);
  for (const service of selectedServices) await transaction.query('INSERT INTO os_services (id, os_id, service_id, nome, categoria, preco, quantidade, is_custom) VALUES (?, ?, ?, ?, ?, ?, 1, FALSE)', [randomUUID(), req.params.id, service.id, service.nome, service.categoria, service.preco_sugerido]);
  for (const part of selectedParts) await transaction.query('INSERT INTO os_items (id, os_id, tipo_item, referencia_id, nome_item, quantidade, valor_unitario) VALUES (?, ?, \'peca\', ?, ?, ?, ?)', [randomUUID(), req.params.id, part.id, part.nome, part.quantidade, part.preco_venda]);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await transaction.close();
  }
  await query(
    'INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), req.params.id, status, req.user.id, req.user.full_name, String(req.body?.observacao || '').trim()],
  );
  const order = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  return res.json({ success: true, data: order, message: 'Ordem atualizada com sucesso.' });
});

router.get('/:id/history', async (req, res) => {
  const history = await query(
    'SELECT id, status, usuario_id, usuario_nome, observacao, created_at FROM os_status_histories WHERE os_id = ? ORDER BY created_at DESC',
    [req.params.id],
  );
  return res.json({ success: true, data: history, message: 'Histórico carregado com sucesso.' });
});

router.patch('/:id/status', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const order = await queryOne('SELECT id, tecnico_id, status FROM service_orders WHERE id = ?', [req.params.id]);
  const status = String(req.body?.status || '').trim();
  const observacao = String(req.body?.observacao || '').trim();
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, order)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  if (!allowedStatuses.includes(status) || !observacao) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status válido e observação são obrigatórios.' } });
  const totals = calculateOrderTotals(status, [], []);
  const assignedTechnicianId = req.user.role === 'tecnico' && !order.tecnico_id ? req.user.id : order.tecnico_id;
  const transaction = await getTransaction();
  try {
    if (status === 'Aprovado' && order.status !== 'Aprovado') {
      const items = await transaction.query('SELECT oi.referencia_id, oi.quantidade, oi.valor_unitario, pp.quantidade_estoque FROM os_items oi JOIN product_parts pp ON pp.id = oi.referencia_id WHERE oi.os_id = ? AND oi.tipo_item = \'peca\'', [req.params.id]);
      if (items.some((item) => Number(item.quantidade_estoque) < Number(item.quantidade))) {
        await transaction.rollback();
        return res.status(409).json({ success: false, error: { code: 'INSUFFICIENT_STOCK', message: 'Uma ou mais peças não possuem estoque suficiente.' } });
      }
      for (const item of items) {
        await transaction.query('UPDATE product_parts SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?', [item.quantidade, item.referencia_id]);
        await transaction.query('INSERT INTO inventory_movements (id, peca_id, origem, referencia_id, responsavel_id, responsavel_nome, quantidade, valor) VALUES (?, ?, \'Atribuição em OS\', ?, ?, ?, ?, ?)', [randomUUID(), item.referencia_id, req.params.id, req.user.id, req.user.full_name, item.quantidade, Number(item.valor_unitario || 0) * Number(item.quantidade)]);
      }
    }
    await transaction.query('UPDATE service_orders SET tecnico_id = ?, status = ?, desconto_taxa_analise = ?, valor_total = valor_servico + valor_pecas + taxa_analise - ? WHERE id = ?', [assignedTechnicianId, status, totals.descontoAnalise, totals.descontoAnalise, req.params.id]);
    await transaction.query('INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), req.params.id, status, req.user.id, req.user.full_name, observacao]);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; } finally { await transaction.close(); }
  const updated = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  return res.json({ success: true, data: updated, message: 'Progresso da OS atualizado com sucesso.' });
});

router.delete('/:id', requireRoles('admin', 'tecnico'), async (req, res) => {
  const order = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, order)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  await query('DELETE FROM service_orders WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: order, message: 'Ordem removida com sucesso.' });
});

module.exports = router;
