-- Popula o estoque comercial sem sobrescrever SKUs existentes.
-- Precos ficam NULL para preenchimento posterior pelo CRUD.
-- Execute no banco bd_infortec.

USE bd_infortec;

INSERT INTO product_parts (
  id,
  codigo_sku,
  nome,
  categoria,
  condicao,
  equipamento_tipo,
  technical_specs,
  quantidade_estoque,
  quantidade_minima,
  preco_custo,
  preco_venda,
  ativo
)
SELECT UUID(), dados.codigo_sku, dados.nome, dados.categoria, 'Nova', dados.equipamento_tipo,
       dados.technical_specs, 20, 5, NULL, NULL, TRUE
FROM (
  SELECT 'MON-LED-14IN' AS codigo_sku, 'Monitor 14"' AS nome, 'Monitor' AS categoria, 'Universal' AS equipamento_tipo, JSON_OBJECT('tamanho', '14 polegadas', 'tipo', 'LED') AS technical_specs
  UNION ALL SELECT 'MON-LED-15IN', 'Monitor 15"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '15 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-16IN', 'Monitor 16"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '16 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-17IN', 'Monitor 17"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '17 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-19IN', 'Monitor 19"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '19 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-20IN', 'Monitor 20"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '20 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-21IN', 'Monitor 21.5"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '21.5 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-22IN', 'Monitor 22"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '22 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-24IN', 'Monitor 24"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '24 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-LED-27IN', 'Monitor 27"', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '27 polegadas', 'tipo', 'LED')
  UNION ALL SELECT 'MON-GMR-24IN-144HZ', 'Monitor Gamer 24" 144Hz', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '24 polegadas', 'taxa_atualizacao', '144Hz')
  UNION ALL SELECT 'MON-GMR-27IN-165HZ', 'Monitor Gamer 27" 165Hz', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '27 polegadas', 'taxa_atualizacao', '165Hz')
  UNION ALL SELECT 'MON-GMR-32IN-CURV', 'Monitor Gamer 32" Curvo', 'Monitor', 'Universal', JSON_OBJECT('tamanho', '32 polegadas', 'curvatura', 'Curvo')

  UNION ALL SELECT 'CEL-AND-64GB', 'Celular Android 64GB', 'Smartphone', 'Smartphone', JSON_OBJECT('sistema', 'Android', 'armazenamento', '64GB')
  UNION ALL SELECT 'CEL-AND-128GB', 'Celular Android 128GB', 'Smartphone', 'Smartphone', JSON_OBJECT('sistema', 'Android', 'armazenamento', '128GB')
  UNION ALL SELECT 'CEL-AND-256GB', 'Celular Android 256GB', 'Smartphone', 'Smartphone', JSON_OBJECT('sistema', 'Android', 'armazenamento', '256GB')
  UNION ALL SELECT 'CEL-IOS-128GB', 'Celular iOS/iPhone 128GB', 'Smartphone', 'Smartphone', JSON_OBJECT('sistema', 'iOS', 'armazenamento', '128GB')
  UNION ALL SELECT 'CEL-IOS-256GB', 'Celular iOS/iPhone 256GB', 'Smartphone', 'Smartphone', JSON_OBJECT('sistema', 'iOS', 'armazenamento', '256GB')

  UNION ALL SELECT 'FON-EAR-P2', 'Fone de Ouvido Intra-auricular Conexao P2', 'Fone', 'Smartphone', JSON_OBJECT('tipo', 'Intra-auricular', 'conector', 'P2')
  UNION ALL SELECT 'FON-EAR-TYPEC', 'Fone de Ouvido Intra-auricular Conexao Type-C', 'Fone', 'Smartphone', JSON_OBJECT('tipo', 'Intra-auricular', 'conector', 'Type-C')
  UNION ALL SELECT 'FON-TWS-BT', 'Fone de Ouvido Sem Fio Bluetooth TWS', 'Fone', 'Smartphone', JSON_OBJECT('tipo', 'TWS', 'conexao', 'Bluetooth')
  UNION ALL SELECT 'FON-HDS-P2-MIC', 'Headset Office com Microfone P2', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Headset Office', 'microfone', TRUE, 'conector', 'P2')
  UNION ALL SELECT 'FON-HDS-USB-MIC', 'Headset Office com Microfone USB', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Headset Office', 'microfone', TRUE, 'conector', 'USB')
  UNION ALL SELECT 'FON-GMR-RGB-P2', 'Fone Headset Gamer RGB Conexao P2', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'rgb', TRUE, 'conector', 'P2')
  UNION ALL SELECT 'FON-GMR-RGB-USB', 'Fone Headset Gamer RGB Conexao USB', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'rgb', TRUE, 'conector', 'USB')
  UNION ALL SELECT 'FON-GMR-71-USB', 'Fone Headset Gamer 7.1 Surround USB', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'canais', '7.1', 'conector', 'USB')
  UNION ALL SELECT 'FON-GMR-WRL-BT', 'Fone Headset Gamer Sem Fio Bluetooth 2.4GHz', 'Fone', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'conexao', 'Bluetooth/2.4GHz')

  UNION ALL SELECT 'MOU-OPT-USB', 'Mouse Optico Comum USB', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Optico', 'conexao', 'USB')
  UNION ALL SELECT 'MOU-WRL-24G', 'Mouse Sem Fio 2.4GHz', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Sem Fio', 'frequencia', '2.4GHz')
  UNION ALL SELECT 'MOU-WRL-BT', 'Mouse Sem Fio Bluetooth', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Sem Fio', 'conexao', 'Bluetooth')
  UNION ALL SELECT 'MOU-GMR-RGB-3200', 'Mouse Gamer RGB 3200 DPI', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'dpi', '3200', 'rgb', TRUE)
  UNION ALL SELECT 'MOU-GMR-RGB-7200', 'Mouse Gamer RGB 7200 DPI', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'dpi', '7200', 'rgb', TRUE)
  UNION ALL SELECT 'MOU-GMR-RGB-12000', 'Mouse Gamer RGB 12000 DPI', 'Mouse', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'dpi', '12000', 'rgb', TRUE)

  UNION ALL SELECT 'TEC-ABNT-USB', 'Teclado Padrao ABNT2 USB', 'Teclado', 'Universal', JSON_OBJECT('layout', 'ABNT2', 'conexao', 'USB')
  UNION ALL SELECT 'TEC-SLM-WRL', 'Teclado Slim Sem Fio', 'Teclado', 'Universal', JSON_OBJECT('tipo', 'Slim', 'conexao', 'Sem Fio')
  UNION ALL SELECT 'TEC-KIT-WRL', 'Kit Teclado e Mouse Sem Fio', 'Teclado', 'Universal', JSON_OBJECT('kit', TRUE, 'conexao', 'Sem Fio')
  UNION ALL SELECT 'TEC-GMR-RGB-MEM', 'Teclado Gamer Membrana RGB', 'Teclado', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'switch', 'Membrana', 'rgb', TRUE)
  UNION ALL SELECT 'TEC-GMR-MEC-BLUE', 'Teclado Gamer Mecanico Switch Blue', 'Teclado', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'switch', 'Mecanico Blue', 'rgb', TRUE)
  UNION ALL SELECT 'TEC-GMR-MEC-RED', 'Teclado Gamer Mecanico Switch Red', 'Teclado', 'Universal', JSON_OBJECT('tipo', 'Gamer', 'switch', 'Mecanico Red', 'rgb', TRUE)

  UNION ALL SELECT 'PAD-STD-S', 'Mousepad Padrao Pequeno', 'Mousepad', 'Universal', JSON_OBJECT('tamanho', 'Pequeno')
  UNION ALL SELECT 'PAD-STD-M', 'Mousepad Padrao Medio', 'Mousepad', 'Universal', JSON_OBJECT('tamanho', 'Medio')
  UNION ALL SELECT 'PAD-ERG-GEL', 'Mousepad Ergonomico com Apoio em Gel', 'Mousepad', 'Universal', JSON_OBJECT('tipo', 'Ergonomico', 'apoio', 'Gel')
  UNION ALL SELECT 'PAD-GMR-SPD-7030', 'Mousepad Gamer Speed 70x30cm', 'Mousepad', 'Universal', JSON_OBJECT('tipo', 'Gamer Speed', 'dimensoes', '70x30cm')
  UNION ALL SELECT 'PAD-GMR-RGB-8030', 'Mousepad Gamer RGB XL 80x30cm', 'Mousepad', 'Universal', JSON_OBJECT('tipo', 'Gamer RGB XL', 'dimensoes', '80x30cm', 'rgb', TRUE)
) AS dados
WHERE NOT EXISTS (
  SELECT 1 FROM product_parts existing WHERE existing.codigo_sku = dados.codigo_sku
);

-- Conferencia dos SKUs comerciais inseridos ou ja existentes.
SELECT codigo_sku, nome, categoria, quantidade_estoque, quantidade_minima, preco_venda
FROM product_parts
WHERE codigo_sku IN (
  'MON-LED-14IN', 'MON-LED-15IN', 'MON-LED-16IN', 'MON-LED-17IN', 'MON-LED-19IN', 'MON-LED-20IN', 'MON-LED-21IN', 'MON-LED-22IN', 'MON-LED-24IN', 'MON-LED-27IN', 'MON-GMR-24IN-144HZ', 'MON-GMR-27IN-165HZ', 'MON-GMR-32IN-CURV',
  'CEL-AND-64GB', 'CEL-AND-128GB', 'CEL-AND-256GB', 'CEL-IOS-128GB', 'CEL-IOS-256GB',
  'FON-EAR-P2', 'FON-EAR-TYPEC', 'FON-TWS-BT', 'FON-HDS-P2-MIC', 'FON-HDS-USB-MIC', 'FON-GMR-RGB-P2', 'FON-GMR-RGB-USB', 'FON-GMR-71-USB', 'FON-GMR-WRL-BT',
  'MOU-OPT-USB', 'MOU-WRL-24G', 'MOU-WRL-BT', 'MOU-GMR-RGB-3200', 'MOU-GMR-RGB-7200', 'MOU-GMR-RGB-12000',
  'TEC-ABNT-USB', 'TEC-SLM-WRL', 'TEC-KIT-WRL', 'TEC-GMR-RGB-MEM', 'TEC-GMR-MEC-BLUE', 'TEC-GMR-MEC-RED',
  'PAD-STD-S', 'PAD-STD-M', 'PAD-ERG-GEL', 'PAD-GMR-SPD-7030', 'PAD-GMR-RGB-8030'
)
ORDER BY categoria, codigo_sku;
