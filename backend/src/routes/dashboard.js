const express = require('express');
const https = require('https');
const os = require('os');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 4000 }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
  });
}

router.get('/network', async (_req, res) => {
  const rawInterfaces = Object.values(os.networkInterfaces() || {});
  const privateIps = rawInterfaces
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .filter(Boolean);

  const localIp = privateIps.find((ip) => ip.startsWith('10.'))
    || privateIps.find((ip) => ip.startsWith('192.168.'))
    || privateIps.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip))
    || privateIps[0]
    || '127.0.0.1';

  let publicIp = null;
  let externalError = null;

  try {
    const response = await getJson('https://api4.ipify.org?format=json');
    publicIp = response?.ip || null;
  } catch (error) {
    externalError = error.message;
  }

  const configuredPublicUrl = process.env.VITE_PUBLIC_URL || null;
  const frontendPort = Number(process.env.VITE_PUBLIC_PORT || 5174 || process.env.PORT || 5174);
  const serverPort = Number(process.env.PORT || 5000);

  return res.json({
    success: true,
    data: {
      host: os.hostname(),
      localIp,
      publicIp,
      externalError,
      isPrivateNetwork: /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(localIp),
      configuredPublicUrl,
      accessUrl: configuredPublicUrl || (publicIp ? `http://${publicIp}:${frontendPort}` : `http://${localIp}:${frontendPort}`),
      portForwarding: {
        frontend: frontendPort,
        api: serverPort,
      },
    },
  });
});

router.get('/indicators', async (_req, res) => {
  const rows = await query(`
    WITH RECURSIVE days AS (
      SELECT CURRENT_DATE() - INTERVAL 6 DAY AS day
      UNION ALL
      SELECT day + INTERVAL 1 DAY FROM days WHERE day < CURRENT_DATE()
    )
    SELECT
      days.day,
      COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.status = 'paid' AND DATE(s.created_at) = days.day), 0) AS revenue,
      COALESCE((SELECT COUNT(*) FROM sales s WHERE s.status = 'paid' AND DATE(s.created_at) = days.day), 0) AS sales_count,
      COALESCE((SELECT COUNT(*) FROM service_orders o WHERE DATE(o.created_at) = days.day AND o.status NOT IN ('Concluído', 'Entregue', 'Desistência do Cliente')), 0) AS open_orders,
      COALESCE((SELECT COUNT(*) FROM service_orders o WHERE DATE(o.created_at) = days.day AND o.status IN ('Concluído', 'Entregue')), 0) AS completed_orders,
      (SELECT COUNT(*) FROM product_parts p WHERE p.ativo = TRUE AND p.quantidade_estoque <= p.quantidade_minima) AS low_stock
    FROM days
    ORDER BY days.day
  `);
  return res.json({ success: true, data: rows });
});

module.exports = router;
