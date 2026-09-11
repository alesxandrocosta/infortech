const express = require('express');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

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
