import { useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { extraerPaginas } from '../importarPdf.js'
import { parsearRecibos } from '../parsersPdf.js'
import { Upload, X } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const limpio = c => String(c || '').replace(/\s/g, '')

// Sube el PDF de recibos de haberes, lo lee, muestra una vista previa y guarda las liquidaciones con su detalle
export default function ImportarRecibos({ onListo, onCerrar }) {
  const [recibos, setRecibos] = useState(null)
  const [empleados, setEmpleados] = useState([])
  const [existentes, setExistentes] = useState({})
  const [reemplazar, setReemplazar] = useState(false)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const leer = async e => {
    const f = e.target.files?.[0]; if (!f) return
    setError(''); setRecibos(null); setEstado('Leyendo el PDF…')
    try {
      const rs = parsearRecibos(await extraerPaginas(f))
      if (!rs.length) throw new Error('No se encontraron recibos de haberes en el archivo.')
      const [{ data: emps }, { data: liqs }] = await Promise.all([
        supabase.from('empleados').select('id, nombre, apellido, cuil'),
        supabase.from('liquidaciones_sueldo').select('id, empleado_id, periodo').in('periodo', [...new Set(rs.map(r => r.periodo))])
      ])
      setEmpleados(emps || []); setExistentes(Object.fromEntries((liqs || []).map(l => [`${l.empleado_id}|${l.periodo}`, l.id])))
      setRecibos(rs); setEstado('')
    } catch (err) { setError(err.message || String(err)); setEstado('') }
  }

  const filas = useMemo(() => (recibos || []).map(r => {
    const emp = empleados.find(e => limpio(e.cuil) === r.cuil)
    return { r, emp, existe: emp ? existentes[`${emp.id}|${r.periodo}`] : null }
  }), [recibos, empleados, existentes])
  const aImportar = filas.filter(f => f.emp && (!f.existe || reemplazar))
  const sinEmpleado = filas.filter(f => !f.emp)

  const guardar = async () => {
    setTrabajando(true); setError('')
    try {
      for (const { r, emp, existe } of aImportar) {
        if (existe) await supabase.from('liquidaciones_sueldo').delete().eq('id', existe)
        const cm = n => r.conceptos.filter(c => c.concepto === n).reduce((a, c) => a + c.monto, 0)
        const basico = cm('Sueldo Básico')
        const { data: liq, error: e1 } = await supabase.from('liquidaciones_sueldo').insert([{
          empleado_id: emp.id, periodo: r.periodo, fecha_pago: r.fecha_pago, sueldo_basico: basico, horas_extra: 0, bonificaciones: Math.round((r.bruto - basico) * 100) / 100,
          descuento_jubilacion: cm('Jubilación'), descuento_obra_social: cm('Obra Social'), descuento_sindical: cm('Aporte Sindical'), otros_descuentos: cm('Ley 19.032'),
          total_bruto: r.bruto, total_descuentos: r.descuentos, total_neto: r.neto, estado: 'pendiente', observaciones: 'Recibo de haberes importado desde PDF',
          legajo: r.legajo, categoria: r.categoria, cuil: r.cuil, fecha_ingreso: r.ingreso, antiguedad_anios: r.antiguedad, banco: r.banco, periodo_aportes: r.periodo_aportes,
          remunerativo: r.remunerativo, no_remunerativo: r.no_remunerativo, contribuciones_empleador: r.contribuciones, costo_empleador: r.costo, origen: 'recibo'
        }]).select('id').single()
        if (e1) throw e1
        const { error: e2 } = await supabase.from('liquidacion_conceptos').insert(r.conceptos.map((c, i) => ({ liquidacion_id: liq.id, orden: i + 1, tipo: c.tipo, concepto: c.concepto, unidad: c.unidad || null, base: c.base, monto: c.monto })))
        if (e2) throw e2
      }
      onListo(aImportar[0]?.r.periodo)
    } catch (err) {
      setError((err.message || String(err)) + (/liquidacion_conceptos|schema cache|column/i.test(err.message || '') ? ' — ¿Ejecutaste sueldos_f931_softgestion.sql en Supabase?' : ''))
    }
    setTrabajando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ ...s.card, width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Importar recibos de sueldo (PDF)</h3>
          <button style={s.btnSecundario} onClick={onCerrar}><X size={14} /></button>
        </div>
        <label style={{ ...s.btnPrimario('#1e40af'), display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <Upload size={14} /> Elegir PDF de recibos
          <input type="file" accept="application/pdf" onChange={leer} style={{ display: 'none' }} />
        </label>
        {estado && <p style={{ color: paleta.muted }}>{estado}</p>}
        {error && <p style={{ color: paleta.danger }}>{error}</p>}
        {recibos && (<>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr>{['Legajo', 'Empleado', 'Período', 'Bruto', 'Descuentos', 'Neto', 'Costo empleador', 'Estado'].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '7px 9px' }}>{h}</th>)}</tr></thead>
              <tbody>{filas.map(({ r, emp, existe }) => (
                <tr key={r.legajo + r.cuil} style={{ borderTop: `1px solid ${paleta.line}` }}>
                  <td style={{ padding: '6px 9px' }}>{r.legajo}</td><td style={{ padding: '6px 9px', fontWeight: 600 }}>{r.apellido}, {r.nombre}</td><td style={{ padding: '6px 9px' }}>{r.periodo}</td>
                  <td style={{ padding: '6px 9px' }}>{ars(r.bruto)}</td><td style={{ padding: '6px 9px' }}>{ars(r.descuentos)}</td><td style={{ padding: '6px 9px' }}>{ars(r.neto)}</td><td style={{ padding: '6px 9px' }}>{ars(r.costo)}</td>
                  <td style={{ padding: '6px 9px', color: !emp ? paleta.danger : existe ? paleta.warn : paleta.success }}>
                    {!emp ? `Sin empleado con CUIL ${r.cuil}` : existe ? 'Ya cargado' : 'Nuevo'}{r.avisos.length > 0 && <div style={{ color: paleta.warn, fontSize: 11 }}>{r.avisos.join(' · ')}</div>}
                  </td>
                </tr>))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 13, color: paleta.muted }}>
            Total del lote: bruto {ars(filas.reduce((a, f) => a + f.r.bruto, 0))} · neto {ars(filas.reduce((a, f) => a + f.r.neto, 0))} · costo empleador {ars(filas.reduce((a, f) => a + f.r.costo, 0))}
          </p>
          {sinEmpleado.length > 0 && <p style={{ color: paleta.danger, fontSize: 13 }}>Los recibos sin empleado no se importan: cargá primero a la persona en Personal con su CUIL.</p>}
          {filas.some(f => f.existe) && <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={reemplazar} onChange={e => setReemplazar(e.target.checked)} /> Reemplazar los que ya están cargados</label>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button style={s.btnSecundario} onClick={onCerrar}>Cancelar</button>
            <button style={s.btnPrimario('#15803D')} disabled={trabajando || !aImportar.length} onClick={guardar}>{trabajando ? 'Guardando…' : `Importar ${aImportar.length} recibo(s)`}</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
