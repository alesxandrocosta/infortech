const express = require('express');
const bcrypt = require('bcryptjs');
const { queryOne } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { randomBytes } = require('crypto');
const router = express.Router();

const oauthStates = new Map();
const providerConfig = {
  google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, authorization: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', userinfo: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid email profile' },
  microsoft: { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET, authorization: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize`, token: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`, userinfo: 'https://graph.microsoft.com/oidc/userinfo', scope: 'openid profile email User.Read' },
  apple: { clientId: process.env.APPLE_CLIENT_ID, clientSecret: process.env.APPLE_CLIENT_SECRET, authorization: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', scope: 'name email' },
};

function oauthRedirect(provider) { return `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:5000'}/api/auth/oauth/${provider}/callback`; }

function decodeJwtPayload(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}

router.get('/oauth/:provider', (req, res) => {
  const provider = providerConfig[req.params.provider];
  if (!provider || !provider.clientId || !provider.clientSecret) return res.status(503).json({ success: false, error: { code: 'OAUTH_NOT_CONFIGURED', message: 'Este provedor ainda não foi configurado no servidor.' } });
  const state = randomBytes(24).toString('hex');
  oauthStates.set(state, { provider: req.params.provider, expiresAt: Date.now() + 10 * 60 * 1000 });
  const params = new URLSearchParams({ client_id: provider.clientId, redirect_uri: oauthRedirect(req.params.provider), response_type: 'code', scope: provider.scope, state });
  if (req.params.provider === 'google') params.set('access_type', 'offline');
  if (req.params.provider === 'apple') params.set('response_mode', 'query');
  return res.redirect(`${provider.authorization}?${params.toString()}`);
});

router.get('/oauth/:provider/callback', async (req, res) => {
  try {
    const savedState = oauthStates.get(req.query.state);
    oauthStates.delete(req.query.state);
    const provider = providerConfig[req.params.provider];
    if (!savedState || savedState.expiresAt < Date.now() || savedState.provider !== req.params.provider || !req.query.code) return res.status(400).send('Falha na validação do acesso social.');
    const tokenResponse = await fetch(provider.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: provider.clientId, client_secret: provider.clientSecret, redirect_uri: oauthRedirect(req.params.provider), grant_type: 'authorization_code' }) });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) return res.status(401).send('Não foi possível validar o acesso social.');
    let identity = provider.userinfo ? await (await fetch(provider.userinfo, { headers: { Authorization: `Bearer ${tokenPayload.access_token}` } })).json() : decodeJwtPayload(tokenPayload.id_token);
    const email = String(identity.email || identity.preferred_username || '').toLowerCase();
    const user = email ? await queryOne('SELECT id FROM users WHERE email = ?', [email]) : null;
    if (!user) return res.status(403).send('A conta social foi validada, mas o e-mail não está cadastrado no sistema.');
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/?oauth_token=${encodeURIComponent(`mock-token-${user.id}`)}`);
  } catch (error) { console.error('OAuth error:', error.message); return res.status(500).send('Erro ao concluir autenticação social.'); }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await queryOne('SELECT id, full_name, email, telefone, marca, role, password_hash FROM users WHERE email = ?', [email]);
    const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !validPassword) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas.' },
      });
    }

    return res.json({
      success: true,
      data: {
        token: `mock-token-${user.id}`,
        user: { id: user.id, full_name: user.full_name, email: user.email, telefone: user.telefone, marca: user.marca, role: user.role },
      },
      message: 'Login realizado com sucesso.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: { code: 'LOGIN_DATABASE_ERROR', message: 'Não foi possível realizar o login.' } });
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      telefone: user.telefone,
      marca: user.marca,
      username: user.username,
      role: user.role,
      roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles,
    },
  });
});

module.exports = router;
