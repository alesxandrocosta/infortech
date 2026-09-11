import { useEffect, useState } from 'react';
import { checklistStatusOptions } from '../data/checklist';

const columns = ['Recebido', 'Aguardando Análise', 'Em Análise', 'Aguardando Peça', 'Aguardando Aprovação', 'Aprovado', 'Em Execução', 'Concluído', 'Finalizado', 'Entregue', 'Retorno Assistência', 'Desistência do Cliente'];

export default function OrderPanel({ orders, form, services, parts, customers, users, checklist, editingId, labelQuantities, onChange, onSubmit, onEdit, onDelete, onCancelEdit, onPrintLabels, onProgressUpdate, onClaimNext, onGetContract, currentUserRole, onChecklistStatusChange, onChecklistAddItem, onChecklistRemoveItem, onLoadHistory }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [detailsTab, setDetailsTab] = useState('resumo');
  const [history, setHistory] = useState([]);
  const [serviceQuery, setServiceQuery] = useState('');
  const [partQuery, setPartQuery] = useState('');
  const [partsOpen, setPartsOpen] = useState(false);
  const [contract, setContract] = useState(null);
  const [isNewEquipment, setIsNewEquipment] = useState(false);
  const [updatingPhase, setUpdatingPhase] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState('');

  const openDetails = async (order) => {
    setDetailsOrder(order);
    setDetailsTab('resumo');
    setHistory(await onLoadHistory(order.id));
  };

  const changePhase = async (status) => {
    if (!detailsOrder || detailsOrder.status === status || updatingPhase) return;
    setUpdatingPhase(true);
    setPhaseMessage('');
    const updatedOrder = await onProgressUpdate(detailsOrder.id, status, `Status alterado para ${status}.`);
    if (updatedOrder) {
      setDetailsOrder(updatedOrder);
      setHistory(await onLoadHistory(updatedOrder.id));
      setDetailsTab('historico');
      setPhaseMessage(`Status atualizado para ${status}.`);
    } else {
      setPhaseMessage('Não foi possível atualizar o status.');
    }
    setUpdatingPhase(false);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    onCancelEdit();
  };

  const openContract = async () => {
    if (!detailsOrder) return;
    const response = await onGetContract(detailsOrder.id);
    if (response?.contract) setContract(response.contract);
  };

  useEffect(() => {
    if (!detailsOrder || !Array.isArray(detailsOrder.checklist)) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const section = [...document.querySelectorAll('.order-details-modal .details-wide')]
        .find((element) => element.querySelector('.eyebrow')?.textContent === 'Checklist e observações');
      const paragraph = section?.querySelector('p');
      if (!paragraph) return;
      paragraph.className = 'details-checklist';
      paragraph.replaceChildren(...detailsOrder.checklist.map((item) => {
        const row = document.createElement('span');
        row.className = 'details-checklist-item';
        row.textContent = `${item.item}: ${item.estado}`;
        return row;
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailsOrder, detailsTab]);

  const selectedServices = services.filter((service) => form.service_ids?.includes(service.id));
  const selectedParts = parts.filter((part) => form.part_items?.some((item) => item.id === part.id));
  const servicesTotal = selectedServices.reduce((total, service) => total + Number(service.preco_sugerido || 0), 0);
  const partsTotal = selectedParts.reduce((total, part) => total + Number(part.preco_venda || 0) * Number(form.part_items.find((item) => item.id === part.id)?.quantidade || 1), 0);
  const approvedTotal = servicesTotal + partsTotal;
  const filteredServices = services.filter((service) => `${service.nome} ${service.codigo_sku || service.sku || service.id} ${service.categoria || ''}`.toLowerCase().includes(serviceQuery.toLowerCase().trim()));
  const filteredParts = parts.filter((part) => `${part.nome} ${part.codigo_sku || part.codigo || ''} ${part.categoria || ''}`.toLowerCase().includes(partQuery.toLowerCase().trim()));
  const canAddParts = ['Aguardando Peça', 'Aprovado', 'Concluído', 'Entregue', 'Retorno Assistência'].includes(form.status);
  const serviceGroups = filteredServices.reduce((groups, service) => {
    const category = service.categoria || 'Outro';
    groups[category] = groups[category] || [];
    groups[category].push(service);
    return groups;
  }, {});
  const technicians = users.filter((user) => user.role === 'tecnico' || user.roles?.includes('tecnico'));
  const customerEquipment = [...new Set(orders
    .filter((order) => String(order.cliente_id) === String(form.cliente_id))
    .map((order) => order.equipamento)
    .filter(Boolean))];

  const toggleService = (serviceId) => {
    const current = form.service_ids || [];
    const next = current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId];
    onChange({ target: { name: 'service_ids', value: next } });
  };

  const togglePart = (partId) => {
    const current = form.part_items || [];
    const exists = current.some((item) => item.id === partId);
    const next = exists ? current.filter((item) => item.id !== partId) : [...current, { id: partId, quantidade: 1 }];
    onChange({ target: { name: 'part_items', value: next } });
  };

  const changePartQuantity = (partId, quantidade) => {
    const next = (form.part_items || []).map((item) => item.id === partId ? { ...item, quantidade: Math.max(1, Number(quantidade) || 1) } : item);
    onChange({ target: { name: 'part_items', value: next } });
  };

  return (
    <section className="panel form-panel order-workspace">
      <div className="panel-header"><div><span className="eyebrow">Bancada de serviço</span><h2>Ordens de serviço</h2><p className="panel-subtitle">Fila FIFO, análise técnica, orçamento e execução.</p></div><div className="form-actions">{currentUserRole === 'tecnico' && <button className="secondary-button" type="button" onClick={onClaimNext}>Assumir próxima OS</button>}<button className="primary-button" type="button" onClick={() => { onCancelEdit(); setIsFormOpen(true); }}>+ Nova ordem</button></div></div>

      {false && <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid two-columns">
          <label>Cliente<input name="cliente" value={form.cliente} onChange={onChange} placeholder="Nome do cliente" required /></label>
          <label>Técnico responsável<input name="tecnico" value={form.tecnico} onChange={onChange} placeholder="Técnico responsável" required /></label>
          <label>Equipamento<input name="equipamento" value={form.equipamento} onChange={onChange} placeholder="Samsung, Dell, etc." required /></label>
          <label>Status inicial<select name="status" value={form.status} onChange={onChange}><option value="Recebido">Recebido</option><option value="Em Análise">Em Análise</option><option value="Aguardando Peça">Aguardando Peça</option><option value="Aprovado">Aprovado</option></select></label>
          <label>Quantidade de etiquetas<input name="etiquetas" type="number" min="4" max="100" value={form.etiquetas} onChange={onChange} required /></label>
          <label className="full-width">Defeito relatado<textarea name="defeito" value={form.defeito} onChange={onChange} rows="3" required minLength="5" /></label>
          <label className="full-width">Observação inicial<textarea name="observacao" value={form.observacao} onChange={onChange} rows="2" placeholder="Registre o que foi observado na entrada" required minLength="5" /></label>
        </div>
        <div className="order-composition">
          <div className="composition-block"><div className="composition-title">Serviços da OS</div>{Object.entries(serviceGroups).map(([category, categoryServices]) => <details className="service-submenu" key={category} open><summary>{category} <span>{categoryServices.length}</span></summary>{categoryServices.map((service) => <label className="selection-row" key={service.id}><input type="checkbox" checked={form.service_ids?.includes(service.id) || false} onChange={() => toggleService(service.id)} /><span>{service.nome} · {service.modalidade || 'Presencial'}</span><strong>R$ {Number(service.preco_sugerido || 0).toFixed(2)}</strong></label>)}</details>)}</div>
          <div className="composition-block"><div className="composition-title">Peças utilizadas</div>{parts.map((part) => { const selected = form.part_items?.find((item) => item.id === part.id); return <label className="selection-row" key={part.id}><input type="checkbox" checked={Boolean(selected)} onChange={() => togglePart(part.id)} /><span>{part.nome}</span>{selected && <input className="part-quantity" type="number" min="1" value={selected.quantidade} onChange={(event) => changePartQuantity(part.id, event.target.value)} />}<strong>R$ {Number(part.preco_venda || 0).toFixed(2)}</strong></label>; })}</div>
          <div className="order-totals"><span>Análise: <strong>R$ 120,00</strong></span><span>Serviços: <strong>R$ {servicesTotal.toFixed(2)}</strong></span><span>Peças: <strong>R$ {partsTotal.toFixed(2)}</strong></span><span className="approved-total">Total se aprovado: <strong>R$ {approvedTotal.toFixed(2)}</strong></span></div>
        </div>
        <div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Atualizar OS' : 'Abrir OS'}</button>{editingId && <button className="secondary-button" type="button" onClick={onCancelEdit}>Cancelar edição</button>}</div>
      </form>}

      <div className="orders-list">
        {orders.map((order) => <article className="order-row" key={order.id} onClick={() => openDetails(order)}>
          <div><strong>{order.protocolo}</strong><h3>{order.cliente}</h3><span>{order.equipamento || 'Equipamento não informado'}</span></div>
          <div className="order-assignee"><span className="eyebrow">Técnico responsável</span><strong>{order.tecnico || 'Sem técnico'}</strong></div>
          <span className="status-pill neutral">{order.status}</span>
          <div className="table-actions"><button className="primary-button" type="button" onClick={(event) => { event.stopPropagation(); openDetails(order); }}>Ver detalhes</button><button className="secondary-button" type="button" onClick={(event) => { event.stopPropagation(); onEdit(order); setIsFormOpen(true); }}>Editar</button><button className="secondary-button" type="button" onClick={(event) => { event.stopPropagation(); onPrintLabels(order, labelQuantities[order.id] || 4); }}>Etiquetas</button><button className="secondary-button" type="button" onClick={async (event) => { event.stopPropagation(); const response = await onGetContract(order.id); if (response?.contract) setContract(response); }}>Contrato</button><button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); onDelete(order.id); }}>Excluir</button></div>
        </article>)}
        {!orders.length && <div className="empty-state">Nenhuma ordem de serviço cadastrada.</div>}
      </div>

      {contract && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContract(null); }}><div className="modal-panel" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="eyebrow">Documento formal</span><h2>Contrato da OS {contract.order?.protocolo}</h2></div><button className="ghost-button" type="button" onClick={() => setContract(null)}>Fechar</button></div><pre className="contract-content">{contract.contract?.conteudo}</pre><div className="form-actions"><button className="primary-button" type="button" onClick={() => window.print()}>Imprimir contrato</button></div></div></div>}

      {isFormOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
        <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
          <div className="modal-header"><div><span className="eyebrow">Entrada do equipamento</span><h2 id="order-modal-title">{editingId ? 'Editar ordem de serviço' : 'Registrar nova ordem'}</h2></div><button className="ghost-button" type="button" onClick={closeForm}>Fechar</button></div>
          <form className="entity-form" onSubmit={async (event) => { const saved = await onSubmit(event); if (saved !== false) setIsFormOpen(false); }}>
            <div className="form-grid two-columns">
              <label>Cliente<select name="cliente_id" value={form.cliente_id || ''} onChange={onChange} required><option value="">Selecione um cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nome} · {customer.documento}</option>)}</select></label>
              <label>Técnico responsável<select name="tecnico_id" value={form.tecnico_id || ''} onChange={onChange}><option value="">Fila de espera</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name} · {technician.email}</option>)}</select></label>
              <label>Equipamento<select value={isNewEquipment ? '__new__' : form.equipamento} onChange={(event) => { const value = event.target.value; setIsNewEquipment(value === '__new__'); onChange({ target: { name: 'equipamento', value: value === '__new__' ? '' : value } }); }} required={!isNewEquipment}><option value="">Selecione um equipamento</option>{customerEquipment.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}<option value="__new__">Cadastrar novo equipamento</option></select>{isNewEquipment && <input name="equipamento" value={form.equipamento} onChange={onChange} placeholder="Marca, modelo ou identificação" required />}</label>
              <label>Status inicial<select name="status" value={form.status} onChange={onChange}>{columns.map((column) => <option key={column}>{column}</option>)}</select></label>
              <label>Decisão do orçamento<select name="orcamento_status" value={form.orcamento_status || 'pendente'} onChange={onChange}><option value="pendente">Pendente</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option></select></label>
              <label>Quantidade de etiquetas<input name="etiquetas" type="number" min="4" max="100" value={form.etiquetas} onChange={onChange} required /></label>
              <label className="full-width">Defeito relatado<textarea name="defeito" value={form.defeito} onChange={onChange} rows="3" required minLength="5" /></label>
              <label className="full-width">Laudo técnico<textarea name="laudo_tecnico" value={form.laudo_tecnico || ''} onChange={onChange} rows="3" placeholder="Diagnóstico e análise realizada" /></label>
              <label className="full-width">Serviços realizados<textarea name="servicos_realizados" value={form.servicos_realizados || ''} onChange={onChange} rows="3" placeholder="Descreva o trabalho executado" /></label>
              <label className="full-width">Observação inicial<textarea name="observacao" value={form.observacao} onChange={onChange} rows="2" placeholder="Registre o que foi observado na entrada" required minLength="5" /></label>
            </div>
            <div className="modal-section"><div className="composition-title">Checklist de inspeção</div><div className="checklist-modal-list">{checklist.map((item) => <div className="checklist-modal-row" key={item.id}><span>{item.item}</span><select value={item.estado} onChange={(event) => onChecklistStatusChange(item.id, event.target.value)}>{checklistStatusOptions.map((status) => <option key={status}>{status}</option>)}</select><button className="ghost-button" type="button" onClick={() => onChecklistRemoveItem(item.id)}>Remover</button></div>)}</div><input className="checklist-add-input" type="text" placeholder="Adicionar item e pressionar Enter" onKeyDown={(event) => { const value = event.target.value.trim(); if (event.key === 'Enter' && value) { event.preventDefault(); onChecklistAddItem(value); event.target.value = ''; } }} /><label>Observações da inspeção<textarea name="observacao" value={form.observacao} onChange={onChange} rows="3" placeholder="Considerações adicionais da entrada" required minLength="5" /></label></div>
            <div className="order-composition">
              <div className="composition-block services-picker"><div className="composition-title">Serviços cadastrados</div><input className="service-search" value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Buscar serviço por nome, SKU ou categoria" />{Object.entries(serviceGroups).map(([category, categoryServices]) => <details className="service-submenu" key={category} open><summary>{category} <span>{categoryServices.length}</span></summary>{categoryServices.map((service) => <label className="selection-row" key={service.id}><input type="checkbox" checked={form.service_ids?.includes(service.id) || false} onChange={() => toggleService(service.id)} /><span>{service.nome} · {service.modalidade || 'Presencial'}<small>{service.codigo_sku || service.sku || `ID ${service.id}`}</small></span><strong>R$ {Number(service.preco_sugerido || 0).toFixed(2)}</strong></label>)}</details>)}{!filteredServices.length && <p className="empty-state">Nenhum serviço cadastrado encontrado.</p>}</div>
              {canAddParts && <div className="composition-block parts-picker"><button className="collapsible-heading" type="button" onClick={() => setPartsOpen((current) => !current)} aria-expanded={partsOpen}><span>Peças para orçamento</span><span>{partsOpen ? 'Recolher' : `${form.part_items?.length || 0} selecionada(s) · Expandir`}</span></button>{partsOpen && <><input className="service-search" value={partQuery} onChange={(event) => setPartQuery(event.target.value)} placeholder="Pesquisar peça por SKU, nome ou categoria" />{filteredParts.map((part) => { const selected = form.part_items?.find((item) => item.id === part.id); return <label className={`selection-row ${selected ? 'selection-row-selected' : ''}`} key={part.id}><input type="checkbox" checked={Boolean(selected)} onChange={() => togglePart(part.id)} /><span>{part.nome}<small>SKU {part.codigo_sku || part.codigo || 'sem SKU'} · {part.quantidade_estoque ?? 0} em estoque</small></span>{selected && <input className="part-quantity" type="number" min="1" value={selected.quantidade} onChange={(event) => changePartQuantity(part.id, event.target.value)} />}<strong>R$ {Number(part.preco_venda || 0).toFixed(2)}</strong></label>; })}{!filteredParts.length && <p className="empty-state">Nenhuma peça encontrada.</p>}</>}</div>}
              <div className="order-totals"><span>Análise: <strong>R$ 120,00</strong></span><span>Serviços: <strong>R$ {servicesTotal.toFixed(2)}</strong></span><span>Peças: <strong>R$ {partsTotal.toFixed(2)}</strong></span><span className="approved-total">Total se aprovado: <strong>R$ {approvedTotal.toFixed(2)}</strong></span></div>
            </div>
            <div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Atualizar OS' : 'Registrar OS'}</button><button className="secondary-button" type="button" onClick={closeForm}>Cancelar</button></div>
          </form>
        </div>
      </div>}

      {detailsOrder && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOrder(null); }}><div className="modal-panel order-details-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="eyebrow">Detalhes da ordem</span><h2>{detailsOrder.protocolo} · {detailsOrder.cliente}</h2></div><button className="ghost-button" type="button" onClick={() => setDetailsOrder(null)}>Fechar</button></div><section className="phase-section"><div className="phase-section-header"><div><span className="eyebrow">Progresso do atendimento</span><h3>Fase atual: {detailsOrder.status}</h3></div>{updatingPhase && <span className="phase-feedback">Atualizando...</span>}{!updatingPhase && phaseMessage && <span className="phase-feedback">{phaseMessage}</span>}</div><div className="phase-buttons">{columns.map((phase) => <button key={phase} className={detailsOrder.status === phase ? 'phase-button phase-active' : 'phase-button'} type="button" disabled={updatingPhase} onClick={() => changePhase(phase)}>{phase}</button>)}</div></section><nav className="details-tabs" aria-label="Detalhes da ordem">{['resumo', 'historico'].map((tab) => <button key={tab} className={detailsTab === tab ? 'tab-active' : ''} type="button" onClick={() => setDetailsTab(tab)}>{tab === 'resumo' ? 'Resumo' : 'Histórico'}</button>)}</nav>{detailsTab === 'resumo' && <div className="details-grid"><div><span className="eyebrow">Cliente</span><strong>{detailsOrder.cliente}</strong></div><div><span className="eyebrow">Técnico</span><strong>{detailsOrder.tecnico || 'Fila de espera'}</strong></div><div><span className="eyebrow">Equipamento</span><strong>{detailsOrder.equipamento}</strong></div><div><span className="eyebrow">Status</span><strong>{detailsOrder.status}</strong></div><div className="details-wide"><span className="eyebrow">Defeito relatado</span><p>{detailsOrder.defeito}</p></div><div className="details-wide"><span className="eyebrow">Checklist e observações</span><p>{detailsOrder.checklist ? JSON.stringify(detailsOrder.checklist) : 'Não informado'}</p></div></div>}{detailsTab === 'historico' && <div className="history-list">{history.map((item) => <div className="history-item" key={item.id}><strong>{item.status}</strong><span>{item.usuario_nome || 'Sistema'} · {new Date(item.created_at).toLocaleString('pt-BR')}</span><p>{item.observacao}</p></div>)}{!history.length && <p className="empty-state">Nenhum histórico registrado.</p>}</div>}</div></div>}
    </section>
  );
}
