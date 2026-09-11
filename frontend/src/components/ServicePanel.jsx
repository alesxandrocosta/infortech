import { useState } from 'react';

export default function ServicePanel({ services, form, editingId, onChange, onSubmit, onEdit, onDelete, onCancelEdit }) {
  const [detailsService, setDetailsService] = useState(null);
  const [serviceNote, setServiceNote] = useState('');
  return (
    <section className="panel form-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Serviços</span>
          <h2>Catálogo técnico</h2>
        </div>
      </div>

      <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>
            Nome do serviço
            <input name="nome" value={form.nome} onChange={onChange} placeholder="Troca de tela" required minLength="2" />
          </label>

          <label>
            Categoria
            <select name="categoria" value={form.categoria} onChange={onChange}>
              <option value="Troca">Troca</option>
              <option value="Reparo">Reparo</option>
              <option value="Diagnóstico">Diagnóstico</option>
              <option value="Software">Software</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Formatação">Formatação</option>
              <option value="Backup">Backup</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Redes">Redes</option>
              <option value="Suporte">Suporte</option>
            </select>
          </label>

          <label>
            Modalidade
            <select name="modalidade" value={form.modalidade} onChange={onChange}>
              <option value="Presencial">Presencial</option>
              <option value="Remoto">Remoto</option>
            </select>
          </label>

          <label>
            Tempo estimado (h)
            <input name="tempo" type="number" min="0.5" step="0.5" value={form.tempo} onChange={onChange} required />
          </label>

          <label>
            Preço sugerido
            <input name="preco" type="number" min="0.01" step="0.01" value={form.preco} onChange={onChange} required />
          </label>

          <label className="full-width">
            Descrição
            <textarea name="descricao" value={form.descricao} onChange={onChange} placeholder="Detalhes do serviço" />
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {editingId ? 'Atualizar serviço' : 'Salvar serviço'}
          </button>
          {editingId && (
            <button className="secondary-button" type="button" onClick={onCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Categoria</th>
              <th>Modalidade</th>
              <th>Tempo</th>
              <th>Preço</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td><button className="table-link" type="button" onClick={() => { setDetailsService(service); setServiceNote(service.notas || ''); }}>{service.nome}</button></td>
                <td>{service.categoria}</td>
                <td>{service.modalidade || 'Presencial'}</td>
                <td>{service.tempo_estimado_horas ?? service.tempo ?? 0}h</td>
                <td>R$ {Number(service.preco_sugerido ?? service.preco ?? 0).toFixed(2)}</td>
                <td>
                  <div className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => onEdit(service)}>Editar</button>
                    <button className="ghost-button" type="button" onClick={() => onDelete(service.id)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailsService && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsService(null); }}><div className="modal-panel" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="eyebrow">Detalhes do serviço</span><h2>{detailsService.nome}</h2></div><button className="ghost-button" type="button" onClick={() => setDetailsService(null)}>Fechar</button></div><div className="details-grid"><div><span className="eyebrow">Categoria</span><strong>{detailsService.categoria}</strong></div><div><span className="eyebrow">Modalidade</span><strong>{detailsService.modalidade || 'Presencial'}</strong></div><div><span className="eyebrow">Tempo estimado</span><strong>{detailsService.tempo_estimado_horas ?? detailsService.tempo ?? 0}h</strong></div><div><span className="eyebrow">Preço</span><strong>R$ {Number(detailsService.preco_sugerido ?? detailsService.preco ?? 0).toFixed(2)}</strong></div><div className="details-wide"><span className="eyebrow">Descrição</span><p>{detailsService.descricao || 'Sem descrição.'}</p></div><label className="details-wide">Notas e adendos<textarea value={serviceNote} onChange={(event) => setServiceNote(event.target.value)} rows="4" placeholder="Anotações internas do catálogo" /></label></div><div className="form-actions"><button className="primary-button" type="button" onClick={() => { onEdit({ ...detailsService, notas: serviceNote }); setDetailsService(null); }}>Editar com estas notas</button></div></div></div>}
    </section>
  );
}
