import { checklistStatusOptions } from '../data/checklist';

export default function ChecklistPanel({ checklist, onStatusChange, onAddItem, onRemoveItem, onSave }) {
  return (
    <section className="panel checklist-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Entrada do equipamento</span>
          <h2>Checklist de inspeção</h2>
        </div>
        <button className="primary-button" onClick={onSave}>Salvar checklist</button>
      </div>

      <div className="checklist-list">
        {checklist.map((item) => (
          <div key={item.id} className="check-item">
            <div className="check-label-wrap">
              <span className="check-bullet">{item.id}</span>
              <span className="check-label">{item.item}</span>
            </div>

            <div className="check-controls">
              <select
                value={item.estado}
                onChange={(event) => onStatusChange(item.id, event.target.value)}
                aria-label={`Status do item ${item.item}`}
              >
                {checklistStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <button className="ghost-button" onClick={() => onRemoveItem(item.id)}>
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="add-item-row">
        <input
          type="text"
          placeholder="Adicionar item ao checklist"
          onKeyDown={(event) => {
            const value = event.target.value.trim();
            if (event.key === 'Enter' && value) {
              onAddItem(value);
              event.target.value = '';
            }
          }}
        />
      </div>
    </section>
  );
}
