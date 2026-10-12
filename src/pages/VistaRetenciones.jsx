import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase.js'
import { s } from '../estilos.js'
import { TIPOS_RETENCION, LABEL_RETENCION } from '../cobrosUtils.js'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

// Retenciones sufridas: créditos fiscales para descontar de impuestos, por mes y por tipo
export default function VistaRetenciones() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    const [a, m] = mes.split('-').map(Number)
    const desde = `${mes}-01`
    const hasta = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
    supabase.from('retenciones_cobro')
      .select('id, tipo, monto, nro_certificado, fecha, facturas(numero_factura, clientes(razon_social, nombre_contacto))')
      .gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false })
      .then(({ data }) => { if (vivo) { setFilas(data || []); setCargando(false) } })
    return () => { vivo = false }
  }, [mes])

  const porTipo = useMemo(() => {
    const t = Object.fromEntries(TIPOS_RETENCION.map(x => [x.id, 0]))
    filas.forEach(f => { t[f.tipo] = (t[f.tipo] || 0) + Number(f.monto) })
    return t
  }, [filas])
  const total = Object.values(porTipo).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input type="month" style={{ ...s.buscador, maxWidth: '200px' }} value={mes} onChange={e => setMes(e.target.value)} />
        <span style={{ fontSize: '13px', color: '#64748B' }}>Retenciones que los clientes te practicaron en el mes (crédito fiscal a tu favor)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        {TIPOS_RETENCION.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>{ars(porTipo[t.id])}</div>
          </div>
        ))}
        <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '12px', color: '#0F766E', fontWeight: 700 }}>Total del mes</div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: '#0F766E', fontFamily: 'monospace' }}>{ars(total)}</div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#64748B' }}>
              <th style={{ padding: '10px' }}>Fecha</th><th style={{ padding: '10px' }}>Cliente</th><th style={{ padding: '10px' }}>Factura</th>
              <th style={{ padding: '10px' }}>Tipo</th><th style={{ padding: '10px' }}>Certificado</th><th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>Cargando…</td></tr>}
            {!cargando && filas.length === 0 && <tr><td colSpan={6} style={{ padding: '16px', color: '#64748B' }}>No hay retenciones cargadas en este mes. Se cargan al registrar un cobro.</td></tr>}
            {filas.map(f => (
              <tr key={f.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '10px' }}>{String(f.fecha).split('-').reverse().join('/')}</td>
                <td style={{ padding: '10px' }}>{f.facturas?.clientes?.razon_social || f.facturas?.clientes?.nombre_contacto || '—'}</td>
                <td style={{ padding: '10px' }}>{f.facturas?.numero_factura || '—'}</td>
                <td style={{ padding: '10px' }}>{LABEL_RETENCION[f.tipo] || f.tipo}</td>
                <td style={{ padding: '10px' }}>{f.nro_certificado || '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace' }}>{ars(f.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
