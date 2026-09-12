require('express-async-errors');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const catalogRoutes = require('./routes/catalog');
const userRoutes = require('./routes/users');
const physicalInventoryRoutes = require('./routes/physicalInventories');
const customerPortalRoutes = require('./routes/customerPortal');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const { requireAuth, requireRoles } = require('./middleware/auth');
const { getWhatsAppStatus, initializeWhatsApp } = require('./services/whatsapp');

const app = express();
const port = process.env.PORT || 5000;
const configuredCorsOrigins = (process.env.CORS_ORIGIN || 'http://0.0.0.0:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyCorsOrigin = process.env.CORS_ALLOW_ALL === 'true';

function isPrivateNetworkOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (
      /^(localhost|127\.0\.0\.1)$/.test(url.hostname)
      || /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname)
      || /^192\.168\.(?:\d{1,3}\.)\d{1,3}$/.test(url.hostname)
      || /^172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

const DEFAULT_CHECKLIST = [
  { id: 1, item: 'Carcaça', estado: 'OK' },
  { id: 2, item: 'Tela', estado: 'OK' },
  { id: 3, item: 'Bateria', estado: 'Avariado' },
  { id: 4, item: 'Botões laterais', estado: 'OK' },
  { id: 5, item: 'Conector de carga', estado: 'Ausente' },
  { id: 6, item: 'Câmera traseira', estado: 'OK' },
  { id: 7, item: 'Microfone', estado: 'Avariado' },
  { id: 8, item: 'Alto-falante', estado: 'OK' },
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowAnyCorsOrigin || configuredCorsOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/customer-portal', customerPortalRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/physical-inventories', physicalInventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'TechFlow ERP',
    status: 'online',
    whatsapp: getWhatsAppStatus(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', catalogRoutes);

app.get('/api/checklist', requireAuth, (_req, res) => {
  res.json({
    success: true,
    data: DEFAULT_CHECKLIST,
    message: 'Checklist padrão carregado.',
  });
});

app.post('/api/checklist', requireAuth, requireRoles('admin', 'gerente', 'tecnico'), (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : DEFAULT_CHECKLIST;

  res.json({
    success: true,
    data: items,
    message: 'Checklist salvo com sucesso.',
  });
});

app.use((error, _req, res, _next) => {
  console.error('API error:', error.message);
  if (res.headersSent) return;
  return res.status(error.statusCode || 500).json({
    success: false,
    error: { code: error.code || 'INTERNAL_ERROR', message: 'Erro interno ao processar a solicitação.' },
  });
});

initializeWhatsApp();

app.listen(port, '0.0.0.0', () => {
  console.log(`TechFlow ERP backend running on http://0.0.0.0:${port}`);
});
