const { queryOne } = require('../config/database');

const rolePermissions = {
  admin: ['admin', 'gerente', 'administrativo', 'atendente', 'tecnico'],
  gerente: ['admin', 'gerente', 'administrativo', 'atendente', 'tecnico'],
  administrativo: ['administrativo'],
  atendente: ['atendente'],
  tecnico: ['tecnico'],
};

async function getUserFromRequest(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const userId = token.startsWith('mock-token-') ? token.slice('mock-token-'.length) : '';
  if (!userId) return null;
  const legacyEmails = {
    'user-1': 'alesxandrocosta@gmail.com',
    'user-2': 'pedro@techflow.local',
    'user-3': 'amanda@techflow.local',
    'user-4': 'henrique@techflow.local',
  };
  if (legacyEmails[userId]) {
    return queryOne(
      'SELECT id, full_name, email, telefone, username, marca, role, roles, password_hash FROM users WHERE email = ?',
      [legacyEmails[userId]],
    );
  }
  return queryOne('SELECT id, full_name, email, telefone, username, marca, role, roles, password_hash FROM users WHERE id = ?', [userId]);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Autenticação obrigatória.' },
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_DATABASE_ERROR', message: 'Não foi possível validar a autenticação.' },
    });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Usuário sem permissão para esta operação.' },
      });
    }

    return next();
  };
}

function canManageRole(requestingRole, targetRole) {
  return rolePermissions[requestingRole]?.includes(targetRole) || false;
}

module.exports = { requireAuth, requireRoles, canManageRole };
