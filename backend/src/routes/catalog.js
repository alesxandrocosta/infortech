const express = require('express');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { query, queryOne } = require('../config/database');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();
const execFileAsync = promisify(execFile);
const serviceFields = 'id, nome, descricao, notas, categoria, modalidade, preco_sugerido, tempo_estimado_horas, ativo, created_at, updated_at';
const partFields = 'id, codigo_sku, nome, categoria, condicao, equipamento_tipo, technical_specs, quantidade_estoque, quantidade_minima, preco_custo, preco_venda, ativo, created_at, updated_at';
const serviceCategories = ['Troca', 'Reparo', 'Software', 'Diagnóstico', 'Limpeza', 'Manutenção', 'Formatação', 'Backup', 'Preventiva', 'Redes', 'Suporte', 'Outro'];
const partCategories = ['Tela', 'Placa-Mãe', 'Processador', 'Memória RAM', 'Bateria', 'Conector', 'Fonte', 'Adaptador', 'Insumo', 'Acessório', 'Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad', 'Outro'];
const equipmentTypes = ['Desktop', 'Notebook', 'Tablet', 'Smartphone', 'Console', 'Universal', 'Outro'];
router.use(requireAuth);

function normalizeEquipmentType(value) {
  const normalized = String(value || '').trim();
  if (normalized === 'Computador') return 'Desktop';
  return equipmentTypes.includes(normalized) ? normalized : 'Outro';
}

router.get('/inventory', async (req, res) => {
  const parts = await query(`SELECT ${partFields} FROM product_parts ORDER BY created_at DESC`);
  for (const part of parts) {
    part.movements = await query('SELECT origem, responsavel_nome, quantidade, valor, status, occurred_at FROM inventory_movements WHERE peca_id = ? ORDER BY occurred_at DESC', [part.id]);
  }
  return res.json({ success: true, data: parts, message: 'Estoque carregado com sucesso.' });
});

function processorGeneration(name) {
  const intel = String(name || '').match(/(?:i[3579]|Core\(TM\) i[3579]).*?[- ](\d{4,5})/i);
  if (intel) return `${intel[1].charAt(0)}ª geração`;
  const ryzen = String(name || '').match(/Ryzen\s+[3579]\s+(\d)\d{3}/i);
  return ryzen ? `${ryzen[1]}ª geração Ryzen` : 'Não identificada';
}

router.get('/inventory/hardware/local', requireRoles('admin', 'gerente', 'administrativo', 'atendente'), async (_req, res) => {
  if (process.platform !== 'win32') return res.status(501).json({ success: false, error: { code: 'WINDOWS_REQUIRED', message: 'A leitura automática está disponível para o Windows.' } });
  const script = `
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, Manufacturer, NumberOfCores, MaxClockSpeed
    $computer = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, TotalPhysicalMemory
    $os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture
    $bios = Get-CimInstance Win32_BIOS | Select-Object SerialNumber
    $uuid = (Get-CimInstance Win32_ComputerSystemProduct | Select-Object -First 1 UUID).UUID
    $ram = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [PSCustomObject]@{ CapacityGB = [math]::Round($_.Capacity / 1GB, 2); TypeCode = $_.SMBIOSMemoryType; SpeedMHz = $_.Speed; Manufacturer = $_.Manufacturer; PartNumber = $_.PartNumber } })
    $disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object { [PSCustomObject]@{ Model = $_.Model; SerialNumber = $_.SerialNumber; SizeGB = [math]::Round($_.Size / 1GB, 2); Interface = $_.InterfaceType } })
    [PSCustomObject]@{ Cpu = $cpu; Computer = $computer; OperatingSystem = $os; Bios = $bios; Uuid = $uuid; Memory = $ram; Disks = $disks } | ConvertTo-Json -Depth 5 -Compress
  `;
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
    const raw = JSON.parse(stdout.trim());
    const memoryTypes = { 20: 'DDR', 21: 'DDR2', 22: 'DDR2', 24: 'DDR3', 26: 'DDR4', 34: 'DDR5' };
    const memory = Array.isArray(raw.Memory) ? raw.Memory : raw.Memory ? [raw.Memory] : [];
    const disks = Array.isArray(raw.Disks) ? raw.Disks : raw.Disks ? [raw.Disks] : [];
    const processor = raw.Cpu || {};
    const totalMemory = Number(raw.Computer?.TotalPhysicalMemory || 0) / (1024 ** 3);
    const result = {
      ID_Equipamento: String(raw.Uuid || raw.Bios?.SerialNumber || '').replace(/-/g, '').slice(0, 16).toUpperCase(),
      Serial_BIOS: raw.Bios?.SerialNumber || '',
      UUID_Sistema: raw.Uuid || '',
      Processador: processor.Name || '',
      Geracao_Processador: processorGeneration(processor.Name),
      Memoria_RAM: `${totalMemory ? totalMemory.toFixed(2) : ''} GB`,
      Tipo_Memoria: [...new Set(memory.map((item) => memoryTypes[item.TypeCode] || `Código ${item.TypeCode || 'não informado'}`))].join(', '),
      Modulos_Memoria: memory,
      Sistema_Operacional: raw.OperatingSystem?.Caption || '',
      Versao_SO: raw.OperatingSystem?.Version || '',
      Arquitetura_SO: raw.OperatingSystem?.OSArchitecture || '',
      Fabricante: raw.Computer?.Manufacturer || '',
      Modelo: raw.Computer?.Model || '',
      Armazenamento: disks.map((disk) => `${disk.Model || 'Disco'} ${disk.SizeGB || ''} GB`).join(' | '),
      Discos: disks,
      Data_Cadastro: new Date().toISOString(),
    };
    return res.json({ success: true, data: result, message: 'Configuração local lida com sucesso.' });
  } catch (error) {
    console.error('Local hardware read error:', error.message);
    return res.status(502).json({ success: false, error: { code: 'HARDWARE_READ_ERROR', message: 'Não foi possível ler a configuração deste computador.' } });
  }
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
  await query('INSERT INTO product_parts (id, codigo_sku, nome, categoria, condicao, equipamento_tipo, technical_specs, quantidade_estoque, quantidade_minima, preco_venda, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)', [id, codigo, nome, categoria, req.body?.condicao || 'Nova', normalizeEquipmentType(req.body?.equipamento_tipo), technicalSpecs, estoque, minimo, preco]);
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
  await query('UPDATE product_parts SET codigo_sku = ?, nome = ?, categoria = ?, condicao = ?, equipamento_tipo = ?, technical_specs = ?, quantidade_estoque = ?, quantidade_minima = ?, preco_venda = ? WHERE id = ?', [codigo, nome, categoria, req.body?.condicao || 'Nova', normalizeEquipmentType(req.body?.equipamento_tipo), technicalSpecs, estoque, minimo, preco, req.params.id]);
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
