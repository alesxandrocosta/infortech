import { useState } from 'react';

const basicFields = [
  ['ID_Equipamento', 'ID do equipamento'],
  ['Fabricante', 'Fabricante'],
  ['Modelo', 'Modelo'],
  ['Processador', 'Processador'],
  ['Geracao_Processador', 'Geração do processador'],
  ['Memoria_RAM', 'Memória RAM'],
  ['Tipo_Memoria', 'Tipo de memória'],
  ['Sistema_Operacional', 'Sistema operacional'],
  ['Versao_SO', 'Versão do sistema'],
  ['Arquitetura_SO', 'Arquitetura'],
  ['Serial_BIOS', 'Serial BIOS'],
  ['UUID_Sistema', 'UUID do sistema'],
  ['Armazenamento', 'Armazenamento'],
];

export default function LocalHardwareModal({ onClose, onRead, onPrint, onRegisterAndPrint }) {
  const [data, setData] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const readLocal = async () => {
    setLoading(true);
    setMessage('Lendo configuração do localhost...');
    try { setData(await onRead()); setMessage('Configuração desta máquina lida. Revise os dados antes de salvar.'); } catch (error) { setMessage(error.message || 'Inicie o cliente-agent.ps1 nesta máquina para ler o hardware local.'); } finally { setLoading(false); }
  };

  const addField = () => {
    if (!fieldName.trim()) return;
    setCustomFields((current) => [...current, { name: fieldName.trim(), value: fieldValue.trim() }]);
    setFieldName('');
    setFieldValue('');
  };

  const print = async () => {
    setLoading(true);
    try {
      await onPrint({ ...data, Campos_Personalizados: Object.fromEntries(customFields.map((item) => [item.name, item.value])) });
      setMessage('Uma etiqueta 100 x 150 mm foi enviada para a pasta monitorada do host.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível enviar a etiqueta para impressão.');
    } finally {
      setLoading(false);
    }
  };

  const registerAndPrint = async () => {
    setLoading(true);
    try {
      const hardware = { ...data, Campos_Personalizados: Object.fromEntries(customFields.map((item) => [item.name, item.value])) };
      await onRegisterAndPrint(hardware);
      setMessage('Máquina cadastrada no banco e etiqueta enviada para impressão.');
    } catch (error) {
      setMessage(error.message || 'Não foi possível cadastrar e imprimir esta máquina.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel hardware-modal" role="dialog" aria-modal="true" aria-labelledby="hardware-modal-title">
        <div className="modal-header"><div><span className="eyebrow">Inventário local</span><h2 id="hardware-modal-title">Ler configuração deste computador</h2></div><button className="ghost-button" type="button" onClick={onClose}>Fechar</button></div>
        <p className="panel-subtitle">A leitura é feita pelo agente local desta máquina, não pelo servidor. Inicie o cliente-agent.ps1 antes de ler.</p>
        {!data && <button className="primary-button" type="button" onClick={readLocal} disabled={loading}>{loading ? 'Lendo máquina local...' : 'Ler configuração desta máquina'}</button>}
        {message && <p className="hardware-modal-message">{message}</p>}
        {data && <>
          <div className="hardware-modal-grid">{basicFields.map(([key, label]) => <label key={key}>{label}<input value={data[key] || ''} onChange={(event) => setData((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div>
          <div className="hardware-custom-fields"><strong>Campos adicionais</strong><div className="hardware-custom-add"><input value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="Nome do campo" /><input value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} placeholder="Valor" /><button className="secondary-button" type="button" onClick={addField}>Adicionar</button></div>{customFields.map((field, index) => <div className="hardware-custom-row" key={`${field.name}-${index}`}><span>{field.name}</span><strong>{field.value || 'Não informado'}</strong><button className="ghost-button" type="button" onClick={() => setCustomFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button></div>)}</div>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="secondary-button" type="button" onClick={print} disabled={loading}>{loading ? 'Processando...' : 'Imprimir etiqueta'}</button><button className="primary-button" type="button" onClick={registerAndPrint} disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar máquina e imprimir'}</button></div>
        </>}
      </div>
    </div>
  );
}
