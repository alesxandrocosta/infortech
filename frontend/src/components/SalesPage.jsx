import { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const PIX_KEY = '31993968438';
const TAX_RATE = Number(import.meta.env.VITE_SALES_TAX_RATE || 0.0865);

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function crc16(payload) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function pixField(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function createPixPayload(amount) {
  const value = Number(amount || 0).toFixed(2);
  const merchantAccount = `${pixField('00', 'BR.GOV.BCB.PIX')}${pixField('01', PIX_KEY)}`;
  const payload = `${pixField('00', '01')}${pixField('26', merchantAccount)}${pixField('52', '0000')}${pixField('53', '986')}${pixField('54', value)}${pixField('58', 'BR')}${pixField('59', 'INFORTEC')}${pixField('60', 'BRASILIA')}${pixField('62', pixField('05', '***'))}6304`;
  return `${payload}${crc16(payload)}`;
}

export default function SalesPage({ inventory, customers, onCheckout, onCreateOrder }) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const [saleError, setSaleError] = useState('');
  const [osForm, setOsForm] = useState({ cliente: '', equipamento: '', defeito: '' });
  const [osMessage, setOsMessage] = useState('');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [saleHardware, setSaleHardware] = useState({});
  const saleHardwareRef = useRef(null);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return inventory.filter((item) => {
      if (Number(item.quantidade_estoque) <= 0) return false;
      const name = String(item.nome || '').toLowerCase();
      const sku = String(item.codigo_sku || '').toLowerCase();
      return name.startsWith(normalizedQuery) || sku.startsWith(normalizedQuery) || name.includes(normalizedQuery) || sku.includes(normalizedQuery);
    }).slice(0, 12);
  }, [inventory, query]);

  const subtotal = cart.reduce((total, item) => total + Number(item.preco_venda || 0) * item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const changeAmount = paymentMethod === 'Dinheiro' ? Math.max(0, Number(amountPaid || 0) - total) : 0;

  const addToCart = (product) => {
    setSaleError('');
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, Number(product.quantidade_estoque)) } : item);
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    const item = inventory.find((product) => product.id === id);
    const nextQuantity = Math.min(Number(item?.quantidade_estoque || 1), Math.max(1, Number(quantity) || 1));
    setCart((current) => current.map((cartItem) => cartItem.id === id ? { ...cartItem, quantity: nextQuantity } : cartItem));
  };

  const removeFromCart = (id) => setCart((current) => current.filter((item) => item.id !== id));

  const handleCheckout = async () => {
    setSaleError('');
    try {
      const sale = await onCheckout({ items: cart.map((item) => ({ id: item.id, quantity: item.quantity })), payment_method: paymentMethod, amount_paid: paymentMethod === 'Dinheiro' ? Number(amountPaid || 0) : undefined, customer_name: customerName, hardware: saleHardware });
      setLastSale(sale);
      setCart([]);
      setAmountPaid('');
    } catch (error) {
      setSaleError(error.message || 'Não foi possível finalizar a venda.');
    }
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    setOsMessage('');
    try {
      await onCreateOrder({ ...osForm, hardware: saleHardware });
      setOsForm({ cliente: '', equipamento: '', defeito: '' });
      setOsMessage('OS criada e enviada para a fila de atendimento.');
      setOrderModalOpen(false);
    } catch (error) {
      setOsMessage(error.message || 'Não foi possível criar a OS.');
    }
  };

  return (
    <section className="sales-page">
      <div className="sales-hero">
        <div><span className="eyebrow">Frente de loja</span><h1>Venda rápida, operação no ritmo da loja.</h1><p>Encontre produtos, monte o carrinho e conclua o atendimento sem sair do balcão.</p></div>
        <div className="sales-hero-stat"><span>Estoque disponível</span><strong>{inventory.filter((item) => Number(item.quantidade_estoque) > 0).length}</strong><small>itens para venda</small></div>
      </div>

      <div className="sales-layout">
        <div className="sales-catalog-column">
          <div className="sales-section-title"><div><span className="eyebrow">Catálogo</span><h2>Produtos</h2></div><span>{filteredProducts.length} encontrados</span></div>
          <div className="sales-search-bar"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar produtos por nome, SKU ou categoria" /><kbd>BUSCA</kbd></div>
          <div className="sales-catalog-grid">
            {filteredProducts.map((product) => <button className="sales-product-card" type="button" key={product.id} onClick={() => addToCart(product)}><span className="sales-product-category">{product.categoria}</span><h3>{product.nome}</h3><strong>{formatCurrency(product.preco_venda)}</strong><small>{product.codigo_sku} · {product.quantidade_estoque} disponíveis</small><span className="sales-add">Adicionar +</span></button>)}
            {!filteredProducts.length && <div className="sales-empty"><strong>Nenhum item disponível</strong><span>Cadastre produtos no estoque para começar a vender.</span></div>}
          </div>
        </div>

        <aside className="sales-checkout-panel">
          <div className="sales-panel-heading"><div><span className="eyebrow">Pedido atual</span><h2>Seleção</h2></div><span className="sales-cart-count">{cart.reduce((sum, item) => sum + item.quantity, 0)} itens</span></div>
          <label className="sales-field">Cliente (opcional)<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} list="sales-customers" placeholder="Nome para o comprovante" /></label>
          <input ref={saleHardwareRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const [file] = event.target.files || []; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); setSaleHardware({ ...data, hwid_equipamento: data.hwid_equipamento || data.ID_Equipamento, serial_bios: data.serial_bios || data.Serial_BIOS, uuid_sistema: data.uuid_sistema || data.UUID_Sistema, mac_rede: data.mac_rede || data.MAC_Rede, serial_disco: data.serial_disco || data.Serial_Disco }); } catch { setSaleError('O JSON de hardware é inválido.'); } event.target.value = ''; }; reader.readAsText(file); }} />
          <button className="secondary-button" type="button" onClick={() => saleHardwareRef.current?.click()}>Importar hardware da venda</button>
          <datalist id="sales-customers">{customers.map((customer) => <option key={customer.id} value={customer.nome} />)}</datalist>
          <div className={cart.length > 6 ? 'sales-cart-list sales-cart-list-dense' : 'sales-cart-list'}>{cart.map((item) => <div className="sales-cart-item" key={item.id}><div><strong>{item.nome}</strong><small>{formatCurrency(item.preco_venda)} cada</small></div><div className="sales-cart-controls"><input aria-label={`Quantidade de ${item.nome}`} type="number" min="1" max={item.quantidade_estoque} value={item.quantity} onChange={(event) => updateQuantity(item.id, event.target.value)} /><button type="button" onClick={() => removeFromCart(item.id)} aria-label={`Remover ${item.nome}`}>×</button></div></div>)}{!cart.length && <p className="sales-cart-empty">Clique em um item do estoque para iniciar a venda.</p>}</div>
          <div className="sales-totals"><div className="sales-total-line"><span>Total</span><strong>{formatCurrency(total)}</strong></div></div>
          <label className="sales-field">Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Pix</option><option>Dinheiro</option><option>Cartão Crédito</option><option>Cartão Débito</option></select></label>
          {paymentMethod === 'Dinheiro' && <><label className="sales-field">Valor recebido<input type="number" min={total} step="0.01" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} placeholder="Ex.: 100,00" /></label><div className="sales-change-line"><span>Troco</span><strong>{formatCurrency(changeAmount)}</strong></div></>}
          {saleError && <p className="form-error">{saleError}</p>}
          <button className="sales-finish-button" type="button" disabled={!cart.length} onClick={handleCheckout}>Finalizar venda <span>{formatCurrency(total)}</span></button>
        </aside>
      </div>

      <section className="sales-service-section"><div className="sales-service-heading"><div><span className="eyebrow">Atendimento</span><h2>Ordem de serviço</h2><p>Abra uma solicitação e envie para a fila técnica.</p></div><button className="primary-button" type="button" onClick={() => { setOsMessage(''); setOrderModalOpen(true); }}>Abrir ordem</button></div>{osMessage && <p className="sales-feedback">{osMessage}</p>}</section>

      {orderModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOrderModalOpen(false); }}><div className="sales-order-modal" role="dialog" aria-modal="true" aria-labelledby="sales-order-title"><div className="sales-service-heading"><div><span className="eyebrow">Atendimento</span><h2 id="sales-order-title">Abrir ordem de serviço</h2></div><button className="ghost-button" type="button" onClick={() => setOrderModalOpen(false)}>Fechar</button></div><p className="sales-modal-copy">Informe os dados básicos. A equipe poderá complementar a ordem nas telas administrativas.</p><form className="sales-os-form sales-os-form-modal" onSubmit={handleCreateOrder}><label>Cliente<select value={osForm.cliente} onChange={(event) => setOsForm({ ...osForm, cliente: event.target.value })} required><option value="">Selecione o cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.nome}>{customer.nome}</option>)}</select></label><label>Equipamento<input value={osForm.equipamento} onChange={(event) => setOsForm({ ...osForm, equipamento: event.target.value })} placeholder="Ex.: Notebook Dell" required /></label><label>Defeito relatado<input value={osForm.defeito} onChange={(event) => setOsForm({ ...osForm, defeito: event.target.value })} placeholder="Descreva o problema" required /></label><button className="secondary-button" type="button" onClick={() => saleHardwareRef.current?.click()}>Importar JSON do equipamento</button><div className="form-actions"><button className="secondary-button" type="button" onClick={() => setOrderModalOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Enviar para fila</button></div></form></div></div>}

      {lastSale && <div className="modal-backdrop" role="presentation"><div className="sales-receipt-modal" role="dialog" aria-modal="true"><button className="ghost-button sales-modal-close" type="button" onClick={() => setLastSale(null)}>Fechar</button><span className="eyebrow">Venda aprovada</span><h2>Pagamento registrado</h2><p>Venda #{lastSale.id.slice(0, 8)} · {lastSale.payment_method}</p><div className="sales-receipt-total">{formatCurrency(lastSale.total)}</div>{lastSale.payment_method === 'Dinheiro' && <div className="sales-receipt-change"><span>Troco</span><strong>{formatCurrency(lastSale.change_amount)}</strong></div>}{lastSale.payment_method === 'Pix' && <div className="pix-box"><QRCodeSVG value={createPixPayload(lastSale.total)} size={190} bgColor="#ffffff" fgColor="#10222c" level="M" /><strong>Escaneie para pagar</strong><small>Chave PIX: {PIX_KEY}</small></div>}<button className="primary-button" type="button" onClick={() => setLastSale(null)}>Novo atendimento</button></div></div>}
    </section>
  );
}
