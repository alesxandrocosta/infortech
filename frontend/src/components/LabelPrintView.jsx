import { QRCodeSVG } from 'qrcode.react';

export default function LabelPrintView({ job, onClose, onPrint }) {
  if (!job) return null;

  const labels = Array.from({ length: job.quantity }, (_, index) => ({
    id: `${job.order.id}-${index}`,
    number: index + 1,
  }));

  const pages = [];
  for (let index = 0; index < labels.length; index += 4) {
    pages.push(labels.slice(index, index + 4));
  }
  const hardwareUrl = `${window.location.origin}/os/${job.order.id}?hwid=${encodeURIComponent(job.order.hwid_equipamento || '')}`;

  return (
    <div className="print-preview-backdrop">
      <div className="print-preview" role="dialog" aria-modal="true" aria-labelledby="print-preview-title">
        <div className="print-preview-toolbar"><div><span className="eyebrow">Pré-visualização</span><h2 id="print-preview-title">Etiquetas da OS {job.order.protocolo || 'sem protocolo'}</h2><p>{job.quantity} etiqueta(s) · {job.order.cliente || 'Cliente não informado'}</p></div><div className="form-actions"><button className="primary-button" type="button" onClick={onPrint}>Imprimir</button><button className="secondary-button" type="button" onClick={onClose}>Fechar</button></div></div>
        <div className="print-layer">
          {pages.map((page, pageIndex) => (
            <div className="print-sheet" key={`page-${pageIndex}`}>
              {page.map((label) => (
                <article className="print-label" key={label.id}>
                  <div className="label-brand">TECHFLOW ERP</div>
                  <strong className="label-protocol">{job.order.protocolo || 'OS sem protocolo'}</strong>
                  <QRCodeSVG value={hardwareUrl} size={72} level="M" />
                  <div className="label-rule" />
                  <div className="label-row"><span>Cliente</span><strong>{job.order.cliente || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Equipamento</span><strong>{job.order.equipamento || `${job.order.equipamento_marca || ''} ${job.order.equipamento_modelo || ''}`.trim() || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Série</span><strong>{job.order.equipamento_serie || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Status / Técnico</span><strong>{job.order.status || 'Recebido'} · {job.order.tecnico || 'Fila de espera'}</strong></div>
                  <div className="label-row"><span>Defeito</span><strong>{job.order.defeito || 'Não informado'}</strong></div>
                  <div className="label-row"><span>ID Único do Hardware (HWID)</span><strong>{job.order.hwid_equipamento || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Serial BIOS / Placa</span><strong>{job.order.serial_bios || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Serial do Armazenamento</span><strong>{job.order.serial_disco || 'Não informado'}</strong></div>
                  <div className="label-row"><span>Serviços</span><strong>{job.order.servicos || 'Nenhum'}</strong></div>
                  <div className="label-row"><span>Peças</span><strong>{job.order.pecas || 'Nenhuma'}</strong></div>
                  <div className="label-row"><span>Total</span><strong>R$ {Number(job.order.valor_total || 0).toFixed(2)}</strong></div>
                  <div className="label-footer">Etiqueta {label.number}/{job.quantity}</div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
