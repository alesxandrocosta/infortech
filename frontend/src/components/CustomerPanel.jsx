export default function CustomerPanel({ customers, form, editingId, onChange, onSubmit, onEdit, onDelete, onCancelEdit, onCepLookup, cepLoading }) {
  return (
    <section className="panel form-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Clientes</span>
          <h2>Cadastro de clientes</h2>
        </div>
      </div>

      <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid two-columns">
          <label>
            Nome
            <input name="nome" value={form.nome} onChange={onChange} placeholder="Nome do cliente" required minLength="2" />
          </label>

          <label>
            Tipo
            <select name="tipo" value={form.tipo} onChange={onChange}>
              <option value="PF">PF</option>
              <option value="PJ">PJ</option>
            </select>
          </label>

          <label>
            Documento
            <input name="documento" value={form.documento} onChange={onChange} placeholder="CPF ou CNPJ" required />
          </label>

          <label>
            Telefone
            <input name="telefone" value={form.telefone} onChange={onChange} placeholder="(11) 99999-0000" required={ !form.email.trim() } />
          </label>

          <label>
            WhatsApp
            <input name="whatsapp" value={form.whatsapp} onChange={onChange} placeholder="(11) 99999-0000" />
          </label>

          <label className="full-width">
            E-mail
            <input name="email" type="email" value={form.email} onChange={onChange} placeholder="cliente@email.com" required={ !form.telefone.trim() } />
          </label>

          <label>
            CEP
            <div className="inline-form-control">
              <input name="cep" value={form.cep} onChange={onChange} onBlur={() => onCepLookup(form.cep)} placeholder="00000-000" inputMode="numeric" />
              <button className="secondary-button" type="button" onClick={() => onCepLookup(form.cep)} disabled={cepLoading}>
                {cepLoading ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
          </label>

          <label>
            Número da casa
            <input name="numero" value={form.numero} onChange={onChange} placeholder="123" />
          </label>

          <label className="full-width">
            Endereço
            <input name="endereco" value={form.endereco} onChange={onChange} placeholder="Rua, avenida ou logradouro" />
          </label>

          <label>
            Status
            <select name="status" value={form.status} onChange={onChange}>
              <option value="Adimplente">Adimplente</option>
              <option value="Inadimplente">Inadimplente</option>
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">{editingId ? 'Atualizar cliente' : 'Salvar cliente'}</button>
          {editingId && <button className="secondary-button" type="button" onClick={onCancelEdit}>Cancelar edição</button>}
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Contato</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.nome}</td>
                <td>{customer.tipo}</td>
                <td>{customer.telefone || customer.email}</td>
                <td>
                  <span className={`status-pill ${customer.status === 'Inadimplente' ? 'risk' : 'ok'}`}>
                    {customer.status}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => onEdit(customer)}>Editar</button>
                    <button className="ghost-button" type="button" onClick={() => onDelete(customer.id)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
