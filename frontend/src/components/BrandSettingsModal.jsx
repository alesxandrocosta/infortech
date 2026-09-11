import { useState } from 'react';

export default function BrandSettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logo: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel brand-settings-modal" role="dialog" aria-modal="true" aria-labelledby="brand-settings-title">
        <div className="modal-header">
          <div><span className="eyebrow">Identidade visual</span><h2 id="brand-settings-title">Configurar marca</h2></div>
          <button className="ghost-button" type="button" onClick={onClose}>Fechar</button>
        </div>
        <div className="brand-settings-preview">
          {form.logo ? <img src={form.logo} alt="Prévia da logomarca" /> : <span>{form.icon || 'TF'}</span>}
          <strong>{form.displayName || 'Nome da empresa'}</strong>
        </div>
        <form className="entity-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
          <div className="form-grid">
            <label>Nome de exibição<input name="displayName" value={form.displayName} onChange={update} maxLength="40" required /></label>
            <label>Ícone de exibição<input name="icon" value={form.icon} onChange={update} maxLength="4" placeholder="TF" required /></label>
            <label className="full-width">URL da logomarca<input name="logo" value={form.logo.startsWith('data:') ? '' : form.logo} onChange={update} placeholder="https://.../logo.png" /></label>
            <label className="full-width">Ou envie uma imagem<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoUpload} /></label>
          </div>
          <div className="form-actions"><button className="primary-button" type="submit">Salvar identidade</button><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button></div>
        </form>
      </div>
    </div>
  );
}
