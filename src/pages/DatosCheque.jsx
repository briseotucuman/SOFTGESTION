import { s } from '../estilos.js'

// Campos del cheque que se muestran en los modales de cobro/pago cuando el medio es "cheque"
export default function DatosCheque({ valor, onChange, propio = false }) {
  const set = (k, v) => onChange({ ...valor, [k]: v })
  return (
    <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{propio ? 'Datos del cheque que emitís' : 'Datos del cheque recibido'}</div>
      <div style={s.grid2}>
        <div><label style={s.label}>Número de cheque *</label><input style={s.input} value={valor.numero} onChange={e => set('numero', e.target.value)} /></div>
        <div><label style={s.label}>Banco</label><input style={s.input} value={valor.banco} onChange={e => set('banco', e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>{propio ? 'Beneficiario (opcional)' : 'Librador (opcional)'}</label><input style={s.input} value={valor.librador} onChange={e => set('librador', e.target.value)} /></div>
        <div><label style={s.label}>Fecha de emisión *</label><input type="date" style={s.input} value={valor.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} /></div>
        <div><label style={s.label}>Fecha de vencimiento *</label><input type="date" style={s.input} value={valor.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} /></div>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
        {propio
          ? 'El cheque queda como emitido y el dinero sale de la cuenta recién cuando lo marcás como debitado en Cheques.'
          : 'El cheque queda en cartera y el dinero entra a la cuenta recién cuando lo depositás o cobrás en Cheques.'}
      </p>
    </div>
  )
}
