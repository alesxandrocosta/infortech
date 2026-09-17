import { useState } from 'react';
import LocalHardwareModal from './LocalHardwareModal';

const skuCatalog = [
  { sku: 'TEL-NB-14-HD', nome: 'Tela notebook 14 polegadas HD', categoria: 'Tela', specs: { tamanho: '14 polegadas', resolucao: 'HD' } },
  { sku: 'TEL-NB-15-FHD', nome: 'Tela notebook 15 polegadas Full HD', categoria: 'Tela', specs: { tamanho: '15 polegadas', resolucao: 'Full HD' } },
  { sku: 'TEL-NB-17-FHD', nome: 'Tela notebook 17 polegadas Full HD', categoria: 'Tela', specs: { tamanho: '17 polegadas', resolucao: 'Full HD' } },
  { sku: 'MEM-DDR2-2GB', nome: 'Memória RAM 2GB DDR2', categoria: 'Memória RAM', specs: { memoria_tipo: 'DDR2', capacidade: '2GB' } },
  { sku: 'MEM-DDR3-4GB', nome: 'Memória RAM 4GB DDR3', categoria: 'Memória RAM', specs: { memoria_tipo: 'DDR3', capacidade: '4GB' } },
  { sku: 'MEM-DDR4-8GB', nome: 'Memória RAM 8GB DDR4', categoria: 'Memória RAM', specs: { memoria_tipo: 'DDR4', capacidade: '8GB' } },
  { sku: 'MEM-DDR5-16GB', nome: 'Memória RAM 16GB DDR5', categoria: 'Memória RAM', specs: { memoria_tipo: 'DDR5', capacidade: '16GB' } },
  { sku: 'SSD-SATA-480GB', nome: 'SSD 480GB SATA III', categoria: 'Acessório', specs: { tipo_midia: 'SSD SATA', capacidade: '480GB' } },
  { sku: 'SSD-NVME-1TB', nome: 'SSD NVMe 1TB', categoria: 'Acessório', specs: { tipo_midia: 'NVMe', capacidade: '1TB' } },
  { sku: 'HD-SATA-1TB', nome: 'HD 1TB SATA', categoria: 'Acessório', specs: { tipo_midia: 'HD SATA', capacidade: '1TB' } },
  { sku: 'NB-14-I5', nome: 'Notebook 14 polegadas Intel Core i5', categoria: 'Outro', specs: { tamanho: '14 polegadas', marca: '', modelo: '', processador: 'Intel Core i5' } },
  { sku: 'NB-15-I7', nome: 'Notebook 15 polegadas Intel Core i7', categoria: 'Outro', specs: { tamanho: '15 polegadas', marca: '', modelo: '', processador: 'Intel Core i7' } },
];

const categoryOptions = ['Tela', 'Placa-Mãe', 'Processador', 'Memória RAM', 'Bateria', 'Conector', 'Fonte', 'Adaptador', 'Insumo', 'Acessório', 'Monitor', 'Smartphone', 'Fone', 'Mouse', 'Teclado', 'Mousepad', 'Outro'];

function formatTechnicalKey(key) {
  const labels = {
    Model: 'Modelo',
    SizeGB: 'Tamanho',
    Interface: 'Interface',
    SerialNumber: 'Número de série',
    SpeedMHz: 'Velocidade',
    CapacityGB: 'Capacidade',
    PartNumber: 'Part number',
    Manufacturer: 'Fabricante',
    TypeCode: 'Tipo de memória',
  };
  return labels[key] || String(key).replaceAll('_', ' ');
}

function formatTechnicalValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) {
    return value.map((item) => formatTechnicalValue(item)).join('; ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== null && nestedValue !== undefined && nestedValue !== '')
      .map(([key, nestedValue]) => `${formatTechnicalKey(key)}: ${formatTechnicalValue(nestedValue)}`)
      .join(', ');
  }
  return String(value);
}

function formatTechnicalField(key, value) {
  if (key === 'Data_Cadastro') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('pt-BR');
  }
  return formatTechnicalValue(value);
}

export default function InventoryPanel({ parts, form, editingId, onChange, onSubmit, onEdit, onDelete, onCancelEdit, onSell, onReadLocalHardware, onSaveLocalHardware }) {
  const [detailsItem, setDetailsItem] = useState(null);
  const [hardwareModalOpen, setHardwareModalOpen] = useState(false);
  const [showMissingPrice, setShowMissingPrice] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [partQuery, setPartQuery] = useState('');
  const selectedSku = skuCatalog.find((item) => item.sku === form.codigo);
  const specs = form.specs || {};
  const missingPriceParts = parts.filter((part) => !Number(part.preco_venda || part.preco));
  const visibleParts = (showMissingPrice ? missingPriceParts : parts).slice().sort((first, second) => {
    const firstMissing = Number(first.preco_venda || first.preco) > 0 ? 1 : 0;
    const secondMissing = Number(second.preco_venda || second.preco) > 0 ? 1 : 0;
    return firstMissing - secondMissing;
  });
  const filteredParts = visibleParts.filter((part) => `${part.nome} ${part.codigo_sku || part.codigo || ''} ${part.categoria || ''}`.toLowerCase().includes(partQuery.toLowerCase().trim()));
  const updateSpec = (name, value) => onChange({ target: { name: 'specs', value: { ...specs, [name]: value } } });
  const applySku = (value) => {
    const preset = skuCatalog.find((item) => item.sku === value);
    onChange({ target: { name: 'codigo', value: preset ? preset.sku : '' } });
    if (preset) {
      onChange({ target: { name: 'nome', value: preset.nome } });
      onChange({ target: { name: 'categoria', value: preset.categoria } });
      onChange({ target: { name: 'specs', value: preset.specs } });
    }
  };
  return (
    <section className="panel form-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Estoque</span>
          <h2>Controle de peças</h2>
        </div>
        <button className={showMissingPrice ? 'primary-button' : 'secondary-button'} type="button" onClick={() => setShowMissingPrice((current) => !current)}>
          {showMissingPrice ? 'Ver todos' : `Preços pendentes (${missingPriceParts.length})`}
        </button>
        <button className="primary-button" type="button" onClick={() => setHardwareModalOpen(true)}>Ler computador local</button>
      </div>

      <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid">
          {missingPriceParts.length > 0 && <label className="inventory-pending-selector">Próximo produto sem preço<select value={editingId && !Number(form.preco) ? editingId : ''} onChange={(event) => { const selected = missingPriceParts.find((part) => String(part.id) === event.target.value); if (selected) onEdit(selected); }}><option value="">Selecione um produto pendente</option>{missingPriceParts.map((part) => <option key={part.id} value={part.id}>{part.codigo_sku} · {part.nome}</option>)}</select></label>}
          <label>SKU do catálogo<select value={selectedSku ? form.codigo : 'NOVO'} onChange={(event) => applySku(event.target.value)} required><option value="NOVO">Novo SKU</option>{skuCatalog.map((item) => <option key={item.sku} value={item.sku}>{item.sku} · {item.nome}</option>)}</select></label>
          {!selectedSku && <label>Código SKU novo<input name="codigo" value={form.codigo} onChange={onChange} placeholder="EX: TEL-NB-18-4K" required /></label>}

          <label>
            Nome da peça
            <input name="nome" value={form.nome} onChange={onChange} placeholder="Tela LCD 12.5" required minLength="2" />
          </label>

          <label>
            Categoria
            <select name="categoria" value={form.categoria} onChange={onChange}>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>

          <label>
            Estoque
            <input name="estoque" type="number" min="0" value={form.estoque} onChange={onChange} required />
          </label>

          <label>
            Mínimo
            <input name="minimo" type="number" min="0" value={form.minimo} onChange={onChange} required />
          </label>

          <label>
            Preço de venda
            <input name="preco" type="number" min="0.01" step="0.01" value={form.preco} onChange={onChange} required />
          </label>

          {(form.categoria === 'Tela' || form.categoria === 'Outro') && <label>Tamanho<input value={specs.tamanho || ''} onChange={(event) => updateSpec('tamanho', event.target.value)} placeholder="14, 15 ou 17 polegadas" /></label>}
          {form.categoria === 'Tela' && <label>Resolução<input value={specs.resolucao || ''} onChange={(event) => updateSpec('resolucao', event.target.value)} placeholder="HD, Full HD, 4K" /></label>}
          {form.categoria === 'Memória RAM' && <><label>Tipo<select value={specs.memoria_tipo || ''} onChange={(event) => updateSpec('memoria_tipo', event.target.value)}><option value="">Selecione</option><option>DDR2</option><option>DDR3</option><option>DDR4</option><option>DDR5</option></select></label><label>Capacidade<input value={specs.capacidade || ''} onChange={(event) => updateSpec('capacidade', event.target.value)} placeholder="4GB, 8GB, 16GB" /></label></>}
          {(form.categoria === 'Acessório' || form.categoria === 'Outro') && <label>Tipo de mídia<select value={specs.tipo_midia || ''} onChange={(event) => updateSpec('tipo_midia', event.target.value)}><option value="">Selecione</option><option>SSD SATA</option><option>NVMe</option><option>HD SATA</option><option>eMMC</option><option>USB</option></select></label>}
          {(form.categoria === 'Acessório' || form.categoria === 'Outro') && <label>Marca<input value={specs.marca || ''} onChange={(event) => updateSpec('marca', event.target.value)} placeholder="Dell, Kingston, Samsung" /></label>}
          {(form.categoria === 'Acessório' || form.categoria === 'Outro') && <label>Modelo<input value={specs.modelo || ''} onChange={(event) => updateSpec('modelo', event.target.value)} placeholder="Modelo ou part number" /></label>}
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">{editingId ? 'Atualizar peça' : 'Cadastrar peça'}</button>
          {editingId && <button className="secondary-button" type="button" onClick={onCancelEdit}>Cancelar edição</button>}
        </div>
      </form>

      <div className="parts-catalog">
        <button className="collapsible-heading" type="button" onClick={() => setPartsOpen((current) => !current)} aria-expanded={partsOpen}><span>Peças cadastradas</span><span>{partsOpen ? 'Recolher' : `${filteredParts.length} item(ns) · Expandir`}</span></button>
        {partsOpen && <div className="parts-list"><input className="service-search" value={partQuery} onChange={(event) => setPartQuery(event.target.value)} placeholder="Pesquisar peça por SKU, nome ou categoria" />{filteredParts.map((part) => <article className="part-list-item" key={part.id}><button className="table-link part-list-name" type="button" onClick={() => setDetailsItem(part)}><strong>{part.nome}</strong><small>SKU {part.codigo || part.codigo_sku || 'sem SKU'} · {part.categoria}</small></button><span className={`status-pill ${part.quantidade_estoque <= (part.quantidade_minima || 0) ? 'risk' : 'ok'}`}>{part.quantidade_estoque} em estoque</span><div className="table-actions"><button className="secondary-button" type="button" onClick={() => onEdit(part)}>Editar</button><button className="ghost-button" type="button" onClick={() => onDelete(part.id)}>Excluir</button></div></article>)}{!filteredParts.length && <p className="empty-state">Nenhuma peça encontrada.</p>}</div>}
      </div>
      {hardwareModalOpen && <LocalHardwareModal onClose={() => setHardwareModalOpen(false)} onRead={onReadLocalHardware} onSave={onSaveLocalHardware} />}
      {detailsItem && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsItem(null); }}><div className="modal-panel" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="eyebrow">Detalhes do item</span><h2>{detailsItem.nome}</h2></div><button className="ghost-button" type="button" onClick={() => setDetailsItem(null)}>Fechar</button></div><div className="details-grid"><div><span className="eyebrow">SKU</span><strong>{detailsItem.codigo_sku || detailsItem.codigo}</strong></div><div><span className="eyebrow">Categoria</span><strong>{detailsItem.categoria}</strong></div><div><span className="eyebrow">Estoque atual</span><strong>{detailsItem.quantidade_estoque}</strong></div><div><span className="eyebrow">Estoque mínimo</span><strong>{detailsItem.quantidade_minima}</strong></div><div><span className="eyebrow">Preço de venda</span><strong>R$ {Number(detailsItem.preco_venda || detailsItem.preco || 0).toFixed(2)}</strong></div><div><span className="eyebrow">Condição</span><strong>{detailsItem.condicao || 'Nova'}</strong></div><div className="details-wide"><span className="eyebrow">Características técnicas</span><p>{detailsItem.technical_specs ? Object.entries(detailsItem.technical_specs).filter(([, value]) => value).map(([key, value]) => `${formatTechnicalKey(key)}: ${formatTechnicalField(key, value)}`).join(' · ') : 'Não informado'}</p></div><div className="details-wide"><span className="eyebrow">Movimentações</span><p>{detailsItem.movements?.length ? detailsItem.movements.map((movement) => `${movement.origem} · ${movement.responsavel_nome} · ${new Date(movement.occurred_at).toLocaleString('pt-BR')} · R$ ${Number(movement.valor || 0).toFixed(2)}`).join('\n') : 'Nenhuma saída registrada.'}</p></div></div><div className="form-actions"><button className="primary-button" type="button" onClick={async () => { await onSell(detailsItem); setDetailsItem(null); }}>Registrar venda</button></div></div></div>}
    </section>
  );
}
