import { s } from '../estilos.js'
import { TIPOS_RETENCION, totalRetenciones } from '../cobrosUtils.js'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

// Bloque reutilizable: retenciones sufridas + resumen (neto + retenciones = total imputado a la factura)
export default function RetencionesCobro({ retenciones, certificado, neto, saldo, onChange, onCertificado }) {
  const totRet = totalRetenciones(retenciones)
  const imputado = (parseFloat(neto) || 0) + totRet
  const excede = saldo != null && imputado - saldo > 0.009
  return (
    <div style={{ gridColumn: '1 / -1', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', background: '#F8FAFC' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Retenciones sufridas (opcional)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        {TIPOS_RETENCION.map(t => (
          <div key={t.id}>
            <label style={{ ...s.label, fontSize: '11.5px' }}>{t.label}</label>
            <input type="number" step="0.01" min="0" style={s.input} value={retenciones[t.id]} placeholder="0,00"
              onChange={e => onChange({ ...retenciones, [t.id]: e.target.value })} />
          </div>
        ))}
      </div>
      {totRet > 0 && (
        <div style={{ marginTop: '8px' }}>
          <label style={{ ...s.label, fontSize: '11.5px' }}>Nº de certificado de retención</label>
          <input style={s.input} value={certificado} onChange={e => onCertificado(e.target.value)} placeholder="Opcional" />
        </div>
      )}
      <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#475569', lineHeight: 1.7 }}>
        Recibido en cuenta: <strong>{ars(neto)}</strong> + Retenciones: <strong>{ars(totRet)}</strong><br />
        Se descuenta de la factura: <strong style={{ color: excede ? '#DC2626' : '#0F766E' }}>{ars(imputado)}</strong>
        {excede && <span style={{ color: '#DC2626' }}> — supera el saldo pendiente</span>}
      </div>
    </div>
  )
}
