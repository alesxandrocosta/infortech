import { useEffect, useMemo, useState } from 'react';
import { api } from './services/api';
import { defaultChecklist } from './data/checklist';
import CustomerPanel from './components/CustomerPanel';
import OrderPanel from './components/OrderPanel';
import InventoryPanel from './components/InventoryPanel';
import ServicePanel from './components/ServicePanel';
import UserPanel from './components/UserPanel';
import PhysicalInventoryPanel from './components/PhysicalInventoryPanel';
import LabelPrintView from './components/LabelPrintView';
import LoginScreen from './components/LoginScreen';
import CustomerPortal from './components/CustomerPortal';
import SalesPage from './components/SalesPage';
import './App.css';

const emptyCustomerForm = { nome: '', tipo: 'PF', documento: '', telefone: '', whatsapp: '', email: '', endereco: '', numero: '', cep: '', status: 'Adimplente' };
const emptyOrderForm = { cliente: '', cliente_id: '', tecnico: '', tecnico_id: '', equipamento: '', status: 'Recebido', orcamento_status: 'pendente', defeito: '', laudo_tecnico: '', servicos_realizados: '', etiquetas: 4, observacao: '', service_ids: [], part_items: [], hardware: {} };
const emptyInventoryForm = { codigo: '', nome: '', categoria: 'Tela', estoque: 0, minimo: 0, preco: 0, specs: {} };
const emptyServiceForm = { nome: '', categoria: 'Troca', modalidade: 'Presencial', descricao: '', notas: '', tempo: 1, preco: 0 };
const emptyUserForm = { full_name: '', telefone: '', email: '', username: '', password: '', marca: 'TechFlow', roles: ['tecnico'] };
const emptyPhysicalInventoryForm = { nome: '', status: 'Em andamento', observacoes: '' };
const defaultBrandSettings = { displayName: 'TechFlow', icon: 'TF', logo: '' };

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'clientes', label: 'Clientes', icon: '◉' },
  { id: 'ordens', label: 'Ordens', icon: '▤' },
  { id: 'estoque', label: 'Estoque', icon: '▥' },
  { id: 'servicos', label: 'Serviços', icon: '✦' },
  { id: 'inventario', label: 'Inventário', icon: '⌗' },
  { id: 'usuarios', label: 'Usuários', icon: '♙' },
];
const backofficeRoles = ['admin', 'gerente', 'administrativo'];

function IndicatorLineChart({ history }) {
  const points = Array.isArray(history) ? history : [];
  const maxRevenue = Math.max(...points.map((item) => Number(item.revenue || 0)), 1);
  const chartWidth = 720;
  const chartHeight = 180;
  const padding = 24;
  const step = points.length > 1 ? (chartWidth - (padding * 2)) / (points.length - 1) : 0;
  const revenuePoints = points.map((item, index) => {
    const x = padding + (index * step);
    const y = chartHeight - padding - ((Number(item.revenue || 0) / maxRevenue) * (chartHeight - (padding * 2)));
    return `${x},${y}`;
  }).join(' ');

  return (
    <section className="panel indicator-chart-panel">
      <div className="panel-header compact-header">
        <div><span className="eyebrow">Últimos dias</span><h2>Indicadores de vendas</h2></div>
        <span className="chart-legend"><i /> Receita</span>
      </div>
      {!points.length ? <p className="empty-state">Nenhum indicador disponível.</p> : (
        <div className="indicator-chart">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Receita dos últimos dias">
            <polyline className="indicator-chart-line" points={revenuePoints} />
            {points.map((item, index) => {
              const x = padding + (index * step);
              const y = chartHeight - padding - ((Number(item.revenue || 0) / maxRevenue) * (chartHeight - (padding * 2)));
              return <circle className="indicator-chart-point" key={`${item.day}-${index}`} cx={x} cy={y} r="4"><title>{`${item.day}: R$ ${Number(item.revenue || 0).toFixed(2)}`}</title></circle>;
            })}
          </svg>
          <div className="indicator-chart-labels">{points.map((item, index) => <span key={`${item.day}-label-${index}`}>{String(item.day).slice(5, 10)}</span>)}</div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checklist pronto para revisão');
  const [customers, setCustomers] = useState([]);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [cepLoading, setCepLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [orderLabelQuantities, setOrderLabelQuantities] = useState({});
  const [inventory, setInventory] = useState([]);
  const [inventoryForm, setInventoryForm] = useState(emptyInventoryForm);
  const [services, setServices] = useState([]);
  const [dailySales, setDailySales] = useState({ sales_count: 0, total_amount: 0 });
  const [indicatorHistory, setIndicatorHistory] = useState([]);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [customersEditingId, setCustomersEditingId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [physicalInventories, setPhysicalInventories] = useState([]);
  const [physicalInventoryForm, setPhysicalInventoryForm] = useState(emptyPhysicalInventoryForm);
  const [editingPhysicalInventoryId, setEditingPhysicalInventoryId] = useState(null);
  const [activeSection, setActiveSection] = useState('vendas');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('techflow_sidebar_collapsed') === 'true');
  const [blackMode, setBlackMode] = useState(() => window.localStorage.getItem('techflow_black_mode') === 'true');
  const [printJob, setPrintJob] = useState(null);
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [promotionMargin, setPromotionMargin] = useState(10);
  const [stockCarouselIndex, setStockCarouselIndex] = useState(0);
  const [currentDate] = useState(() => Date.now());
  const [brandSettings] = useState(() => {
    try { return { ...defaultBrandSettings, ...JSON.parse(window.localStorage.getItem('techflow_brand_settings') || '{}') }; } catch { return defaultBrandSettings; }
  });
  const [customerPortalOpen, setCustomerPortalOpen] = useState(() => window.location.pathname === '/cliente');

  useEffect(() => {
    const oauthToken = new URLSearchParams(window.location.search).get('oauth_token');
    if (oauthToken) {
      api.setToken(oauthToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (!api.getToken()) {
      setAuthLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((response) => setSession(response.data))
      .catch(() => api.clearToken())
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const fetchInitialData = async () => {
      try {
        const checklistResponse = await api.get('/checklist');
        if (checklistResponse?.success && Array.isArray(checklistResponse.data) && checklistResponse.data.length) {
          setChecklist(checklistResponse.data);
        }

        const customersResponse = await api.get('/customers');
        if (customersResponse?.success && Array.isArray(customersResponse.data)) {
          setCustomers(customersResponse.data);
        }

        const ordersResponse = await api.get('/orders');
        if (ordersResponse?.success && Array.isArray(ordersResponse.data)) {
          setOrders(ordersResponse.data);
        }

        const inventoryResponse = await api.get('/inventory');
        if (inventoryResponse?.success && Array.isArray(inventoryResponse.data)) {
          setInventory(inventoryResponse.data);
        }

        const servicesResponse = await api.get('/services');
        if (servicesResponse?.success && Array.isArray(servicesResponse.data)) {
          setServices(servicesResponse.data);
        }

        const dailySalesResponse = await api.get('/sales/today');
        if (dailySalesResponse?.success && dailySalesResponse.data) setDailySales(dailySalesResponse.data);

        const indicatorsResponse = await api.get('/dashboard/indicators');
        if (indicatorsResponse?.success && Array.isArray(indicatorsResponse.data)) setIndicatorHistory(indicatorsResponse.data);

        const usersResponse = await api.get('/users');
        if (usersResponse?.success && Array.isArray(usersResponse.data)) setUsers(usersResponse.data);

        const physicalInventoriesResponse = await api.get('/physical-inventories');
        if (physicalInventoriesResponse?.success && Array.isArray(physicalInventoriesResponse.data)) setPhysicalInventories(physicalInventoriesResponse.data);
      } catch {
        setStatusMessage('Não foi possível carregar os dados do backend');
      }
    };

    fetchInitialData();
  }, [session]);

  useEffect(() => {
    if (!printJob) return undefined;

    const handleAfterPrint = () => setPrintJob(null);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printJob]);

  const summary = useMemo(() => [
    { label: 'OS abertas', value: orders.filter((order) => !['Concluído', 'Entregue', 'Desistência do Cliente'].includes(order.status)).length, tone: 'blue' },
    { label: 'Em análise', value: orders.filter((order) => order.status === 'Em Análise').length, tone: 'amber' },
    { label: 'Concluídas', value: orders.filter((order) => ['Concluído', 'Entregue'].includes(order.status)).length, tone: 'green' },
    { label: 'Estoque mínimo', value: inventory.filter((item) => Number(item.quantidade_estoque) <= Number(item.quantidade_minima)).length, tone: 'red' },
  ], [orders, inventory]);

  const promotionCutoff = currentDate - (4 * 30 * 24 * 60 * 60 * 1000);
  const carouselProducts = inventory.filter((item) => !promotionOnly || (item.created_at && new Date(item.created_at).getTime() < promotionCutoff));
  const visibleCarouselProducts = carouselProducts.length ? [0, 1, 2].map((offset) => carouselProducts[(stockCarouselIndex + offset) % carouselProducts.length]).filter(Boolean) : [];

  const handleStatusChange = (id, nextStatus) => {
    setChecklist((current) =>
      current.map((item) =>
        item.id === id ? { ...item, estado: nextStatus } : item,
      ),
    );
  };

  const handleAddItem = (label) => {
    const nextId = checklist.length ? Math.max(...checklist.map((item) => item.id)) + 1 : 1;
    setChecklist((current) => [
      ...current,
      { id: nextId, item: label, estado: 'OK' },
    ]);
  };

  const handleRemoveItem = (id) => {
    setChecklist((current) => current.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage('Salvando checklist...');

    try {
      const data = await api.post('/checklist', { items: checklist });
      if (data?.success) {
        setStatusMessage('Checklist salvo com sucesso');
      } else {
        setStatusMessage('Checklist salvo localmente');
      }
    } catch {
      setStatusMessage('Backend indisponível: checklist salvo no navegador');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerFormChange = (event) => {
    const { name, value } = event.target;
    setCustomerForm((current) => ({ ...current, [name]: value }));
  };

  const handleCepLookup = async (rawCep) => {
    const cep = String(rawCep || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const address = await response.json();
      if (address.erro) {
        setStatusMessage('CEP não encontrado');
        return;
      }
      setCustomerForm((current) => ({
        ...current,
        cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
        endereco: [address.logradouro, address.bairro, address.localidade && address.uf ? `${address.localidade}/${address.uf}` : ''].filter(Boolean).join(', '),
      }));
    } catch {
      setStatusMessage('Não foi possível consultar o CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const handleOrderFormChange = (event) => {
    const { name, value } = event.target;
    if (name === 'cliente_id') {
      const customer = customers.find((item) => String(item.id) === String(value));
      setOrderForm((current) => ({ ...current, cliente_id: value, cliente: customer?.nome || '', equipamento: '' }));
      return;
    }
    if (name === 'tecnico_id') {
      const technician = users.find((item) => String(item.id) === String(value));
      setOrderForm((current) => ({ ...current, tecnico_id: value, tecnico: technician?.full_name || '' }));
      return;
    }
    setOrderForm((current) => ({ ...current, [name]: value }));
  };

  const handleInventoryFormChange = (event) => {
    const { name, value } = event.target;
    setInventoryForm((current) => ({ ...current, [name]: value }));
  };

  const handleServiceFormChange = (event) => {
    const { name, value } = event.target;
    setServiceForm((current) => ({ ...current, [name]: value }));
  };

  const handleUserFormChange = (event) => {
    const { name, value } = event.target;
    setUserForm((current) => ({ ...current, [name]: value }));
  };

  const handlePhysicalInventoryFormChange = (event) => {
    const { name, value } = event.target;
    setPhysicalInventoryForm((current) => ({ ...current, [name]: value }));
  };

  const handleCustomerSubmit = async (event) => {
    event.preventDefault();

    if (!customerForm.nome.trim() || !customerForm.documento.trim() || (!customerForm.telefone.trim() && !customerForm.whatsapp.trim() && !customerForm.email.trim())) {
      setStatusMessage('Preencha nome, documento e telefone, WhatsApp ou e-mail');
      return;
    }

    try {
      const payload = {
        nome: customerForm.nome,
        tipo: customerForm.tipo,
        documento: customerForm.documento,
        telefone: customerForm.telefone,
        whatsapp: customerForm.whatsapp,
        email: customerForm.email,
        endereco: customerForm.endereco,
        numero: customerForm.numero,
        cep: customerForm.cep,
        status: customerForm.status,
      };
      const response = customersEditingId
        ? await api.put(`/customers/${customersEditingId}`, payload)
        : await api.post('/customers', payload);
      setCustomers((current) => customersEditingId
        ? current.map((customer) => customer.id === customersEditingId ? response.data : customer)
        : [response.data, ...current]);
      setCustomerForm(emptyCustomerForm);
      setCustomersEditingId(null);
      setStatusMessage(customersEditingId ? 'Cliente atualizado com sucesso' : 'Cliente cadastrado com sucesso');
    } catch {
      setStatusMessage(error.message || 'Não foi possível cadastrar o cliente');
    }
  };

  const handleOrderSubmit = async (event) => {
    event.preventDefault();

    const labelQuantity = Number(orderForm.etiquetas);
    if (!orderForm.cliente.trim() || !orderForm.equipamento.trim() || !orderForm.defeito.trim() || !orderForm.observacao.trim() || !Number.isInteger(labelQuantity) || labelQuantity < 4 || labelQuantity > 100) {
      setStatusMessage('Preencha os dados da OS e informe de 4 a 100 etiquetas');
      return false;
    }

    try {
      const payload = {
        cliente: orderForm.cliente,
        cliente_id: orderForm.cliente_id,
        tecnico: orderForm.tecnico,
        tecnico_id: orderForm.tecnico_id || null,
        equipamento: orderForm.equipamento,
        defeito: orderForm.defeito,
        laudo_tecnico: orderForm.laudo_tecnico || '',
        servicos_realizados: orderForm.servicos_realizados || '',
        orcamento_status: orderForm.orcamento_status || 'pendente',
        status: orderForm.status,
        observacao: orderForm.observacao || 'OS criada.',
        service_ids: orderForm.service_ids || [],
        part_items: orderForm.part_items || [],
        hardware: orderForm.hardware || {},
        checklist,
      };
      const response = editingOrderId
        ? await api.put(`/orders/${editingOrderId}`, payload)
        : await api.post('/orders', payload);
      setOrders((current) => editingOrderId
        ? current.map((order) => order.id === editingOrderId ? response.data : order)
        : [response.data, ...current]);
      setOrderLabelQuantities((current) => ({ ...current, [response.data.id]: labelQuantity }));
      setOrderForm(emptyOrderForm);
      setEditingOrderId(null);
      setStatusMessage(editingOrderId ? 'Ordem atualizada com sucesso' : 'Ordem de serviço criada com sucesso');
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível criar a ordem');
      return false;
    }
    return true;
  };

  const handleLoadOrderHistory = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/history`);
      return response.data || [];
    } catch {
      setStatusMessage('Não foi possível carregar o histórico da OS');
      return [];
    }
  };

  const handleProgressUpdate = async (orderId, status, observacao) => {
    if (!observacao.trim()) {
      setStatusMessage('A observação é obrigatória para atualizar o progresso');
      return false;
    }
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status, observacao });
      setOrders((current) => current.map((order) => order.id === orderId ? response.data : order));
      const whatsappNotification = response.notifications?.whatsapp;
      setStatusMessage(whatsappNotification?.sent
        ? 'Progresso registrado e mensagem enviada pelo WhatsApp'
        : 'Progresso registrado, mas a mensagem do WhatsApp não foi enviada');
      return { order: response.data, whatsappNotification };
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível atualizar a OS');
      return false;
    }
  };

  const handleClaimNextOrder = async () => {
    try {
      const response = await api.post('/orders/queue/claim-next', {});
      setOrders((current) => current.map((order) => order.id === response.data.id ? response.data : order));
      setStatusMessage('Próxima OS da fila assumida com sucesso');
      return response.data;
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível assumir a próxima OS');
      return false;
    }
  };

  const handleGetContract = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/contract`);
      return response.data;
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível gerar o contrato');
      return null;
    }
  };

  const handleLogin = async (credentials) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const response = await api.login(credentials);
      api.setToken(response.data.token);
      setSession(response.data.user);
    } catch (error) {
      setAuthError(error.message || 'Credenciais inválidas');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm('Deseja sair da sessão atual?')) return;
    api.clearToken();
    setSession(null);
    setActiveSection('vendas');
  };

  const handleSaleCheckout = async (payload) => {
    const response = await api.post('/sales', payload);
    const inventoryResponse = await api.get('/inventory');
    if (inventoryResponse?.success) setInventory(inventoryResponse.data);
    const dailySalesResponse = await api.get('/sales/today');
    if (dailySalesResponse?.success && dailySalesResponse.data) setDailySales(dailySalesResponse.data);
    const indicatorsResponse = await api.get('/dashboard/indicators');
    if (indicatorsResponse?.success && Array.isArray(indicatorsResponse.data)) setIndicatorHistory(indicatorsResponse.data);
    setStatusMessage('Venda registrada e estoque atualizado');
    return response.data;
  };

  const handleSalesOrderCreate = async (form) => {
    const response = await api.post('/orders', {
      cliente: form.cliente,
      equipamento: form.equipamento,
      defeito: form.defeito,
      hardware: form.hardware || {},
      status: 'Recebido',
      observacao: 'OS aberta na frente de loja.',
      etiquetas: 4,
      service_ids: [],
      part_items: [],
      checklist,
    });
    setOrders((current) => [response.data, ...current]);
    setStatusMessage('OS criada e enviada para a fila de atendimento');
    return response.data;
  };

  const handleHardwareValidation = async (orderId, hardware) => {
    const response = await api.post(`/orders/${orderId}/hardware-validation`, hardware);
    if (response?.data?.order) setOrders((current) => current.map((order) => order.id === orderId ? response.data.order : order));
    return response.data;
  };

  const handleInventorySubmit = async (event) => {
    event.preventDefault();

    if (!inventoryForm.codigo.trim() || !inventoryForm.nome.trim() || Number(inventoryForm.estoque) < 0 || Number(inventoryForm.minimo) < 0 || Number(inventoryForm.preco) <= 0) {
      setStatusMessage('Preencha SKU, nome, quantidades válidas e preço maior que zero');
      return;
    }

    try {
      const payload = {
        codigo: inventoryForm.codigo,
        nome: inventoryForm.nome,
        categoria: inventoryForm.categoria,
        estoque: inventoryForm.estoque,
        minimo: inventoryForm.minimo,
        preco: inventoryForm.preco,
        specs: inventoryForm.specs || {},
      };
      const response = editingInventoryId
        ? await api.put(`/inventory/${editingInventoryId}`, payload)
        : await api.post('/inventory', payload);
      setInventory((current) => editingInventoryId
        ? current.map((item) => item.id === editingInventoryId ? response.data : item)
        : [response.data, ...current]);
      setInventoryForm(emptyInventoryForm);
      setEditingInventoryId(null);
      setStatusMessage(editingInventoryId ? 'Peça atualizada com sucesso' : 'Peça cadastrada com sucesso');
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível cadastrar a peça');
    }
  };

  const handleServiceSubmit = async (event) => {
    event.preventDefault();

    if (!serviceForm.nome.trim() || Number(serviceForm.tempo) <= 0 || Number(serviceForm.preco) <= 0) {
      setStatusMessage('Preencha nome, tempo e preço maior que zero');
      return;
    }

    try {
      const payload = {
        nome: serviceForm.nome,
        categoria: serviceForm.categoria,
        modalidade: serviceForm.modalidade,
        descricao: serviceForm.descricao,
        notas: serviceForm.notas,
        tempo: serviceForm.tempo,
        preco: serviceForm.preco,
      };
      const response = editingServiceId
        ? await api.put(`/services/${editingServiceId}`, payload)
        : await api.post('/services', payload);

      setServices((current) => editingServiceId
        ? current.map((service) => service.id === editingServiceId ? response.data : service)
        : [response.data, ...current]);
      setServiceForm(emptyServiceForm);
      setEditingServiceId(null);
      setStatusMessage(editingServiceId ? 'Serviço atualizado com sucesso' : 'Serviço cadastrado com sucesso');
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível salvar o serviço');
    }
  };

  const handleEditService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      nome: service.nome || '',
      categoria: service.categoria || 'Reparo',
      modalidade: service.modalidade || 'Presencial',
      descricao: service.descricao || '',
      notas: service.notas || '',
      tempo: service.tempo_estimado_horas ?? service.tempo ?? 1,
      preco: service.preco_sugerido ?? service.preco ?? 0,
    });
    setStatusMessage(`Editando serviço: ${service.nome}`);
  };

  const handleCancelServiceEdit = () => {
    setEditingServiceId(null);
    setServiceForm(emptyServiceForm);
    setStatusMessage('Edição cancelada');
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Deseja realmente excluir este serviço?')) {
      return;
    }

    try {
      await api.delete(`/services/${serviceId}`);
      setServices((current) => current.filter((service) => service.id !== serviceId));
      if (editingServiceId === serviceId) {
        handleCancelServiceEdit();
      }
      setStatusMessage('Serviço excluído com sucesso');
    } catch (error) {
      setStatusMessage(error.message || 'Não foi possível excluir o serviço');
    }
  };

  const handleEditCustomer = (customer) => {
    setCustomersEditingId(customer.id);
    setCustomerForm({ nome: customer.nome || '', tipo: customer.tipo || 'PF', documento: customer.documento || '', telefone: customer.telefone || '', whatsapp: customer.whatsapp || '', email: customer.email || '', endereco: customer.endereco || '', numero: customer.numero || '', cep: customer.cep || '', status: customer.status || 'Adimplente' });
  };

  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Deseja realmente excluir este cliente?')) return;
    try {
      await api.delete(`/customers/${customerId}`);
      setCustomers((current) => current.filter((customer) => customer.id !== customerId));
      setStatusMessage('Cliente excluído com sucesso');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível excluir o cliente'); }
  };

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setOrderForm({ cliente: order.cliente || '', cliente_id: order.cliente_id || '', tecnico: order.tecnico || '', tecnico_id: order.tecnico_id || '', equipamento: order.equipamento || '', status: order.status || 'Recebido', orcamento_status: order.orcamento_status || 'pendente', defeito: order.defeito || '', laudo_tecnico: order.laudo_tecnico || '', servicos_realizados: order.servicos_realizados || '', observacao: '', etiquetas: orderLabelQuantities[order.id] || 4, service_ids: [], part_items: [], hardware: { hwid_equipamento: order.hwid_equipamento || '', serial_bios: order.serial_bios || '', uuid_sistema: order.uuid_sistema || '', mac_rede: order.mac_rede || '', serial_disco: order.serial_disco || '', especificacoes_json: order.especificacoes_json || {} } });
    if (Array.isArray(order.checklist) && order.checklist.length) setChecklist(order.checklist);
  };

  const resetOrderForm = () => {
    setEditingOrderId(null);
    setOrderForm(emptyOrderForm);
    setChecklist(defaultChecklist);
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Deseja realmente excluir esta ordem?')) return;
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((current) => current.filter((order) => order.id !== orderId));
      setOrderLabelQuantities((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      setStatusMessage('Ordem excluída com sucesso');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível excluir a ordem'); }
  };

  const handlePrintLabels = (order, quantity) => {
    const safeQuantity = Math.min(100, Math.max(4, Number(quantity) || 4));
    setPrintJob({ order, quantity: safeQuantity });
  };

  const handleEditInventory = (item) => {
    setEditingInventoryId(item.id);
    setInventoryForm({ codigo: item.codigo_sku || item.codigo || '', nome: item.nome || '', categoria: item.categoria || 'Outro', estoque: item.quantidade_estoque ?? 0, minimo: item.quantidade_minima ?? 0, preco: item.preco_venda ?? 0, specs: item.technical_specs || {} });
  };

  const handleDeleteInventory = async (itemId) => {
    if (!window.confirm('Deseja realmente excluir esta peça?')) return;
    try {
      await api.delete(`/inventory/${itemId}`);
      setInventory((current) => current.filter((item) => item.id !== itemId));
      setStatusMessage('Peça excluída com sucesso');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível excluir a peça'); }
  };

  const handleSellInventory = async (item) => {
    try {
      await api.post(`/inventory/${item.id}/movements`, { quantidade: 1 });
      const response = await api.get('/inventory');
      if (response?.success) setInventory(response.data);
      setStatusMessage('Venda registrada e inventário atualizado');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível registrar a venda'); }
  };

  const handleUserSubmit = async (event) => {
    event.preventDefault();
    if (!userForm.full_name.trim() || !userForm.telefone.trim() || !userForm.email.trim() || !userForm.username.trim() || !userForm.roles.length || (!editingUserId && !userForm.password.trim())) {
      setStatusMessage('Preencha nome, telefone, e-mail, usuário e perfil');
      return;
    }
    try {
      const payload = { full_name: userForm.full_name, telefone: userForm.telefone, email: userForm.email, username: userForm.username, marca: brandSettings.displayName, roles: userForm.roles, password: userForm.password };
      const response = editingUserId ? await api.put(`/users/${editingUserId}`, payload) : await api.post('/users', payload);
      setUsers((current) => editingUserId ? current.map((user) => user.id === editingUserId ? response.data : user) : [...current, response.data]);
      setUserForm(emptyUserForm); setEditingUserId(null); setStatusMessage('Usuário salvo com sucesso');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível salvar o usuário'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Deseja realmente excluir este usuário?')) return;
    try { await api.delete(`/users/${userId}`); setUsers((current) => current.filter((user) => user.id !== userId)); setStatusMessage('Usuário excluído com sucesso'); }
    catch (error) { setStatusMessage(error.message || 'Não foi possível excluir o usuário'); }
  };

  const handlePhysicalInventorySubmit = async (event) => {
    event.preventDefault();
    if (!physicalInventoryForm.nome.trim() || !physicalInventoryForm.observacoes.trim()) { setStatusMessage('Preencha nome e observações do inventário'); return; }
    try {
      const response = editingPhysicalInventoryId
        ? await api.put(`/physical-inventories/${editingPhysicalInventoryId}`, physicalInventoryForm)
        : await api.post('/physical-inventories', physicalInventoryForm);
      setPhysicalInventories((current) => editingPhysicalInventoryId ? current.map((inventory) => inventory.id === editingPhysicalInventoryId ? response.data : inventory) : [response.data, ...current]);
      setPhysicalInventoryForm(emptyPhysicalInventoryForm); setEditingPhysicalInventoryId(null); setStatusMessage('Inventário salvo com sucesso');
    } catch (error) { setStatusMessage(error.message || 'Não foi possível salvar o inventário'); }
  };

  const handleDeletePhysicalInventory = async (inventoryId) => {
    if (!window.confirm('Deseja realmente excluir este inventário?')) return;
    try { await api.delete(`/physical-inventories/${inventoryId}`); setPhysicalInventories((current) => current.filter((inventory) => inventory.id !== inventoryId)); setStatusMessage('Inventário excluído com sucesso'); }
    catch (error) { setStatusMessage(error.message || 'Não foi possível excluir o inventário'); }
  };

  const handleNavigation = (sectionId) => {
    setActiveSection(sectionId);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('techflow_sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleBlackMode = () => {
    setBlackMode((current) => {
      const next = !current;
      window.localStorage.setItem('techflow_black_mode', String(next));
      return next;
    });
  };

  const activeNavigationItem = navigationItems.find((item) => item.id === activeSection);

  const dashboardView = (
    <section className="dashboard-view">
      <div className="dashboard-content-grid">
        <section className="panel dashboard-orders-panel">
          <div className="panel-header compact-header"><div><span className="eyebrow">Acompanhamento</span><h2>Produtos em estoque</h2></div><button className="secondary-button" type="button" onClick={() => handleNavigation('estoque')}>Ver estoque</button></div>
          <div className="promotion-controls"><label className="promotion-toggle"><input type="checkbox" checked={promotionOnly} onChange={(event) => { setPromotionOnly(event.target.checked); setStockCarouselIndex(0); }} />Promoção</label><label className="promotion-margin">Margem <input type="number" min="1" max="30" value={promotionMargin} onChange={(event) => setPromotionMargin(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} />%</label><span className="promotion-hint">{promotionOnly ? 'Mais de 4 meses em estoque' : 'Todos os produtos disponíveis'}</span></div>
          <div className="stock-carousel"><button className="carousel-arrow" type="button" aria-label="Produto anterior" disabled={carouselProducts.length < 2} onClick={() => setStockCarouselIndex((current) => (current - 1 + carouselProducts.length) % carouselProducts.length)}>‹</button><div className="stock-carousel-track">{visibleCarouselProducts.map((item) => { const price = Number(item.preco_venda || 0); const promotionPrice = price * (1 - promotionMargin / 100); return <article className="stock-carousel-card" key={item.id}><div className="stock-card-category">{item.categoria}</div><h3>{item.nome}</h3><strong>SKU {item.codigo_sku || item.codigo}</strong><div className="stock-card-footer"><span>{item.quantidade_estoque} un.</span><span>{promotionOnly ? <><del>R$ {price.toFixed(2)}</del> R$ {promotionPrice.toFixed(2)}</> : `R$ ${price.toFixed(2)}`}</span></div>{promotionOnly && <span className="promotion-badge">-{promotionMargin}%</span>}</article>; })}{!visibleCarouselProducts.length && <p className="empty-state">Nenhum produto atende ao filtro.</p>}</div><button className="carousel-arrow" type="button" aria-label="Próximo produto" disabled={carouselProducts.length < 2} onClick={() => setStockCarouselIndex((current) => (current + 1) % carouselProducts.length)}>›</button></div>
        </section>

        <aside className="panel side-panel">
          <div className="status-box">
            <span className="eyebrow">Status</span>
            <p>{statusMessage}</p>
            <button className="secondary-button" disabled={saving} onClick={handleSave} type="button">
              {saving ? 'Salvando...' : 'Atualizar rotina'}
            </button>
          </div>
        </aside>
      </div>
      <IndicatorLineChart history={indicatorHistory} />
    </section>
  );

  const activeModuleView = {
    clientes: (
      <CustomerPanel
        customers={customers}
        form={customerForm}
        editingId={customersEditingId}
        onChange={handleCustomerFormChange}
        onSubmit={handleCustomerSubmit}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
        onCancelEdit={() => { setCustomersEditingId(null); setCustomerForm(emptyCustomerForm); }}
        onCepLookup={handleCepLookup}
        cepLoading={cepLoading}
      />
    ),
    ordens: (
      <OrderPanel
        orders={orders}
        form={orderForm}
        checklist={checklist}
        editingId={editingOrderId}
        labelQuantities={orderLabelQuantities}
        onChange={handleOrderFormChange}
        onSubmit={handleOrderSubmit}
        onEdit={handleEditOrder}
        onDelete={handleDeleteOrder}
        onCancelEdit={resetOrderForm}
        onPrintLabels={handlePrintLabels}
        onProgressUpdate={handleProgressUpdate}
        onClaimNext={handleClaimNextOrder}
        onGetContract={handleGetContract}
        currentUserRole={session?.role}
        onChecklistStatusChange={handleStatusChange}
        onChecklistAddItem={handleAddItem}
        onChecklistRemoveItem={handleRemoveItem}
        onLoadHistory={handleLoadOrderHistory}
        onHardwareValidation={handleHardwareValidation}
        services={services}
        parts={inventory}
        customers={customers}
        users={users}
      />
    ),
    estoque: (
      <InventoryPanel
        parts={inventory.length ? inventory : [
          { id: 1, codigo_sku: 'TEL-001', nome: 'Tela LCD 13.3', categoria: 'Tela', quantidade_estoque: 12, quantidade_minima: 4 },
          { id: 2, codigo_sku: 'BAT-010', nome: 'Bateria Notebook Dell', categoria: 'Bateria', quantidade_estoque: 3, quantidade_minima: 4 },
        ]}
        form={inventoryForm}
        editingId={editingInventoryId}
        onChange={handleInventoryFormChange}
        onSubmit={handleInventorySubmit}
        onEdit={handleEditInventory}
        onDelete={handleDeleteInventory}
        onCancelEdit={() => { setEditingInventoryId(null); setInventoryForm(emptyInventoryForm); }}
        onSell={handleSellInventory}
      />
    ),
    servicos: (
      <ServicePanel
        services={services.length ? services : [
          { id: 1, nome: 'Troca de tela', categoria: 'Troca', tempo_estimado_horas: 2.5, preco_sugerido: 220.00 },
          { id: 2, nome: 'Diagnóstico técnico', categoria: 'Diagnóstico', tempo_estimado_horas: 1.0, preco_sugerido: 90.00 },
        ]}
        form={serviceForm}
        editingId={editingServiceId}
        onChange={handleServiceFormChange}
        onSubmit={handleServiceSubmit}
        onEdit={handleEditService}
        onDelete={handleDeleteService}
        onCancelEdit={handleCancelServiceEdit}
      />
    ),
    inventario: (
      <PhysicalInventoryPanel
        inventories={physicalInventories}
        stockItems={inventory}
        form={physicalInventoryForm}
        editingId={editingPhysicalInventoryId}
        onChange={handlePhysicalInventoryFormChange}
        onSubmit={handlePhysicalInventorySubmit}
        onEdit={(inventory) => { setEditingPhysicalInventoryId(inventory.id); setPhysicalInventoryForm({ nome: inventory.nome, status: inventory.status, observacoes: inventory.observacoes }); }}
        onDelete={handleDeletePhysicalInventory}
        onCancelEdit={() => { setEditingPhysicalInventoryId(null); setPhysicalInventoryForm(emptyPhysicalInventoryForm); }}
      />
    ),
    usuarios: (
      <UserPanel
        users={users}
        form={userForm}
        editingId={editingUserId}
        onChange={handleUserFormChange}
        onSubmit={handleUserSubmit}
        onEdit={(user) => { setEditingUserId(user.id); setUserForm({ full_name: user.full_name, telefone: user.telefone || '', email: user.email, username: user.username || '', marca: user.marca || brandSettings.displayName, password: '', roles: user.roles || [user.role] }); }}
        onDelete={handleDeleteUser}
        onCancelEdit={() => { setEditingUserId(null); setUserForm(emptyUserForm); }}
      />
    ),
  };

  const salesView = <SalesPage inventory={inventory} customers={customers} onCheckout={handleSaleCheckout} onCreateOrder={handleSalesOrderCreate} />;

  if (customerPortalOpen) return <CustomerPortal onBack={() => { window.history.pushState({}, document.title, '/'); setCustomerPortalOpen(false); }} />;
  if (authLoading && !session) return <LoginScreen onLogin={handleLogin} error={authError} loading={authLoading} onCustomerAccess={() => setCustomerPortalOpen(true)} />;
  if (!session) return <LoginScreen onLogin={handleLogin} error={authError} loading={authLoading} onCustomerAccess={() => setCustomerPortalOpen(true)} />;

  const visibleNavigationItems = session.role && backofficeRoles.includes(session.role) ? navigationItems : [];

  return (
    <div className={`app-shell ${blackMode ? 'black-mode' : ''} ${sidebarCollapsed ? 'sidebar-collapsed-shell' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <button className="sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'} title={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>{sidebarCollapsed ? '»' : '«'}</button>
        <div className="brand-block">
          <div className="brand-mark">{brandSettings.logo ? <img src={brandSettings.logo} alt="Logomarca" /> : brandSettings.icon}</div>
          <div>
            <p className="label-mini">ERP</p>
            <h1>{brandSettings.displayName}</h1>
          </div>
        </div>

        <nav className="nav-group" aria-label="Navegação principal">
          <button className={activeSection === 'vendas' ? 'nav-active' : ''} onClick={() => handleNavigation('vendas')} type="button"><span className="nav-icon">$</span><span className="nav-label">Vendas</span></button>
          {visibleNavigationItems.map((item) => (
            <button
              key={item.id}
              className={activeSection === item.id ? 'nav-active' : ''}
              onClick={() => handleNavigation(item.id)}
              type="button"
            >
              <span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <button type="button" onClick={toggleBlackMode} aria-pressed={blackMode} title={blackMode ? 'Desativar versão black' : 'Ativar versão black'}><span className="nav-icon">●</span><span className="nav-label">{blackMode ? 'Tema padrão' : 'Versão black'}</span></button>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user"><strong>{session.full_name}</strong><span>{session.role}</span></div>
          <button className="logout-button" type="button" onClick={handleLogout} title="Sair"><span className="nav-icon">↪</span><span className="nav-label">Sair</span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar" id="dashboard">
          <div>
            <p className="eyebrow">Módulo ativo</p>
            <h2>{activeSection === 'vendas' ? 'Vendas' : activeNavigationItem?.label || 'Dashboard'}</h2>
          </div>
          <div className="topbar-context">{activeSection === 'vendas' ? 'Frente de loja' : 'Bancada operacional'}</div>
        </header>

        {activeSection === 'dashboard' && (
          <section className="stats-grid">
            {summary.map((card) => (
              <article key={card.label} className={`metric-card ${card.tone}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
            <article className="metric-card cyan">
              <span>Faturamento do dia</span>
              <strong>{Number(dailySales.total_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              <small>{dailySales.sales_count} venda(s) registrada(s)</small>
            </article>
          </section>
        )}

        <section className="active-module-view">
          {activeSection === 'vendas' ? salesView : activeSection === 'dashboard' ? dashboardView : activeModuleView[activeSection]}
        </section>
      </main>
      <LabelPrintView job={printJob} onClose={() => setPrintJob(null)} onPrint={() => window.print()} />
    </div>
  );
}

export default App;
