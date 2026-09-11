export default function UserPanel({ users, form, editingId, onChange, onSubmit, onEdit, onDelete, onCancelEdit }) {
  return (
    <section className="panel form-panel">
      <div className="panel-header"><div><span className="eyebrow">Acesso</span><h2>Usuários e permissões</h2></div></div>
      <form className="entity-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>Nome completo<input name="full_name" value={form.full_name} onChange={onChange} required minLength="2" /></label>
          <label>Telefone<input name="telefone" value={form.telefone} onChange={onChange} required /></label>
          <label>E-mail<input name="email" type="email" value={form.email} onChange={onChange} required /></label>
          <label>Marca associada<input name="marca" value={form.marca || ''} onChange={onChange} required /></label>
          <label>Nome de usuário<input name="username" value={form.username} onChange={onChange} required /></label>
          <label>Senha<input name="password" type="password" value={form.password} onChange={onChange} required={!editingId} minLength="6" /></label>
          <fieldset className="role-selector"><legend>Perfis de acesso</legend>{['admin', 'gerente', 'administrativo', 'atendente', 'tecnico'].map((role) => <label key={role}><input type="checkbox" checked={form.roles?.includes(role) || false} onChange={() => { const roles = form.roles?.includes(role) ? form.roles.filter((item) => item !== role) : [...(form.roles || []), role]; onChange({ target: { name: 'roles', value: roles } }); }} />{role}</label>)}</fieldset>
        </div>
        <div className="form-actions"><button className="primary-button" type="submit">{editingId ? 'Atualizar usuário' : 'Criar usuário'}</button>{editingId && <button className="secondary-button" type="button" onClick={onCancelEdit}>Cancelar edição</button>}</div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.full_name}</td><td>{user.email}</td><td>{user.role}</td><td><div className="table-actions"><button className="secondary-button" type="button" onClick={() => onEdit(user)}>Editar</button><button className="ghost-button" type="button" onClick={() => onDelete(user.id)}>Excluir</button></div></td></tr>)}</tbody></table></div>
    </section>
  );
}
