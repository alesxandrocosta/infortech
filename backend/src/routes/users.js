const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { query, queryOne } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
const allowedRoles = ['admin', 'gerente', 'administrativo', 'atendente', 'tecnico'];

function normalizeRoles(body) {
  const roles = Array.isArray(body?.roles) ? body.roles : [body?.role];
  return [...new Set(roles.filter((role) => allowedRoles.includes(role)))];
}

router.use(requireAuth);
router.get('/', requireRoles('admin', 'gerente'), async (_req, res) => {
  const users = await query('SELECT id, full_name, telefone, email, username, marca, role, roles, created_at, updated_at FROM users ORDER BY full_name');
  users.forEach((user) => { if (typeof user.roles === 'string') { try { user.roles = JSON.parse(user.roles); } catch { user.roles = [user.role]; } } });
  return res.json({ success: true, data: users, message: 'Usuários carregados com sucesso.' });
});

router.post('/', requireRoles('admin', 'gerente'), async (req, res) => {
  const fullName = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const telefone = String(req.body?.telefone || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const roles = normalizeRoles(req.body);
  const role = roles[0];
  const marca = String(req.body?.marca || '').trim();

  if (!fullName || !email || !username || !password || !roles.length || !marca) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Nome, e-mail, senha e perfil válido são obrigatórios.' },
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'gerente') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Perfil não permitido para este usuário.' } });
  }

  if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Este e-mail já está cadastrado.' } });
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await query('INSERT INTO users (id, full_name, telefone, email, username, marca, password_hash, role, roles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, fullName, telefone, email, username, marca, passwordHash, role, JSON.stringify(roles)]);
  const user = await queryOne('SELECT id, full_name, telefone, email, username, marca, role, roles, created_at, updated_at FROM users WHERE id = ?', [id]);
  return res.status(201).json({ success: true, data: user, message: 'Usuário criado com sucesso.' });
});

router.put('/:id', requireRoles('admin', 'gerente'), async (req, res) => {
  const user = await queryOne('SELECT id, full_name, email, role FROM users WHERE id = ?', [req.params.id]);
  const fullName = String(req.body?.full_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const telefone = String(req.body?.telefone || '').trim();
  const username = String(req.body?.username || '').trim();
  const roles = normalizeRoles(req.body);
  const role = roles[0];
  const marca = String(req.body?.marca || '').trim();
  const password = String(req.body?.password || '').trim();

  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
  }

  if (!fullName || !email || !username || !roles.length || !marca || (password && password.length < 6)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nome, e-mail e perfil válido são obrigatórios; senha deve ter 6 caracteres.' } });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'gerente') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Perfil não permitido para este usuário.' } });
  }

  if (await queryOne('SELECT id FROM users WHERE email = ? AND id <> ?', [email, user.id])) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: 'Este e-mail já está cadastrado.' } });
  }

  const fields = ['full_name = ?', 'telefone = ?', 'email = ?', 'username = ?', 'marca = ?', 'role = ?', 'roles = ?'];
  const values = [fullName, telefone, email, username, marca, role, JSON.stringify(roles)];
  if (password) { fields.push('password_hash = ?'); values.push(await bcrypt.hash(password, 12)); }
  values.push(user.id);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  const updatedUser = await queryOne('SELECT id, full_name, email, telefone, username, marca, role, roles, created_at, updated_at FROM users WHERE id = ?', [user.id]);
  return res.json({ success: true, data: updatedUser, message: 'Usuário atualizado com sucesso.' });
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const user = await queryOne('SELECT id, full_name, email, telefone, role FROM users WHERE id = ?', [req.params.id]);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'O usuário atual não pode ser excluído.' } });
  }

  await query('DELETE FROM users WHERE id = ?', [user.id]);
  return res.json({ success: true, data: user, message: 'Usuário removido com sucesso.' });
});

module.exports = router;
