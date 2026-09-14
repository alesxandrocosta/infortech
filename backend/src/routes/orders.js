const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne, getTransaction } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { notifyOrderStatus } = require('../services/whatsapp');

const router = express.Router();
router.use(requireAuth);

const allowedStatuses = ['Recebido', 'Aguardando Análise', 'Em Análise', 'Aguardando Peça', 'Aguardando Aprovação', 'Aprovado', 'Em Execução', 'Concluído', 'Finalizado', 'Entregue', 'Retorno Assistência', 'Desistência do Cliente'];
const allowedBudgetStatuses = ['pendente', 'aprovado', 'recusado'];
const hardwareFields = ['hwid_equipamento', 'serial_bios', 'uuid_sistema', 'mac_rede', 'serial_disco'];
const hardwareLabels = {
  serial_bios: 'Placa-mãe alterada (Serial BIOS divergente)',
  uuid_sistema: 'Placa-mãe alterada (UUID divergente)',
  mac_rede: 'Interface de rede alterada (MAC divergente)',
  serial_disco: 'SSD substituído (Serial do disco divergente)',
};
const statusTransitions = {
  Recebido: ['Aguardando Análise', 'Em Análise', 'Desistência do Cliente'],
  'Aguardando Análise': ['Em Análise', 'Desistência do Cliente'],
  'Em Análise': ['Aguardando Peça', 'Aguardando Aprovação', 'Desistência do Cliente'],
  'Aguardando Peça': ['Aguardando Aprovação', 'Em Análise', 'Desistência do Cliente'],
  'Aguardando Aprovação': ['Aprovado', 'Desistência do Cliente'],
  Aprovado: ['Em Execução', 'Desistência do Cliente'],
  'Em Execução': ['Concluído', 'Retorno Assistência'],
  Concluído: ['Finalizado', 'Retorno Assistência'],
  Finalizado: ['Entregue', 'Retorno Assistência'],
  Entregue: ['Retorno Assistência'],
  'Retorno Assistência': ['Em Análise', 'Aguardando Aprovação'],
  'Desistência do Cliente': [],
};
const orderSelect = `SELECT so.id, so.protocolo_os AS protocolo, so.cliente_id, c.nome AS cliente, c.telefone, c.whatsapp, so.tecnico_id, tech.full_name AS tecnico,
  so.atendente_id, so.status, so.orcamento_status, so.equipamento_marca, so.equipamento_modelo, so.equipamento_serie, so.equipamento_tipo,
  so.hwid_equipamento, so.serial_bios, so.uuid_sistema, so.mac_rede, so.serial_disco, so.especificacoes_json, so.hardware_validacao_status, so.hardware_divergencias_json, so.hardware_validado_em,
  so.equipamento_modelo AS equipamento, so.defeito_relatado AS defeito, so.laudo_tecnico, so.servicos_realizados, so.garantia_servicos_dias, so.garantia_pecas_dias, so.estoque_baixado_em, so.data_abertura, so.data_previsao, so.valor_servico, so.taxa_analise, so.desconto_taxa_analise, so.valor_pecas, so.valor_total, oc.itens AS checklist,
  COALESCE((SELECT GROUP_CONCAT(osv.nome ORDER BY osv.nome SEPARATOR ', ') FROM os_services osv WHERE osv.os_id = so.id), '') AS servicos,
  COALESCE((SELECT GROUP_CONCAT(CONCAT(oi.nome_item, ' (', oi.quantidade, 'x)') ORDER BY oi.nome_item SEPARATOR ', ') FROM os_items oi WHERE oi.os_id = so.id), '') AS pecas
  FROM service_orders so JOIN customers c ON c.id = so.cliente_id LEFT JOIN users tech ON tech.id = so.tecnico_id LEFT JOIN os_checklists oc ON oc.os_id = so.id`;

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
    especificacoes_json: source.especificacoes_json || {
      Processador: source.Processador || null,
      Memoria_RAM: source.Memoria_RAM || null,
      Armazenamento: source.Armazenamento || null,
      Data_Cadastro: source.Data_Cadastro || null,
    },
  };
}

function compareHardware(reference, received) {
  if (!reference) return { status: 'sem_referencia', divergencias: [] };
  const divergencias = [];
  if (reference.hwid_equipamento !== received.hwid_equipamento) divergencias.push('ID único do hardware divergente');
  for (const field of hardwareFields.slice(1)) {
    if (reference[field] && received[field] && reference[field].toUpperCase() !== received[field].toUpperCase()) divergencias.push(hardwareLabels[field]);
  }
  return { status: divergencias.length ? 'divergente' : 'autentico', divergencias };
}

async function findHardwareReference(clienteId, currentOrderId) {
  return queryOne(
    `SELECT hwid_equipamento, serial_bios, uuid_sistema, mac_rede, serial_disco, created_at
     FROM service_orders WHERE cliente_id = ? AND id <> ? AND hwid_equipamento IS NOT NULL
     UNION ALL
     SELECT hwid_equipamento, serial_bios, uuid_sistema, mac_rede, serial_disco, created_at
     FROM sales WHERE customer_id = ? AND hwid_equipamento IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [clienteId, currentOrderId || '', clienteId],
  );
}

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

function calculateBudgetTotals(status, budgetStatus, services, parts) {
  const totals = calculateOrderTotals(status, services, parts);
  const normalizedBudgetStatus = budgetStatus || (status === 'Desistência do Cliente' ? 'recusado' : ['Aprovado', 'Em Execução', 'Concluído', 'Finalizado', 'Entregue'].includes(status) ? 'aprovado' : 'pendente');
  if (normalizedBudgetStatus === 'recusado') return { ...totals, descontoAnalise: 0, valorTotal: totals.taxaAnalise };
  if (normalizedBudgetStatus === 'aprovado') return { ...totals, descontoAnalise: totals.taxaAnalise, valorTotal: totals.valorServicos + totals.valorPecas };
  return { ...totals, descontoAnalise: 0, valorTotal: totals.taxaAnalise + totals.valorServicos + totals.valorPecas };
}

function assertStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  if (!statusTransitions[currentStatus]?.includes(nextStatus)) {
    const error = new Error(`Transição inválida: ${currentStatus} -> ${nextStatus}`);
    error.statusCode = 409;
    error.code = 'INVALID_STATUS_TRANSITION';
    throw error;
  }
}

async function notifyStatusChange(order, previousStatus, observacao) {
  if (order.status === previousStatus) return null;
  try {
    return await notifyOrderStatus({ order: { ...order, observacao }, previousStatus });
  } catch (error) {
    console.error('WhatsApp status notification error:', error.message);
    return { sent: false, skipped: false, reason: 'WHATSAPP_SEND_ERROR' };
  }
}

router.get('/', async (_req, res) => {
  const orders = await query(`${orderSelect} ORDER BY so.created_at DESC`);
  return res.json({ success: true, data: orders, message: 'Ordens carregadas com sucesso.' });
});

router.get('/queue', async (_req, res) => {
  const orders = await query(`${orderSelect} WHERE so.tecnico_id IS NULL AND so.status IN ('Recebido', 'Aguardando Análise', 'Em Análise') ORDER BY so.created_at ASC`);
  return res.json({ success: true, data: orders, message: 'Fila FIFO carregada com sucesso.' });
});

async function assignOrder(orderId, technicianId, user) {
  const technician = await queryOne("SELECT id, full_name FROM users WHERE id = ? AND (role = 'tecnico' OR JSON_CONTAINS(COALESCE(roles, JSON_ARRAY()), '\"tecnico\"'))", [technicianId]);
  if (!technician) return { error: { status: 404, code: 'TECHNICIAN_NOT_FOUND', message: 'Técnico não encontrado.' } };
  const order = await queryOne('SELECT id, tecnico_id, status FROM service_orders WHERE id = ?', [orderId]);
  if (!order) return { error: { status: 404, code: 'NOT_FOUND', message: 'Ordem não encontrada.' } };
  if (order.tecnico_id && order.tecnico_id !== technician.id) return { error: { status: 409, code: 'ORDER_ALREADY_ASSIGNED', message: 'Esta OS já está atribuída a outro técnico.' } };
  await query('UPDATE service_orders SET tecnico_id = ? WHERE id = ?', [technician.id, orderId]);
  await query('INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), orderId, order.status, user.id, user.full_name, `OS atribuída ao técnico ${technician.full_name}.`]);
  return { order: await queryOne(`${orderSelect} WHERE so.id = ?`, [orderId]) };
}

router.patch('/:id/assign', requireRoles('admin', 'gerente', 'atendente'), async (req, res) => {
  const result = await assignOrder(req.params.id, String(req.body?.tecnico_id || ''), req.user);
  if (result.error) return res.status(result.error.status).json({ success: false, error: { code: result.error.code, message: result.error.message } });
  return res.json({ success: true, data: result.order, message: 'OS atribuída com sucesso.' });
});

router.post('/queue/claim-next', requireRoles('tecnico'), async (req, res) => {
  const next = await queryOne("SELECT id FROM service_orders WHERE tecnico_id IS NULL AND status IN ('Recebido', 'Aguardando Análise', 'Em Análise') ORDER BY created_at ASC LIMIT 1");
  if (!next) return res.status(404).json({ success: false, error: { code: 'EMPTY_QUEUE', message: 'Não há OS disponível na fila.' } });
  const result = await assignOrder(next.id, req.user.id, req.user);
  if (result.error) return res.status(result.error.status).json({ success: false, error: { code: result.error.code, message: result.error.message } });
  return res.json({ success: true, data: result.order, message: 'Próxima OS da fila assumida com sucesso.' });
});

router.post('/', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const cliente = String(req.body?.cliente || '').trim();
  const equipamento = String(req.body?.equipamento || '').trim();
  const defeito = String(req.body?.defeito || '').trim();
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : 'Recebido';
  const budgetStatus = allowedBudgetStatuses.includes(req.body?.orcamento_status) ? req.body.orcamento_status : 'pendente';
  if (!cliente || !equipamento || !defeito) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cliente, equipamento e defeito são obrigatórios.' } });

  const customer = await resolveCustomerId(req.body);
  const technician = await resolveTechnicianId(req.body);
  if (!customer) return res.status(400).json({ success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente não encontrado.' } });
  if (req.body.tecnico || req.body.tecnico_id) {
    if (!technician) return res.status(400).json({ success: false, error: { code: 'TECHNICIAN_NOT_FOUND', message: 'Técnico não encontrado.' } });
  }
  const selectedServices = await resolveServices(req.body?.service_ids);
  const selectedParts = await resolveParts(req.body?.part_items);
  const hardware = normalizeHardware(req.body);
  if (Array.isArray(req.body?.service_ids) && selectedServices.length !== req.body.service_ids.length) return res.status(400).json({ success: false, error: { code: 'SERVICE_NOT_FOUND', message: 'Um ou mais serviços selecionados não foram encontrados.' } });
  const totals = calculateBudgetTotals(status, budgetStatus, selectedServices, selectedParts);

  const transaction = await getTransaction();
  try {
    await transaction.query("UPDATE sequence_counters SET counter_value = counter_value + 1 WHERE counter_type = 'protocolo_os'");
    const counter = await transaction.query("SELECT counter_value FROM sequence_counters WHERE counter_type = 'protocolo_os'");
    const protocol = `OS-${String(counter[0].counter_value).padStart(5, '0')}`;
    const id = randomUUID();
    await transaction.query(
      `INSERT INTO service_orders (id, protocolo_os, cliente_id, tecnico_id, atendente_id, status, orcamento_status, equipamento_modelo, equipamento_tipo, hwid_equipamento, serial_bios, uuid_sistema, mac_rede, serial_disco, especificacoes_json, defeito_relatado, laudo_tecnico, servicos_realizados, garantia_servicos_dias, garantia_pecas_dias, valor_servico, taxa_analise, desconto_taxa_analise, valor_pecas, valor_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, protocol, customer.id, technician?.id || null, req.user.id, status, budgetStatus, equipamento, req.body?.equipamento_tipo || 'Não informado', hardware.hwid_equipamento, hardware.serial_bios, hardware.uuid_sistema, hardware.mac_rede, hardware.serial_disco, JSON.stringify(hardware.especificacoes_json), defeito, String(req.body?.laudo_tecnico || '').trim() || null, String(req.body?.servicos_realizados || '').trim() || null, 30, 90, totals.valorServicos, totals.taxaAnalise, totals.descontoAnalise, totals.valorPecas, totals.valorTotal],
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
  const existing = await queryOne('SELECT id, tecnico_id, status, orcamento_status FROM service_orders WHERE id = ?', [req.params.id]);
  const cliente = String(req.body?.cliente || '').trim();
  const equipamento = String(req.body?.equipamento || '').trim();
  const defeito = String(req.body?.defeito || '').trim();
  const observacao = String(req.body?.observacao || '').trim();
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, existing)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  if (!cliente || !equipamento || !defeito) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Cliente, equipamento e defeito são obrigatórios.' } });
  const customer = await resolveCustomerId(req.body);
  const technician = await resolveTechnicianId(req.body);
  if (!customer || ((req.body.tecnico || req.body.tecnico_id) && !technician)) return res.status(400).json({ success: false, error: { code: 'REFERENCE_NOT_FOUND', message: 'Cliente ou técnico não encontrado.' } });
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : 'Recebido';
  const budgetStatus = allowedBudgetStatuses.includes(req.body?.orcamento_status) ? req.body.orcamento_status : existing.orcamento_status || 'pendente';
  const selectedServices = await resolveServices(req.body?.service_ids);
  const selectedParts = await resolveParts(req.body?.part_items);
  const hardware = normalizeHardware(req.body);
  const totals = calculateBudgetTotals(status, budgetStatus, selectedServices, selectedParts);
  const transaction = await getTransaction();
  try {
    await transaction.query('UPDATE service_orders SET cliente_id = ?, tecnico_id = ?, status = ?, orcamento_status = ?, equipamento_modelo = ?, equipamento_tipo = ?, hwid_equipamento = ?, serial_bios = ?, uuid_sistema = ?, mac_rede = ?, serial_disco = ?, especificacoes_json = ?, defeito_relatado = ?, laudo_tecnico = ?, servicos_realizados = ?, valor_servico = ?, taxa_analise = ?, desconto_taxa_analise = ?, valor_pecas = ?, valor_total = ? WHERE id = ?', [customer.id, technician?.id || null, status, budgetStatus, equipamento, req.body?.equipamento_tipo || 'Não informado', hardware.hwid_equipamento, hardware.serial_bios, hardware.uuid_sistema, hardware.mac_rede, hardware.serial_disco, JSON.stringify(hardware.especificacoes_json), defeito, String(req.body?.laudo_tecnico || '').trim() || null, String(req.body?.servicos_realizados || '').trim() || null, totals.valorServicos, totals.taxaAnalise, totals.descontoAnalise, totals.valorPecas, totals.valorTotal, req.params.id]);
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
  const whatsappNotification = await notifyStatusChange(order, existing.status, observacao);
  return res.json({ success: true, data: order, notifications: { whatsapp: whatsappNotification }, message: 'Ordem atualizada com sucesso.' });
});

router.get('/:id/history', async (req, res) => {
  const history = await query(
    'SELECT id, status, usuario_id, usuario_nome, observacao, created_at FROM os_status_histories WHERE os_id = ? ORDER BY created_at DESC',
    [req.params.id],
  );
  return res.json({ success: true, data: history, message: 'Histórico carregado com sucesso.' });
});

router.post('/:id/hardware-validation', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const order = await queryOne('SELECT id, cliente_id FROM service_orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  const hardware = normalizeHardware(req.body);
  if (!hardware.hwid_equipamento) return res.status(400).json({ success: false, error: { code: 'HWID_REQUIRED', message: 'O JSON precisa conter ID_Equipamento.' } });
  const reference = await findHardwareReference(order.cliente_id, order.id);
  const validation = compareHardware(reference, hardware);
  await query(
    `UPDATE service_orders SET hwid_equipamento = ?, serial_bios = ?, uuid_sistema = ?, mac_rede = ?, serial_disco = ?, especificacoes_json = ?, hardware_validacao_status = ?, hardware_divergencias_json = ?, hardware_validado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    [hardware.hwid_equipamento, hardware.serial_bios, hardware.uuid_sistema, hardware.mac_rede, hardware.serial_disco, JSON.stringify(hardware.especificacoes_json), validation.status, JSON.stringify(validation.divergencias), order.id],
  );
  const updated = await queryOne(`${orderSelect} WHERE so.id = ?`, [order.id]);
  return res.json({
    success: true,
    data: { order: updated, validation: { ...validation, reference_hwid: reference?.hwid_equipamento || null } },
    message: validation.status === 'autentico' ? 'EQUIPAMENTO AUTÊNTICO - GARANTIA VÁLIDA.' : validation.status === 'divergente' ? 'ALERTA DE DIVERGÊNCIA - POSSÍVEL TROCA DE COMPONENTE.' : 'Hardware registrado sem histórico para comparação.',
  });
});

router.patch('/:id/status', requireRoles('admin', 'gerente', 'atendente', 'tecnico'), async (req, res) => {
  const order = await queryOne('SELECT so.id, so.protocolo_os AS protocolo, so.tecnico_id, so.status, so.orcamento_status, so.estoque_baixado_em, c.nome AS cliente, c.telefone, c.whatsapp FROM service_orders so JOIN customers c ON c.id = so.cliente_id WHERE so.id = ?', [req.params.id]);
  const status = String(req.body?.status || '').trim();
  const observacao = String(req.body?.observacao || '').trim();
  const laudoTecnico = req.body?.laudo_tecnico === undefined ? null : String(req.body.laudo_tecnico || '').trim();
  const servicosRealizados = req.body?.servicos_realizados === undefined ? null : String(req.body.servicos_realizados || '').trim();
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, order)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  if (!allowedStatuses.includes(status) || !observacao) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status válido e observação são obrigatórios.' } });
  try { assertStatusTransition(order.status, status); } catch (error) { return res.status(error.statusCode || 409).json({ success: false, error: { code: error.code || 'INVALID_STATUS_TRANSITION', message: error.message } }); }
  const requestedBudgetStatus = status === 'Aprovado' || ['Em Execução', 'Concluído', 'Finalizado', 'Entregue'].includes(status) ? 'aprovado' : status === 'Desistência do Cliente' ? 'recusado' : order.orcamento_status || 'pendente';
  const totals = calculateBudgetTotals(status, requestedBudgetStatus, [], []);
  const assignedTechnicianId = req.user.role === 'tecnico' && !order.tecnico_id ? req.user.id : order.tecnico_id;
  const transaction = await getTransaction();
  try {
    if (requestedBudgetStatus === 'aprovado' && !order.estoque_baixado_em) {
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
    await transaction.query('UPDATE service_orders SET tecnico_id = ?, status = ?, orcamento_status = ?, laudo_tecnico = COALESCE(?, laudo_tecnico), servicos_realizados = COALESCE(?, servicos_realizados), desconto_taxa_analise = ?, valor_total = CASE WHEN ? = \'recusado\' THEN taxa_analise WHEN ? = \'aprovado\' THEN valor_servico + valor_pecas ELSE valor_servico + valor_pecas + taxa_analise END, estoque_baixado_em = CASE WHEN ? = \'aprovado\' AND estoque_baixado_em IS NULL THEN CURRENT_TIMESTAMP ELSE estoque_baixado_em END WHERE id = ?', [assignedTechnicianId, status, requestedBudgetStatus, laudoTecnico, servicosRealizados, totals.descontoAnalise, requestedBudgetStatus, requestedBudgetStatus, requestedBudgetStatus, req.params.id]);
    await transaction.query('INSERT INTO os_status_histories (id, os_id, status, usuario_id, usuario_nome, observacao) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), req.params.id, status, req.user.id, req.user.full_name, observacao]);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; } finally { await transaction.close(); }
  const updated = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  const whatsappNotification = await notifyStatusChange(updated, order.status, observacao);
  return res.json({ success: true, data: updated, notifications: { whatsapp: whatsappNotification }, message: 'Progresso da OS atualizado com sucesso.' });
});

function buildContractContent(order) {
  const total = Number(order.valor_total || 0).toFixed(2);
  return [
    `CONTRATO DE PRESTAÇÃO DE SERVIÇOS - ${order.protocolo}`,
    `Cliente: ${order.cliente}`,
    `Equipamento: ${order.equipamento || 'Não informado'}`,
    `Defeito relatado: ${order.defeito || 'Não informado'}`,
    `Valor contratado: R$ ${total}`,
    `Garantia de mão de obra: ${order.garantia_servicos_dias || 30} dias.`,
    `Garantia de peças e componentes (RMA): ${order.garantia_pecas_dias || 90} dias.`,
    `A taxa de análise de R$ ${Number(order.taxa_analise || 120).toFixed(2)} é obrigatória caso o orçamento não seja autorizado pelo cliente.`,
    'A autorização do orçamento implica ciência das condições acima e dos serviços/peças discriminados nesta OS.',
  ].join('\n');
}

router.get('/:id/contract', async (req, res) => {
  const order = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  let contract = await queryOne('SELECT id, os_id, tipo, conteudo, garantia_servicos_dias, garantia_pecas_dias, created_by_name, created_at, updated_at FROM os_contracts WHERE os_id = ?', [req.params.id]);
  if (!contract) {
    const id = randomUUID();
    const content = buildContractContent(order);
    await query('INSERT INTO os_contracts (id, os_id, tipo, conteudo, garantia_servicos_dias, garantia_pecas_dias, created_by, created_by_name) VALUES (?, ?, \'contrato\', ?, ?, ?, ?, ?)', [id, req.params.id, content, order.garantia_servicos_dias || 30, order.garantia_pecas_dias || 90, req.user.id, req.user.full_name]);
    contract = await queryOne('SELECT id, os_id, tipo, conteudo, garantia_servicos_dias, garantia_pecas_dias, created_by_name, created_at, updated_at FROM os_contracts WHERE id = ?', [id]);
  }
  return res.json({ success: true, data: { order, contract }, message: 'Contrato carregado com sucesso.' });
});

router.delete('/:id', requireRoles('admin', 'tecnico'), async (req, res) => {
  const order = await queryOne(`${orderSelect} WHERE so.id = ?`, [req.params.id]);
  if (!order) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ordem não encontrada.' } });
  if (!canAlterOrder(req.user, order)) return res.status(403).json({ success: false, error: { code: 'ORDER_FORBIDDEN', message: 'Somente o técnico responsável ou um administrador pode alterar esta OS.' } });
  await query('DELETE FROM service_orders WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: order, message: 'Ordem removida com sucesso.' });
});

module.exports = router;
