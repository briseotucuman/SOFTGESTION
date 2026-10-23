import { s } from '../estilos.js'
import { chequeVacio, totalCheques } from '../cobrosUtils.js'
import { Plus, Trash2 } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const sumarDias = (f, d) => { const x = new Date(f + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().split('T')[0] }

// Uno o varios cheques (p. ej. diferidos a 30/60/90 días) cargados desde el modal de cobro/pago
export default function DatosCheque({ cheques, onChange, propio = false }) {
  const set = (i, k, v) => onChange(cheques.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const agregar = () => {
    const ult = cheques[cheques.length - 1]
    onChange([...cheques, { ...chequeVacio(), librador: ult.librador, banco: ult.banco, fecha_emision: ult.fecha_emision, fecha_vencimiento: sumarDias(ult.fecha_vencimiento, 30) }])
  }
  return (
    <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{propio ? 'Cheques que emitís' : 'Cheques recibidos'} ({cheques.length})</div>
      {cheques.map((ch, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ fontSize: 12, color: '#475569' }}>Cheque {i + 1}</strong>
            {cheques.length > 1 && <button type="button" onClick={() => onChange(cheques.filter((_, j) => j !== i))} style={{ marginLeft: 'auto', border: 0, background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>}
          </div>
          <div style={s.grid2}>
            <div><label style={s.label}>Número *</label><input style={s.input} value={ch.numero} onChange={e => set(i, 'numero', e.target.value)} /></div>
            <div><label style={s.label}>Importe ($) *</label><input type="number" step="0.01" style={s.input} value={ch.importe} onChange={e => set(i, 'importe', e.target.value)} /></div>
            <div><label style={s.label}>Banco</label><input style={s.input} value={ch.banco} onChange={e => set(i, 'banco', e.target.value)} /></div>
            <div><label style={s.label}>{propio ? 'Beneficiario' : 'Librador'}</label><input style={s.input} value={ch.librador} onChange={e => set(i, 'librador', e.target.value)} /></div>
            <div><label style={s.label}>Fecha de emisión *</label><input type="date" style={s.input} value={ch.fecha_emision} onChange={e => set(i, 'fecha_emision', e.target.value)} /></div>
            <div><label style={s.label}>Fecha de vencimiento *</label><input type="date" style={s.input} value={ch.fecha_vencimiento} onChange={e => set(i, 'fecha_vencimiento', e.target.value)} /></div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" style={s.btnSecundario} onClick={agregar}><Plus size={13} style={{ verticalAlign: '-2px' }} /> Agregar otro cheque</button>
        <span style={{ fontSize: 13 }}>Total cheques: <strong>{ars(totalCheques(cheques))}</strong></span>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
        {propio
          ? 'Quedan como emitidos; el dinero sale de la cuenta cuando marcás cada uno como debitado en Cheques.'
          : 'Quedan en cartera; el dinero entra a la cuenta cuando depositás o cobrás cada uno en Cheques. El importe a cobrar se completa con el total.'}
      </p>
    </div>
  )
}
