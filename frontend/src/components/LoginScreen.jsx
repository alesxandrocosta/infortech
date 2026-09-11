import { useState } from 'react';

export default function LoginScreen({ onLogin, error, loading, onCustomerAccess }) {
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(form);
  };

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">TF</div>
        <p className="eyebrow">TechFlow ERP</p>
        <h1>Acesso ao sistema</h1>
        <p className="login-copy">Entre para acompanhar ordens, clientes e operações técnicas.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>E-mail ou usuário<input name="email" type="text" value={form.email} onChange={handleChange} autoComplete="username" required /></label>
          <label>Senha<input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="current-password" required /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="social-login-divider"><span>ou continue com</span></div>
        <div className="social-login-buttons"><a href="http://localhost:5000/api/auth/oauth/google" className="social-login-button google">Google</a><a href="http://localhost:5000/api/auth/oauth/microsoft" className="social-login-button microsoft">Microsoft</a><a href="http://localhost:5000/api/auth/oauth/apple" className="social-login-button apple">Apple</a></div>
        <button className="portal-access-button" type="button" onClick={onCustomerAccess}>Acessar área do cliente</button>
      </section>
    </main>
  );
}
