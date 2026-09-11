#!/usr/bin/env node
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');
require('dotenv').config();

const customers = [
  ['demo-customer-01', 'Lucas Mendes', 'PF', '11122233344', '31988880001', 'lucas.mendes@example.com', 'Adimplente'],
  ['demo-customer-02', 'Mariana Alves', 'PF', '22233344455', '31988880002', 'mariana.alves@example.com', 'Adimplente'],
  ['demo-customer-03', 'Comercial Horizonte LTDA', 'PJ', '12345678000190', '3133334400', 'contato@horizonte.example.com', 'Adimplente'],
  ['demo-customer-04', 'Studio Criativo BH', 'PJ', '98765432000110', '3133335500', 'financeiro@studiocriativo.example.com', 'Inadimplente'],
  ['demo-customer-05', 'Rafael Souza', 'PF', '33344455566', '31988880005', 'rafael.souza@example.com', 'Adimplente'],
];

const services = [
  ['demo-service-01', 'Diagnóstico de hardware', 'Testes de memória, armazenamento, temperaturas e alimentação.', 'Diagnóstico', 90, 1],
  ['demo-service-02', 'Limpeza interna e manutenção preventiva', 'Limpeza técnica, troca de pasta térmica e revisão interna.', 'Manutenção', 160, 2],
  ['demo-service-03', 'Instalação e configuração do sistema', 'Instalação, drivers, atualizações e configuração inicial.', 'Software', 180, 2],
  ['demo-service-04', 'Troca de tela de notebook', 'Substituição de display e testes de imagem.', 'Troca', 240, 2.5],
  ['demo-service-05', 'Troca de bateria de smartphone', 'Substituição da bateria e teste de carga.', 'Troca', 150, 1.5],
  ['demo-service-06', 'Reparo de conector USB-C', 'Diagnóstico e reparo do conector de carga.', 'Reparo', 190, 3],
  ['demo-service-07', 'Recuperação de dados', 'Avaliação e tentativa de recuperação de arquivos.', 'Reparo', 350, 4],
  ['demo-service-08', 'Higienização de console', 'Limpeza interna e revisão do sistema de ventilação.', 'Limpeza', 180, 2],
];

const parts = [
  ['demo-part-01', 'TEL-NB-156-FHD', 'Tela notebook 15.6 Full HD', 'Tela', 'Nova', 'Notebook', 8, 2, 420, 699, { resolucao: '1920x1080', conector: '30 pinos' }],
  ['demo-part-02', 'TEL-NB-140-HD', 'Tela notebook 14 polegadas HD', 'Tela', 'Nova', 'Notebook', 5, 2, 330, 549, { resolucao: '1366x768', conector: '30 pinos' }],
  ['demo-part-03', 'BAT-DELL-5420', 'Bateria notebook Dell Latitude', 'Bateria', 'Nova', 'Notebook', 4, 2, 210, 389, { tensao: '11.4V', capacidade: '51Wh' }],
  ['demo-part-04', 'SSD-480-SATA', 'SSD 480GB SATA III', 'Acessório', 'Nova', 'Universal', 14, 4, 210, 329, { interface: 'SATA III' }],
  ['demo-part-05', 'SSD-1TB-NVME', 'SSD NVMe 1TB', 'Acessório', 'Nova', 'Universal', 7, 2, 350, 529, { interface: 'M.2 NVMe' }],
  ['demo-part-06', 'RAM-DDR4-8G', 'Memória RAM 8GB DDR4', 'Memória RAM', 'Nova', 'Notebook', 18, 6, 105, 169, { frequencia: '2666MHz' }],
  ['demo-part-07', 'RAM-DDR4-16G', 'Memória RAM 16GB DDR4', 'Memória RAM', 'Nova', 'Universal', 10, 4, 190, 299, { frequencia: '3200MHz' }],
  ['demo-part-08', 'FONTE-ATX-500', 'Fonte ATX 500W 80 Plus', 'Fonte', 'Nova', 'Desktop', 6, 2, 230, 369, { potencia: '500W', certificacao: '80 Plus' }],
  ['demo-part-09', 'FONTE-NB-65W', 'Fonte notebook universal 65W', 'Fonte', 'Nova', 'Notebook', 9, 3, 85, 139, { potencia: '65W' }],
  ['demo-part-10', 'BAT-IP-12', 'Bateria compatível smartphone', 'Bateria', 'Remanufaturada', 'Smartphone', 12, 4, 95, 169, { compatibilidade: 'Linha smartphone' }],
  ['demo-part-11', 'CON-USB-C-01', 'Conector USB-C universal', 'Conector', 'Nova', 'Universal', 30, 10, 8, 24, { tipo: 'USB-C' }],
  ['demo-part-12', 'CON-USB-MICRO', 'Conector Micro USB', 'Conector', 'Nova', 'Smartphone', 25, 8, 6, 19, { tipo: 'Micro USB' }],
  ['demo-part-13', 'CABO-HDMI-2M', 'Cabo HDMI 2 metros', 'Acessório', 'Nova', 'Universal', 20, 5, 18, 39, { versao: '2.0' }],
  ['demo-part-14', 'PASTA-TERMICA-5G', 'Pasta térmica 5g', 'Insumo', 'Nova', 'Universal', 35, 10, 9, 25, { condutividade: '5.0 W/mK' }],
  ['demo-part-15', 'KIT-PARAFUSOS-NB', 'Kit parafusos notebook', 'Insumo', 'Nova', 'Notebook', 16, 5, 12, 29, { itens: 'Parafusos variados' }],
  // Monitores
  ['demo-part-16', 'MON-LED-14IN', 'Monitor 14"', 'Monitor', 'Nova', 'Universal', 5, 2, 480, 899, { tamanho: '14 polegadas', tipo: 'LED' }],
  ['demo-part-17', 'MON-LED-15IN', 'Monitor 15"', 'Monitor', 'Nova', 'Universal', 4, 2, 520, 999, { tamanho: '15 polegadas', tipo: 'LED' }],
  ['demo-part-18', 'MON-LED-16IN', 'Monitor 16"', 'Monitor', 'Nova', 'Universal', 6, 2, 580, 1099, { tamanho: '16 polegadas', tipo: 'LED' }],
  ['demo-part-19', 'MON-LED-17IN', 'Monitor 17"', 'Monitor', 'Nova', 'Universal', 3, 1, 620, 1199, { tamanho: '17 polegadas', tipo: 'LED' }],
  ['demo-part-20', 'MON-LED-19IN', 'Monitor 19"', 'Monitor', 'Nova', 'Universal', 5, 2, 680, 1299, { tamanho: '19 polegadas', tipo: 'LED' }],
  ['demo-part-21', 'MON-LED-20IN', 'Monitor 20"', 'Monitor', 'Nova', 'Universal', 7, 2, 720, 1399, { tamanho: '20 polegadas', tipo: 'LED' }],
  ['demo-part-22', 'MON-LED-21IN', 'Monitor 21.5"', 'Monitor', 'Nova', 'Universal', 8, 3, 780, 1499, { tamanho: '21.5 polegadas', tipo: 'LED' }],
  ['demo-part-23', 'MON-LED-22IN', 'Monitor 22"', 'Monitor', 'Nova', 'Universal', 6, 2, 820, 1599, { tamanho: '22 polegadas', tipo: 'LED' }],
  ['demo-part-24', 'MON-LED-24IN', 'Monitor 24"', 'Monitor', 'Nova', 'Universal', 9, 3, 900, 1799, { tamanho: '24 polegadas', tipo: 'LED' }],
  ['demo-part-25', 'MON-LED-27IN', 'Monitor 27"', 'Monitor', 'Nova', 'Universal', 7, 2, 1100, 2199, { tamanho: '27 polegadas', tipo: 'LED' }],
  ['demo-part-26', 'MON-GMR-24IN-144HZ', 'Monitor Gamer 24" 144Hz', 'Monitor', 'Nova', 'Universal', 4, 1, 1200, 2399, { tamanho: '24 polegadas', taxa_atualizacao: '144Hz' }],
  ['demo-part-27', 'MON-GMR-27IN-165HZ', 'Monitor Gamer 27" 165Hz', 'Monitor', 'Nova', 'Universal', 3, 1, 1500, 2899, { tamanho: '27 polegadas', taxa_atualizacao: '165Hz' }],
  ['demo-part-28', 'MON-GMR-32IN-CURV', 'Monitor Gamer 32" Curvo', 'Monitor', 'Nova', 'Universal', 2, 1, 1800, 3499, { tamanho: '32 polegadas', curvatura: 'Sim' }],
  // Celulares e Periféricos Mobile
  ['demo-part-29', 'CEL-AND-64GB', 'Celular Android 64GB', 'Smartphone', 'Nova', 'Smartphone', 6, 2, 1200, 1899, { sistema: 'Android', armazenamento: '64GB' }],
  ['demo-part-30', 'CEL-AND-128GB', 'Celular Android 128GB', 'Smartphone', 'Nova', 'Smartphone', 5, 2, 1400, 2199, { sistema: 'Android', armazenamento: '128GB' }],
  ['demo-part-31', 'CEL-AND-256GB', 'Celular Android 256GB', 'Smartphone', 'Nova', 'Smartphone', 3, 1, 1600, 2499, { sistema: 'Android', armazenamento: '256GB' }],
  ['demo-part-32', 'CEL-IOS-128GB', 'Celular iOS/iPhone 128GB', 'Smartphone', 'Nova', 'Smartphone', 4, 2, 1800, 2799, { sistema: 'iOS', armazenamento: '128GB' }],
  ['demo-part-33', 'CEL-IOS-256GB', 'Celular iOS/iPhone 256GB', 'Smartphone', 'Nova', 'Smartphone', 2, 1, 2000, 3099, { sistema: 'iOS', armazenamento: '256GB' }],
  // Fones de Ouvido Comuns / Office
  ['demo-part-34', 'FON-EAR-P2', 'Fone de Ouvido Intra-auricular Conexão P2', 'Fone', 'Nova', 'Smartphone', 15, 5, 45, 119, { tipo: 'Intra-auricular', conector: 'P2' }],
  ['demo-part-35', 'FON-EAR-TYPEC', 'Fone de Ouvido Intra-auricular Conexão Type-C', 'Fone', 'Nova', 'Smartphone', 12, 4, 65, 149, { tipo: 'Intra-auricular', conector: 'Type-C' }],
  ['demo-part-36', 'FON-TWS-BT', 'Fone de Ouvido Sem Fio Bluetooth TWS', 'Fone', 'Nova', 'Smartphone', 10, 3, 120, 249, { tipo: 'TWS', conexao: 'Bluetooth' }],
  ['demo-part-37', 'FON-HDS-P2-MIC', 'Headset Office com Microfone P2', 'Fone', 'Nova', 'Universal', 8, 2, 85, 189, { tipo: 'Headset', microfone: 'Sim', conector: 'P2' }],
  ['demo-part-38', 'FON-HDS-USB-MIC', 'Headset Office com Microfone USB', 'Fone', 'Nova', 'Universal', 7, 2, 110, 229, { tipo: 'Headset', microfone: 'Sim', conector: 'USB' }],
  // Fones de Ouvido Gamer
  ['demo-part-39', 'FON-GMR-RGB-P2', 'Fone/Headset Gamer RGB Conexão P2', 'Fone', 'Nova', 'Universal', 6, 2, 180, 399, { tipo: 'Gamer', rgb: 'Sim', conector: 'P2' }],
  ['demo-part-40', 'FON-GMR-RGB-USB', 'Fone/Headset Gamer RGB Conexão USB', 'Fone', 'Nova', 'Universal', 5, 2, 220, 449, { tipo: 'Gamer', rgb: 'Sim', conector: 'USB' }],
  ['demo-part-41', 'FON-GMR-71-USB', 'Fone/Headset Gamer 7.1 Surround USB', 'Fone', 'Nova', 'Universal', 4, 1, 280, 549, { tipo: 'Gamer', canais: '7.1', conector: 'USB' }],
  ['demo-part-42', 'FON-GMR-WRL-BT', 'Fone/Headset Gamer Sem Fio Bluetooth/2.4GHz', 'Fone', 'Nova', 'Universal', 3, 1, 320, 599, { tipo: 'Gamer', conexao: 'Bluetooth/2.4GHz' }],
  // Mouses
  ['demo-part-43', 'MOU-OPT-USB', 'Mouse Óptico Comum USB', 'Mouse', 'Nova', 'Universal', 20, 5, 35, 89, { tipo: 'Óptico', conexao: 'USB' }],
  ['demo-part-44', 'MOU-WRL-24G', 'Mouse Sem Fio 2.4GHz', 'Mouse', 'Nova', 'Universal', 15, 4, 65, 159, { tipo: 'Sem Fio', frequencia: '2.4GHz' }],
  ['demo-part-45', 'MOU-WRL-BT', 'Mouse Sem Fio Bluetooth', 'Mouse', 'Nova', 'Universal', 12, 3, 85, 189, { tipo: 'Sem Fio', conexao: 'Bluetooth' }],
  ['demo-part-46', 'MOU-GMR-RGB-3200', 'Mouse Gamer RGB 3200 DPI', 'Mouse', 'Nova', 'Universal', 10, 2, 150, 349, { tipo: 'Gamer', dpi: '3200', rgb: 'Sim' }],
  ['demo-part-47', 'MOU-GMR-RGB-7200', 'Mouse Gamer RGB 7200 DPI', 'Mouse', 'Nova', 'Universal', 8, 2, 200, 449, { tipo: 'Gamer', dpi: '7200', rgb: 'Sim' }],
  ['demo-part-48', 'MOU-GMR-RGB-12000', 'Mouse Gamer RGB 12000 DPI', 'Mouse', 'Nova', 'Universal', 6, 1, 280, 599, { tipo: 'Gamer', dpi: '12000', rgb: 'Sim' }],
  // Teclados
  ['demo-part-49', 'TEC-ABNT-USB', 'Teclado Padrão ABNT2 USB', 'Teclado', 'Nova', 'Universal', 14, 4, 120, 249, { layout: 'ABNT2', conexao: 'USB' }],
  ['demo-part-50', 'TEC-SLM-WRL', 'Teclado Slim Sem Fio', 'Teclado', 'Nova', 'Universal', 10, 3, 180, 379, { tipo: 'Slim', conexao: 'Sem Fio' }],
  ['demo-part-51', 'TEC-KIT-WRL', 'Kit Teclado e Mouse Sem Fio', 'Teclado', 'Nova', 'Universal', 8, 2, 220, 449, { kit: 'Sim', conexao: 'Sem Fio' }],
  ['demo-part-52', 'TEC-GMR-RGB-MEM', 'Teclado Gamer Membrana RGB', 'Teclado', 'Nova', 'Universal', 7, 2, 280, 549, { tipo: 'Gamer', switch: 'Membrana', rgb: 'Sim' }],
  ['demo-part-53', 'TEC-GMR-MEC-BLUE', 'Teclado Gamer Mecânico Switch Blue', 'Teclado', 'Nova', 'Universal', 6, 2, 380, 699, { tipo: 'Gamer', switch: 'Mecânico Blue', rgb: 'Sim' }],
  ['demo-part-54', 'TEC-GMR-MEC-RED', 'Teclado Gamer Mecânico Switch Red', 'Teclado', 'Nova', 'Universal', 5, 2, 380, 699, { tipo: 'Gamer', switch: 'Mecânico Red', rgb: 'Sim' }],
  // Mousepads
  ['demo-part-55', 'PAD-STD-S', 'Mousepad Padrão Pequeno', 'Mousepad', 'Nova', 'Universal', 25, 8, 18, 49, { tamanho: 'Pequeno' }],
  ['demo-part-56', 'PAD-STD-M', 'Mousepad Padrão Médio', 'Mousepad', 'Nova', 'Universal', 20, 6, 28, 69, { tamanho: 'Médio' }],
  ['demo-part-57', 'PAD-ERG-GEL', 'Mousepad Ergonômico com Apoio em Gel', 'Mousepad', 'Nova', 'Universal', 15, 4, 68, 149, { tipo: 'Ergonômico', apoio: 'Gel' }],
  ['demo-part-58', 'PAD-GMR-SPD-7030', 'Mousepad Gamer Speed 70x30cm', 'Mousepad', 'Nova', 'Universal', 12, 3, 95, 199, { tipo: 'Gamer Speed', dimensoes: '70x30cm' }],
  ['demo-part-59', 'PAD-GMR-RGB-8030', 'Mousepad Gamer RGB XL 80x30cm', 'Mousepad', 'Nova', 'Universal', 10, 2, 130, 249, { tipo: 'Gamer RGB XL', dimensoes: '80x30cm', rgb: 'Sim' }],
];

const kits = [
  ['demo-kit-01', 'Kit upgrade notebook 16GB', 'SSD 480GB + memória RAM 8GB para upgrade básico.', 430],
  ['demo-kit-02', 'Kit manutenção notebook', 'Pasta térmica + kit de parafusos para manutenção.', 45],
];

const kitItems = [
  ['demo-kit-item-01', 'demo-kit-01', 'demo-part-04', 1],
  ['demo-kit-item-02', 'demo-kit-01', 'demo-part-06', 1],
  ['demo-kit-item-03', 'demo-kit-02', 'demo-part-14', 1],
  ['demo-kit-item-04', 'demo-kit-02', 'demo-part-15', 1],
];

async function seedDemoData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
  });

  try {
    const [users] = await connection.execute('SELECT id, email, full_name FROM users');
    const technician = users.find((user) => user.email === 'pedro@techflow.local') || users.find((user) => user.email === 'tecnico@techflow.com');
    const attendant = users.find((user) => user.email === 'amanda@techflow.local') || users.find((user) => user.email === 'admin@techflow.com');
    const admin = users.find((user) => user.email === 'alesxandrocosta@gmail.com') || users.find((user) => user.email === 'admin@techflow.com');

    if (!technician || !attendant || !admin) throw new Error('Usuários necessários não encontrados. Execute npm run seed-users antes.');

    for (const customer of customers) {
      await connection.execute(
        `INSERT INTO customers (id, nome, tipo, documento, telefone, email, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nome=VALUES(nome), telefone=VALUES(telefone), email=VALUES(email), status=VALUES(status)`,
        customer,
      );
    }

    for (const service of services) {
      await connection.execute(
        `INSERT INTO services (id, nome, descricao, categoria, preco_sugerido, tempo_estimado_horas, ativo)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE nome=VALUES(nome), descricao=VALUES(descricao), categoria=VALUES(categoria), preco_sugerido=VALUES(preco_sugerido), tempo_estimado_horas=VALUES(tempo_estimado_horas), ativo=TRUE`,
        service,
      );
    }

    for (const part of parts) {
      await connection.execute(
        `INSERT INTO product_parts (id, codigo_sku, nome, categoria, condicao, equipamento_tipo, technical_specs, quantidade_estoque, quantidade_minima, preco_custo, preco_venda, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE nome=VALUES(nome), categoria=VALUES(categoria), condicao=VALUES(condicao), equipamento_tipo=VALUES(equipamento_tipo), technical_specs=VALUES(technical_specs), quantidade_estoque=VALUES(quantidade_estoque), quantidade_minima=VALUES(quantidade_minima), preco_custo=VALUES(preco_custo), preco_venda=VALUES(preco_venda), ativo=TRUE`,
        [part[0], part[1], part[2], part[3], part[4], part[5], JSON.stringify(part[10]), part[6], part[7], part[8], part[9]],
      );
    }

    for (const kit of kits) {
      await connection.execute(
        `INSERT INTO kits (id, nome, descricao, preco_kit, ativo)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE nome=VALUES(nome), descricao=VALUES(descricao), preco_kit=VALUES(preco_kit), ativo=TRUE`,
        kit,
      );
    }

    for (const item of kitItems) {
      await connection.execute(
        `INSERT INTO kit_items (id, kit_id, peca_id, quantidade)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE kit_id=VALUES(kit_id), peca_id=VALUES(peca_id), quantidade=VALUES(quantidade)`,
        item,
      );
    }

    const orders = [
      ['demo-os-01', 'OS-DEMO-0001', 'demo-customer-01', technician.id, attendant.id, 'Em Análise', 'Dell', 'Inspiron 15', 'DEMO-NB-001', 'Notebook', 'Equipamento não liga após queda de energia.', 'Fonte e placa em diagnóstico.', '2026-09-12', 90, 90],
      ['demo-os-02', 'OS-DEMO-0002', 'demo-customer-02', technician.id, attendant.id, 'Aguardando Peça', 'Samsung', 'Galaxy A54', 'DEMO-SP-002', 'Smartphone', 'Não realiza carga.', 'Necessário substituir conector USB-C.', '2026-09-15', 190, 190],
      ['demo-os-03', 'OS-DEMO-0003', 'demo-customer-03', technician.id, attendant.id, 'Concluído', 'Lenovo', 'ThinkPad E14', 'DEMO-NB-003', 'Notebook', 'Lentidão e travamentos.', 'Upgrade de memória e SSD concluído.', '2026-09-10', 430, 430],
      ['demo-os-04', 'OS-DEMO-0004', 'demo-customer-04', technician.id, attendant.id, 'Recebido', 'Dell', 'OptiPlex 3080', 'DEMO-PC-004', 'Desktop', 'Computador reinicia sozinho.', null, '2026-09-18', 90, 90],
      ['demo-os-05', 'OS-DEMO-0005', 'demo-customer-05', technician.id, attendant.id, 'Entregue', 'Acer', 'Aspire 5', 'DEMO-NB-005', 'Notebook', 'Tela com manchas.', 'Tela substituída e equipamento entregue.', '2026-09-08', 240, 240],
    ];

    for (const order of orders) {
      await connection.execute(
        `INSERT INTO service_orders (id, protocolo_os, cliente_id, tecnico_id, atendente_id, status, equipamento_marca, equipamento_modelo, equipamento_serie, equipamento_tipo, defeito_relatado, laudo_tecnico, data_previsao, valor_servico, valor_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), laudo_tecnico=VALUES(laudo_tecnico), data_previsao=VALUES(data_previsao), valor_servico=VALUES(valor_servico), valor_total=VALUES(valor_total)`,
        order,
      );
    }

    const osServices = [
      ['demo-os-service-01', 'demo-os-01', 'demo-service-01', 'Diagnóstico de hardware', 'Diagnóstico', 90, 1],
      ['demo-os-service-02', 'demo-os-02', 'demo-service-06', 'Reparo de conector USB-C', 'Reparo', 190, 1],
      ['demo-os-service-03', 'demo-os-03', 'demo-service-01', 'Diagnóstico de hardware', 'Diagnóstico', 90, 1],
      ['demo-os-service-04', 'demo-os-03', 'demo-service-02', 'Limpeza interna e manutenção preventiva', 'Manutenção', 160, 1],
      ['demo-os-service-05', 'demo-os-05', 'demo-service-04', 'Troca de tela de notebook', 'Troca', 240, 1],
    ];
    for (const service of osServices) {
      await connection.execute(
        `INSERT INTO os_services (id, os_id, service_id, nome, categoria, preco, quantidade, is_custom)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
         ON DUPLICATE KEY UPDATE preco=VALUES(preco), quantidade=VALUES(quantidade)`,
        service,
      );
    }

    const osItems = [
      ['demo-os-item-01', 'demo-os-02', 'peca', 'demo-part-11', 'Conector USB-C universal', 1, 24],
      ['demo-os-item-02', 'demo-os-03', 'peca', 'demo-part-04', 'SSD 480GB SATA III', 1, 329],
      ['demo-os-item-03', 'demo-os-03', 'peca', 'demo-part-06', 'Memória RAM 8GB DDR4', 1, 169],
      ['demo-os-item-04', 'demo-os-05', 'peca', 'demo-part-01', 'Tela notebook 15.6 Full HD', 1, 699],
    ];
    for (const item of osItems) {
      await connection.execute(
        `INSERT INTO os_items (id, os_id, tipo_item, referencia_id, nome_item, quantidade, valor_unitario)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantidade=VALUES(quantidade), valor_unitario=VALUES(valor_unitario)`,
        item,
      );
    }

    const checklist = [
      ['demo-checklist-01', 'demo-os-01', JSON.stringify([{ item: 'Carcaça', estado: 'OK' }, { item: 'Tela', estado: 'OK' }, { item: 'Bateria', estado: 'OK' }]), 'Equipamento recebido com carregador.'],
      ['demo-checklist-02', 'demo-os-02', JSON.stringify([{ item: 'Tela', estado: 'OK' }, { item: 'Conector de carga', estado: 'Avariado' }, { item: 'Câmera', estado: 'OK' }]), 'Cliente relatou falha intermitente na carga.'],
      ['demo-checklist-03', 'demo-os-03', JSON.stringify([{ item: 'Carcaça', estado: 'OK' }, { item: 'Tela', estado: 'OK' }, { item: 'Bateria', estado: 'OK' }]), 'Upgrade aprovado pelo cliente.'],
    ];
    for (const item of checklist) {
      await connection.execute(
        `INSERT INTO os_checklists (id, os_id, itens, observacoes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE itens=VALUES(itens), observacoes=VALUES(observacoes)`,
        item,
      );
    }

    const [inventory] = await connection.execute('SELECT id FROM physical_inventories WHERE id = ?', ['demo-inventory-01']);
    if (!inventory.length) {
      await connection.execute(
        `INSERT INTO physical_inventories (id, responsavel_id, responsavel_nome, status) VALUES (?, ?, ?, 'aberto')`,
        ['demo-inventory-01', admin.id, admin.full_name],
      );
    }

    for (const part of parts.slice(0, 6)) {
      const [stock] = await connection.execute('SELECT quantidade_estoque FROM product_parts WHERE id = ?', [part[0]]);
      const quantity = stock[0]?.quantidade_estoque || 0;
      await connection.execute(
        `INSERT INTO physical_inventory_items (id, inventario_id, peca_id, peca_nome, quantidade_sistema, quantidade_fisica)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE peca_nome=VALUES(peca_nome), quantidade_sistema=VALUES(quantidade_sistema), quantidade_fisica=VALUES(quantidade_fisica)`,
        [`demo-inventory-item-${part[0]}`, 'demo-inventory-01', part[0], part[2], quantity, quantity],
      );
    }

    console.log(`Clientes: ${customers.length}`);
    console.log(`Serviços: ${services.length}`);
    console.log(`Peças: ${parts.length}`);
    console.log(`Kits: ${kits.length}`);
    console.log('Ordens de serviço: 5');
    console.log('Inventário físico: 1');
    console.log('Seed de dados de demonstração concluído com sucesso.');
  } finally {
    await connection.end();
  }
}

seedDemoData().catch((error) => {
  console.error(`Erro no seed de demonstração: ${error.message}`);
  process.exitCode = 1;
});
