import { useRef, useState } from 'react';

const fields = [
  ['hwid_equipamento', 'ID único do hardware (HWID)', 'ID_Equipamento'],
  ['serial_bios', 'Serial BIOS / Placa', 'Serial_BIOS'],
  ['uuid_sistema', 'UUID do sistema', 'UUID_Sistema'],
  ['mac_rede', 'MAC da rede', 'MAC_Rede'],
  ['serial_disco', 'Serial do armazenamento', 'Serial_Disco'],
];

function readHardware(data) {
  return {
    hwid_equipamento: data.hwid_equipamento || data.ID_Equipamento || '',
    serial_bios: data.serial_bios || data.Serial_BIOS || '',
    uuid_sistema: data.uuid_sistema || data.UUID_Sistema || '',
    mac_rede: data.mac_rede || data.MAC_Rede || '',
    serial_disco: data.serial_disco || data.Serial_Disco || '',
    especificacoes_json: data.especificacoes_json || {
      Processador: data.Processador || '',
      Memoria_RAM: data.Memoria_RAM || '',
      Armazenamento: data.Armazenamento || '',
      Data_Cadastro: data.Data_Cadastro || '',
    },
  };
}

export default function HardwareAuditPanel({ value, onChange, orderId, onValidate }) {
  const fileRef = useRef(null);
  const [validation, setValidation] = useState(null);
  const hardware = value || {};

  const update = (name, nextValue) => onChange({ ...hardware, [name]: nextValue });
  const importJson = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { onChange({ ...hardware, ...readHardware(JSON.parse(String(reader.result))) }); } catch { window.alert('O arquivo selecionado não é um JSON válido.'); }
      event.target.value = '';
    };
    reader.readAsText(file);
  };
  const validate = async () => {
    if (!orderId || !onValidate) return;
    try { const result = await onValidate(orderId, hardware); setValidation(result?.validation || null); } catch (error) { setValidation({ status: 'erro', divergencias: [error.message] }); }
  };

  return (
    <section className="hardware-audit-panel">
      <div className="composition-title">Auditoria do equipamento</div>
      <p className="panel-subtitle">Importe o JSON da bancada para registrar a identidade física e validar a garantia.</p>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={importJson} hidden />
      <button className="secondary-button" type="button" onClick={() => fileRef.current?.click()}>Importar JSON do script</button>
      {orderId && <button className="secondary-button" type="button" onClick={validate}>Validar garantia com este JSON</button>}
      <div className="hardware-audit-grid">
        {fields.map(([name, label, placeholder]) => <label key={name}>{label}<input value={hardware[name] || ''} maxLength={name === 'hwid_equipamento' ? 16 : undefined} onChange={(event) => update(name, event.target.value)} placeholder={placeholder} /></label>)}
      </div>
      <small className="hardware-audit-specs">{Object.entries(hardware.especificacoes_json || {}).filter(([, item]) => item).map(([key, item]) => `${key}: ${item}`).join(' · ') || 'CPU, RAM e armazenamento serão preenchidos pelo JSON.'}</small>
      {validation?.status === 'autentico' && <strong className="hardware-valid hardware-validation-message">[✓ EQUIPAMENTO AUTÊNTICO - GARANTIA VÁLIDA]</strong>}
      {validation?.status === 'divergente' && <div className="hardware-invalid hardware-validation-message">[⚠ ALERTA DE DIVERGÊNCIA - POSSÍVEL TROCA DE COMPONENTE]<span>{validation.divergencias.join(' · ')}</span></div>}
    </section>
  );
}
