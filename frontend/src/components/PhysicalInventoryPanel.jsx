export default function PhysicalInventoryPanel({ inventories, stockItems = [], form, editingId, onChange, onSubmit, onEdit, onDelete, onCancelEdit }) {
  return (
    <section className="panel form-panel">
      <div className="panel-header"><div><span className="eyebrow">Operação</span><h2>Inventário físico</h2></div></div>
      <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid"><label>Nome do inventário<input name="nome" value={form.nome} onChange={onChange} required minLength="2" /></label><label>Status<select name="status" value={form.status} onChange={onChange}><option value="Em andamento">Em andamento</option><option value="Finalizado">Finalizado</option></select></label><label className="full-width">Observações<textarea name="observacoes" value={form.observacoes} onChange={onChange} required minLength="5" /></label></div>
        <div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Atualizar inventário' : 'Criar inventário'}</button>{editingId && <button className="secondary-button" type="button" onClick={onCancelEdit}>Cancelar edição</button>}</div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Inventário</th><th>Status</th><th>Observações</th><th>Ações</th></tr></thead><tbody>{inventories.map((inventory) => <tr key={inventory.id}><td>{inventory.nome}</td><td><span className="status-pill neutral">{inventory.status}</span></td><td>{inventory.observacoes}</td><td><div className="table-actions"><button className="secondary-button" type="button" onClick={() => onEdit(inventory)}>Editar</button><button className="ghost-button" type="button" onClick={() => onDelete(inventory.id)}>Excluir</button></div></td></tr>)}</tbody></table></div>
      <div className="panel-header inventory-mirror-header"><div><span className="eyebrow">Sincronizado com estoque</span><h2>Produtos e saídas</h2></div></div>
      <div className="table-wrap"><table><thead><tr><th>Produto</th><th>SKU</th><th>Quantidade</th><th>Status</th><th>Última saída</th></tr></thead><tbody>{stockItems.map((item) => { const movement = item.movements?.[0]; return <tr key={item.id}><td>{item.nome}</td><td>{item.codigo_sku || item.codigo}</td><td>{item.quantidade_estoque}</td><td><span className={`status-pill ${movement?.status === 'Vendido' ? 'risk' : 'ok'}`}>{movement?.status || 'Disponível'}</span></td><td>{movement ? `${movement.origem} · ${movement.responsavel_nome || 'Sistema'} · ${new Date(movement.occurred_at).toLocaleString('pt-BR')} · R$ ${Number(movement.valor || 0).toFixed(2)}` : 'Sem saída registrada'}</td></tr>; })}</tbody></table></div>
    </section>
  );
}
