const express = require('express');
const { randomUUID } = require('crypto');
const { query, queryOne } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toApiInventory(row) {
  return {
    ...row,
    status: row.status === 'concluido' ? 'Finalizado' : 'Em andamento',
  };
}

router.get('/', async (_req, res) => {
  const rows = await query(`SELECT id, nome, observacoes, status, data_inventario, responsavel_id, responsavel_nome, created_at, updated_at
    FROM physical_inventories ORDER BY data_inventario DESC`);
  return res.json({ success: true, data: rows.map(toApiInventory), message: 'Inventários carregados com sucesso.' });
});

router.post('/', requireRoles('admin', 'gerente', 'administrativo'), async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const observacoes = String(req.body?.observacoes || '').trim();
  if (!nome || !observacoes) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome e observações do inventário são obrigatórios.' } });
  const id = randomUUID();
  await query('INSERT INTO physical_inventories (id, nome, observacoes, responsavel_id, responsavel_nome, status) VALUES (?, ?, ?, ?, ?, \'aberto\')', [id, nome, observacoes, req.user.id, req.user.full_name]);
  const inventory = await queryOne('SELECT id, nome, observacoes, status, data_inventario, responsavel_id, responsavel_nome, created_at, updated_at FROM physical_inventories WHERE id = ?', [id]);
  return res.status(201).json({ success: true, data: toApiInventory(inventory), message: 'Inventário criado com sucesso.' });
});

router.put('/:id', requireRoles('admin', 'gerente', 'administrativo'), async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const observacoes = String(req.body?.observacoes || '').trim();
  const status = req.body?.status === 'Finalizado' ? 'concluido' : 'aberto';
  const existing = await queryOne('SELECT id FROM physical_inventories WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventário não encontrado.' } });
  if (!nome || !observacoes) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome e observações do inventário são obrigatórios.' } });
  await query('UPDATE physical_inventories SET nome = ?, observacoes = ?, status = ? WHERE id = ?', [nome, observacoes, status, req.params.id]);
  const inventory = await queryOne('SELECT id, nome, observacoes, status, data_inventario, responsavel_id, responsavel_nome, created_at, updated_at FROM physical_inventories WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: toApiInventory(inventory), message: 'Inventário atualizado com sucesso.' });
});

router.delete('/:id', requireRoles('admin', 'gerente'), async (req, res) => {
  const inventory = await queryOne('SELECT id, nome, observacoes, status, data_inventario, responsavel_id, responsavel_nome, created_at, updated_at FROM physical_inventories WHERE id = ?', [req.params.id]);
  if (!inventory) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventário não encontrado.' } });
  await query('DELETE FROM physical_inventories WHERE id = ?', [req.params.id]);
  return res.json({ success: true, data: toApiInventory(inventory), message: 'Inventário removido com sucesso.' });
});

module.exports = router;
