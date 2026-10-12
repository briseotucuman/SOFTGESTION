import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Plus, X, Trash2, Pencil, CheckCircle2, Landmark, Undo2, AlertTriangle, CalendarClock, Receipt } from 'lucide-react'
import { fechasMensuales, isoLocal } from '../proyeccionCaja.js'

const c = colores.finanzas

const plata = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const fmtFecha = iso => (iso ? iso.split('-').reverse().join('/') : '—')

const SUGERENCIAS = [
  'IVA', 'Ganancias', 'Ingresos Brutos (IIBB)', 'Monotributo', 'Autónomos', 'Cargas sociales (F.931)',
  'Tasa municipal (TEM)', 'Impuesto a los sellos', 'Plan de pagos AFIP', 'Seguro',
]
const TIPO_LABEL = { prestamo: 'Préstamo', impuesto: 'Impuesto', otro: 'Otro egreso' }
const TIPO_COLOR = {
  prestamo: { bg: '#e0e7ff', color: '#4338ca' },
  impuesto: { bg: '#f5f3ff', color: '#7c3aed' },
  otro: { bg: '#f1f5f9', color: '#475569' },
}

const hoyISO = () => isoLocal(new Date())
const formPrestamoVacio = () => ({ entidad: '', descripcion: '', monto_cuota: '', cuotas_totales: '', cuota_inicial: '1', primer_vencimiento: hoyISO(), monto_total: '' })
const formImpuestoVacio = () => ({ concepto: '', tipo: 'impuesto', monto: '', fecha_vencimiento: hoyISO(), repetir: 'una', meses: '12' })

function Compromisos({ cuentas = [], onCambio }) {
  const [compromisos, setCompromisos] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('pendientes')
  const [formPrestamo, setFormPrestamo] = useState(null)
  const [formImpuesto, setFormImpuesto] = useState(null)
  const [pagando, setPagando] = useState(null)
  const [formPago, setFormPago] = useState({ monto: '', fecha_pago: hoyISO(), cuenta_id: '', medio_pago: 'transferencia', referencia: '' })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: comp }, { data: prest }] = await Promise.all([
      supabase.from('compromisos_pago').select('*').order('fecha_vencimiento', { ascending: true }),
      supabase.from('prestamos').select('*').eq('activo', true).order('creado_en', { ascending: false }),
    ])
    setCompromisos(comp || [])
    setPrestamos(prest || [])
    setLoading(false)
  }

  async function refrescar() {
    await cargar()
    if (onCambio) await onCambio()
  }

  // ---------- Alta de préstamo ----------
  async function guardarPrestamo(e) {
    e.preventDefault()
    const f = formPrestamo
    const cuota = parseFloat(f.monto_cuota)
    const total = parseInt(f.cuotas_totales, 10)
    const inicial = parseInt(f.cuota_inicial, 10) || 1
    if (!(cuota > 0)) { alert('Ingresá el monto de la cuota'); return }
    if (!(total >= 1) || inicial < 1 || inicial > total) { alert('Revisá la cantidad de cuotas y el número de la primera cuota a cargar'); return }
    setGuardando(true)
    const { data: pr, error } = await supabase.from('prestamos').insert([{
      entidad: f.entidad.trim(), descripcion: f.descripcion.trim() || null, monto_cuota: cuota, cuotas_totales: total,
      monto_total: f.monto_total ? parseFloat(f.monto_total) : null,
    }]).select('id').single()
    if (error) { setGuardando(false); alert('Error: ' + error.message); return }
    const fechas = fechasMensuales(f.primer_vencimiento, total - inicial + 1)
    const filas = fechas.map((fecha, i) => ({
      tipo: 'prestamo', prestamo_id: pr.id, concepto: `Préstamo ${f.entidad.trim()}`,
      numero_cuota: inicial + i, total_cuotas: total, monto: cuota, fecha_vencimiento: fecha,
    }))
    const { error: err2 } = await supabase.from('compromisos_pago').insert(filas)
    if (err2) {
      await supabase.from('prestamos').delete().eq('id', pr.id)
      setGuardando(false); alert('Error al generar las cuotas: ' + err2.message); return
    }
    setGuardando(false)
    setFormPrestamo(null)
    await refrescar()
  }

  // ---------- Alta de impuesto / otro egreso ----------
  async function guardarImpuesto(e) {
    e.preventDefault()
    const f = formImpuesto
    const monto = parseFloat(f.monto)
    if (!(monto >= 0) || f.monto === '') { alert('Ingresá el importe'); return }
    const cantidad = f.repetir === 'mensual' ? Math.max(2, Math.min(60, parseInt(f.meses, 10) || 12)) : 1
    const serie = f.repetir === 'mensual' ? crypto.randomUUID() : null
    const filas = fechasMensuales(f.fecha_vencimiento, cantidad).map(fecha => ({
      tipo: f.tipo, concepto: f.concepto.trim(), monto, fecha_vencimiento: fecha, serie_id: serie,
    }))
    setGuardando(true)
    const { error } = await supabase.from('compromisos_pago').insert(filas)
    setGuardando(false)
    if (error) { alert('Error: ' + error.message); return }
    setFormImpuesto(null)
    await refrescar()
  }

  // ---------- Pago ----------
  function abrirPago(cp) {
    setPagando(cp)
    setFormPago({ monto: String(cp.monto), fecha_pago: hoyISO(), cuenta_id: '', medio_pago: 'transferencia', referencia: '' })
  }

  async function ajustarSaldo(cuenta_id, delta) {
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + delta }).eq('id', cuenta_id)
  }

  async function confirmarPago(e) {
    e.preventDefault()
    const monto = parseFloat(formPago.monto)
    if (!(monto > 0)) { alert('Ingresá el monto pagado'); return }
    if (!formPago.cuenta_id) { alert('Elegí de qué cuenta sale el pago'); return }
    setGuardando(true)
    const categoria = pagando.tipo === 'prestamo' ? 'Préstamos' : pagando.tipo === 'impuesto' ? 'Impuestos' : 'Otro egreso'
    const detalle = pagando.numero_cuota ? ` — cuota ${pagando.numero_cuota}/${pagando.total_cuotas}` : ''
    const { data: mov, error } = await supabase.from('movimientos_financieros').insert([{
      fecha: formPago.fecha_pago, tipo: 'egreso', categoria,
      descripcion: `${pagando.concepto}${detalle}`, monto, cuenta_id: formPago.cuenta_id,
      comprobante: formPago.referencia || null,
      forma_pago: formPago.medio_pago.charAt(0).toUpperCase() + formPago.medio_pago.slice(1),
    }]).select('id').single()
    if (error) { setGuardando(false); alert('Error: ' + error.message); return }
    await ajustarSaldo(formPago.cuenta_id, -monto)
    await supabase.from('compromisos_pago').update({
      estado: 'pagado', fecha_pago: formPago.fecha_pago, cuenta_id: formPago.cuenta_id, movimiento_id: mov.id, monto,
    }).eq('id', pagando.id)
    setGuardando(false)
    setPagando(null)
    await refrescar()
  }

  async function deshacerPago(cp) {
    if (!window.confirm('¿Deshacer este pago? Se elimina el egreso registrado y se devuelve el importe a la cuenta.')) return
    if (cp.movimiento_id) {
      const { data: mov } = await supabase.from('movimientos_financieros').select('monto, cuenta_id').eq('id', cp.movimiento_id).single()
      if (mov?.cuenta_id) await ajustarSaldo(mov.cuenta_id, Number(mov.monto))
      await supabase.from('movimientos_financieros').delete().eq('id', cp.movimiento_id)
    }
    await supabase.from('compromisos_pago').update({ estado: 'pendiente', fecha_pago: null, cuenta_id: null, movimiento_id: null }).eq('id', cp.id)
    await refrescar()
  }

  // ---------- Edición y baja ----------
  async function guardarEdicion(e) {
    e.preventDefault()
    const monto = parseFloat(editando.monto)
    if (!(monto >= 0)) { alert('Importe inválido'); return }
    await supabase.from('compromisos_pago').update({
      concepto: editando.concepto.trim(), monto, fecha_vencimiento: editando.fecha_vencimiento,
    }).eq('id', editando.id)
    setEditando(null)
    await refrescar()
  }

  async function eliminarUno(cp) {
    if (cp.estado === 'pagado') { alert('Para eliminar un pago ya registrado, primero deshacelo.'); return }
    if (!window.confirm(`¿Eliminar este vencimiento (${cp.concepto}, ${fmtFecha(cp.fecha_vencimiento)})?`)) return
    await supabase.from('compromisos_pago').delete().eq('id', cp.id)
    await refrescar()
  }

  async function eliminarSerie(cp) {
    if (!window.confirm(`¿Eliminar todos los vencimientos pendientes de "${cp.concepto}" que se repiten cada mes? Los ya pagados se conservan.`)) return
    await supabase.from('compromisos_pago').delete().eq('serie_id', cp.serie_id).eq('estado', 'pendiente')
    await refrescar()
  }

  async function eliminarPrestamo(pr) {
    const cuotas = compromisos.filter(x => x.prestamo_id === pr.id)
    if (cuotas.some(x => x.estado === 'pagado')) {
      if (!window.confirm(`El préstamo "${pr.entidad}" tiene cuotas ya pagadas. Se eliminarán sus cuotas pendientes y el préstamo se da de baja. Los pagos registrados en Movimientos no se tocan. ¿Continuar?`)) return
      await supabase.from('compromisos_pago').delete().eq('prestamo_id', pr.id).eq('estado', 'pendiente')
      await supabase.from('prestamos').update({ activo: false }).eq('id', pr.id)
    } else {
      if (!window.confirm(`¿Eliminar el préstamo "${pr.entidad}" y sus ${cuotas.length} cuotas?`)) return
      await supabase.from('prestamos').delete().eq('id', pr.id)
    }
    await refrescar()
  }

  // ---------- Datos derivados ----------
  const hoy = hoyISO()
  const pendientes = compromisos.filter(x => x.estado === 'pendiente')
  const vencidos = pendientes.filter(x => x.fecha_vencimiento < hoy)
  const en30 = pendientes.filter(x => x.fecha_vencimiento >= hoy && x.fecha_vencimiento <= isoLocal(new Date(Date.now() + 30 * 86400000)))
  const suma = lista => lista.reduce((a, x) => a + Number(x.monto), 0)

  const lista = compromisos
    .filter(x => filtro === 'todos' || (filtro === 'pendientes' ? x.estado === 'pendiente' : x.estado === 'pagado'))
    .sort((a, b) => filtro === 'pagados'
      ? (b.fecha_pago || '').localeCompare(a.fecha_pago || '')
      : a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))

  const modal = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '16px' }
  const modalCaja = { background: '#fff', borderRadius: '16px', padding: '26px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '92vh', overflowY: 'auto' }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ ...s.card, margin: 0, padding: '14px 16px' }}>
          <p style={{ ...s.label, margin: '0 0 4px' }}>Pendiente total</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: paleta.ink }}>{plata(suma(pendientes))}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: paleta.muted }}>{pendientes.length} vencimiento{pendientes.length === 1 ? '' : 's'}</p>
        </div>
        <div style={{ ...s.card, margin: 0, padding: '14px 16px', background: vencidos.length ? '#fef2f2' : '#fff' }}>
          <p style={{ ...s.label, margin: '0 0 4px', color: vencidos.length ? '#b91c1c' : undefined }}>Vencido</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: vencidos.length ? '#b91c1c' : paleta.ink }}>{plata(suma(vencidos))}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: paleta.muted }}>{vencidos.length} sin pagar</p>
        </div>
        <div style={{ ...s.card, margin: 0, padding: '14px 16px' }}>
          <p style={{ ...s.label, margin: '0 0 4px' }}>Próximos 30 días</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#d97706' }}>{plata(suma(en30))}</p>
          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: paleta.muted }}>{en30.length} vencimiento{en30.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => { setFormPrestamo(formPrestamoVacio()); setFormImpuesto(null) }} style={s.btnPrimario(c.main)}>
          <Plus size={14} /> Nuevo préstamo
        </button>
        <button onClick={() => { setFormImpuesto(formImpuestoVacio()); setFormPrestamo(null) }} style={s.btnPrimario('#7c3aed')}>
          <Plus size={14} /> Impuesto u otro egreso
        </button>
      </div>

      {formPrestamo && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 6px', color: c.main, fontWeight: '700' }}><Landmark size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Nuevo préstamo</h4>
          <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: paleta.muted }}>Se generan automáticamente todas las cuotas, una por mes. Si el préstamo ya está en curso, indicá desde qué cuota querés cargar.</p>
          <form onSubmit={guardarPrestamo}>
            <div style={s.grid2}>
              <div><label style={s.label}>Banco o acreedor</label><input style={s.input} value={formPrestamo.entidad} onChange={e => setFormPrestamo({ ...formPrestamo, entidad: e.target.value })} required /></div>
              <div><label style={s.label}>Descripción (opcional)</label><input style={s.input} value={formPrestamo.descripcion} onChange={e => setFormPrestamo({ ...formPrestamo, descripcion: e.target.value })} /></div>
              <div><label style={s.label}>Monto de la cuota ($)</label><input type="number" step="0.01" min="0" style={s.input} value={formPrestamo.monto_cuota} onChange={e => setFormPrestamo({ ...formPrestamo, monto_cuota: e.target.value })} required /></div>
              <div><label style={s.label}>Cantidad total de cuotas</label><input type="number" min="1" max="360" style={s.input} value={formPrestamo.cuotas_totales} onChange={e => setFormPrestamo({ ...formPrestamo, cuotas_totales: e.target.value })} required /></div>
              <div><label style={s.label}>Cargar desde la cuota N°</label><input type="number" min="1" style={s.input} value={formPrestamo.cuota_inicial} onChange={e => setFormPrestamo({ ...formPrestamo, cuota_inicial: e.target.value })} required /></div>
              <div><label style={s.label}>Vencimiento de esa cuota</label><input type="date" style={s.input} value={formPrestamo.primer_vencimiento} onChange={e => setFormPrestamo({ ...formPrestamo, primer_vencimiento: e.target.value })} required /></div>
              <div><label style={s.label}>Monto total del préstamo (opcional)</label><input type="number" step="0.01" min="0" style={s.input} value={formPrestamo.monto_total} onChange={e => setFormPrestamo({ ...formPrestamo, monto_total: e.target.value })} /></div>
            </div>
            {formPrestamo.monto_cuota && formPrestamo.cuotas_totales && parseInt(formPrestamo.cuota_inicial, 10) <= parseInt(formPrestamo.cuotas_totales, 10) && (
              <p style={{ fontSize: '12.5px', color: paleta.inkSoft, margin: '12px 0 0' }}>
                Se cargarán <strong>{parseInt(formPrestamo.cuotas_totales, 10) - (parseInt(formPrestamo.cuota_inicial, 10) || 1) + 1} cuotas</strong> por un total de <strong>{plata((parseInt(formPrestamo.cuotas_totales, 10) - (parseInt(formPrestamo.cuota_inicial, 10) || 1) + 1) * parseFloat(formPrestamo.monto_cuota))}</strong>.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={guardando} style={s.btnPrimario(c.main)}>{guardando ? 'Generando…' : 'Generar cuotas'}</button>
              <button type="button" style={s.btnSecundario} onClick={() => setFormPrestamo(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {formImpuesto && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 16px', color: '#7c3aed', fontWeight: '700' }}><Receipt size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Impuesto u otro egreso con vencimiento</h4>
          <form onSubmit={guardarImpuesto}>
            <div style={s.grid2}>
              <div>
                <label style={s.label}>Concepto</label>
                <input style={s.input} list="sugerencias-impuestos" value={formImpuesto.concepto} onChange={e => setFormImpuesto({ ...formImpuesto, concepto: e.target.value })} required placeholder="Ej: IVA, IIBB, Monotributo…" />
                <datalist id="sugerencias-impuestos">{SUGERENCIAS.map(x => <option key={x} value={x} />)}</datalist>
              </div>
              <div>
                <label style={s.label}>Tipo</label>
                <select style={s.input} value={formImpuesto.tipo} onChange={e => setFormImpuesto({ ...formImpuesto, tipo: e.target.value })}>
                  <option value="impuesto">Impuesto / tasa</option>
                  <option value="otro">Otro egreso (seguro, alquiler, servicio…)</option>
                </select>
              </div>
              <div><label style={s.label}>Importe ($)</label><input type="number" step="0.01" min="0" style={s.input} value={formImpuesto.monto} onChange={e => setFormImpuesto({ ...formImpuesto, monto: e.target.value })} required /></div>
              <div><label style={s.label}>Fecha de vencimiento</label><input type="date" style={s.input} value={formImpuesto.fecha_vencimiento} onChange={e => setFormImpuesto({ ...formImpuesto, fecha_vencimiento: e.target.value })} required /></div>
              <div>
                <label style={s.label}>Repetición</label>
                <select style={s.input} value={formImpuesto.repetir} onChange={e => setFormImpuesto({ ...formImpuesto, repetir: e.target.value })}>
                  <option value="una">Una sola vez</option>
                  <option value="mensual">Todos los meses</option>
                </select>
              </div>
              {formImpuesto.repetir === 'mensual' && (
                <div><label style={s.label}>Durante cuántos meses</label><input type="number" min="2" max="60" style={s.input} value={formImpuesto.meses} onChange={e => setFormImpuesto({ ...formImpuesto, meses: e.target.value })} /></div>
              )}
            </div>
            {formImpuesto.repetir === 'mensual' && (
              <p style={{ fontSize: '12.5px', color: paleta.muted, margin: '12px 0 0' }}>Se crea un vencimiento por mes con el mismo importe; después podés ajustar el monto de cada mes cuando conozcas el valor real.</p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" disabled={guardando} style={s.btnPrimario('#7c3aed')}>{guardando ? 'Guardando…' : 'Guardar'}</button>
              <button type="button" style={s.btnSecundario} onClick={() => setFormImpuesto(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {prestamos.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ ...s.label, marginBottom: '10px' }}>Préstamos activos</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {prestamos.map(pr => {
              const cuotas = compromisos.filter(x => x.prestamo_id === pr.id)
              const pagadas = cuotas.filter(x => x.estado === 'pagado')
              const pend = cuotas.filter(x => x.estado === 'pendiente')
              const prox = pend[0]
              return (
                <div key={pr.id} style={{ ...s.card, margin: 0, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: paleta.ink }}>{pr.entidad}</p>
                      {pr.descripcion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: paleta.muted }}>{pr.descripcion}</p>}
                    </div>
                    <button onClick={() => eliminarPrestamo(pr)} title="Eliminar préstamo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}><Trash2 size={14} /></button>
                  </div>
                  <p style={{ margin: '10px 0 2px', fontSize: '12.5px', color: paleta.inkSoft }}>Cuotas pagadas: <strong>{pagadas.length}</strong> · Pendientes: <strong>{pend.length}</strong></p>
                  <p style={{ margin: '0 0 2px', fontSize: '12.5px', color: paleta.inkSoft }}>Saldo a pagar: <strong>{plata(suma(pend))}</strong></p>
                  {prox && <p style={{ margin: 0, fontSize: '12px', color: prox.fecha_vencimiento < hoy ? '#b91c1c' : paleta.muted }}>Próxima: cuota {prox.numero_cuota}/{prox.total_cuotas} el {fmtFecha(prox.fecha_vencimiento)} · {plata(prox.monto)}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[['pendientes', 'Pendientes'], ['pagados', 'Pagados'], ['todos', 'Todos']].map(([id, label]) => (
          <button key={id} onClick={() => setFiltro(id)} style={filtro === id ? s.btnPrimario(c.main) : s.btnSecundario}>{label}</button>
        ))}
      </div>

      {loading ? <div style={s.empty}>Cargando…</div>
      : lista.length === 0 ? <div style={s.empty}>{filtro === 'pagados' ? 'Todavía no hay pagos registrados.' : 'No hay vencimientos cargados. Agregá un préstamo o un impuesto para empezar.'}</div>
      : (
        <div style={{ ...s.card, padding: 0, overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
          <table style={{ ...s.tabla, minWidth: '760px', width: '100%' }}>
            <thead><tr>{['Vencimiento', 'Concepto', 'Tipo', 'Importe', 'Estado', ''].map(h => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
            <tbody>
              {lista.map((cp, i) => {
                const vencido = cp.estado === 'pendiente' && cp.fecha_vencimiento < hoy
                const tc = TIPO_COLOR[cp.tipo]
                return (
                  <tr key={cp.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap', color: vencido ? '#b91c1c' : undefined }}>
                      {vencido && <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: '-1px' }} />}{fmtFecha(cp.fecha_vencimiento)}
                    </td>
                    <td style={s.tablaCell}>
                      {cp.concepto}{cp.numero_cuota ? <span style={{ color: paleta.muted }}> — cuota {cp.numero_cuota}/{cp.total_cuotas}</span> : null}
                      {cp.serie_id && <span style={{ color: paleta.muted, fontSize: '11px' }}> · mensual</span>}
                    </td>
                    <td style={s.tablaCell}><span style={s.badge(tc.bg, tc.color)}>{TIPO_LABEL[cp.tipo]}</span></td>
                    <td style={{ ...s.tablaCellBold, whiteSpace: 'nowrap' }}>{plata(cp.monto)}</td>
                    <td style={s.tablaCell}>
                      {cp.estado === 'pagado'
                        ? <span style={s.badge('#d1fae5', '#059669')}>Pagado {fmtFecha(cp.fecha_pago)}</span>
                        : <span style={s.badge(vencido ? '#fee2e2' : '#fef3c7', vencido ? '#dc2626' : '#d97706')}>{vencido ? 'Vencido' : 'Pendiente'}</span>}
                    </td>
                    <td style={{ ...s.tablaCell, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {cp.estado === 'pendiente' ? (
                        <>
                          <button onClick={() => abrirPago(cp)} style={{ ...s.btnPrimario('#059669'), padding: '5px 10px', fontSize: '12px', marginRight: '6px' }}><CheckCircle2 size={13} /> Pagar</button>
                          <button onClick={() => setEditando({ ...cp, monto: String(cp.monto) })} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Pencil size={14} /></button>
                          <button onClick={() => eliminarUno(cp)} title="Eliminar este vencimiento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}><Trash2 size={14} /></button>
                          {cp.serie_id && <button onClick={() => eliminarSerie(cp)} title="Eliminar toda la serie mensual pendiente" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '11px', fontWeight: '700' }}>Serie</button>}
                        </>
                      ) : (
                        <button onClick={() => deshacerPago(cp)} title="Deshacer pago" style={{ ...s.btnSecundario, padding: '5px 10px', fontSize: '12px' }}><Undo2 size={13} /> Deshacer</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagando && (
        <div style={modal}>
          <div style={modalCaja}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Registrar pago</h4>
              <button onClick={() => setPagando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              {pagando.concepto}{pagando.numero_cuota ? ` — cuota ${pagando.numero_cuota}/${pagando.total_cuotas}` : ''} · vence el {fmtFecha(pagando.fecha_vencimiento)}
            </p>
            <form onSubmit={confirmarPago}>
              <div style={s.grid2}>
                <div><label style={s.label}>Monto pagado ($)</label><input type="number" step="0.01" min="0" style={s.input} value={formPago.monto} onChange={e => setFormPago({ ...formPago, monto: e.target.value })} required /></div>
                <div>
                  <label style={s.label}>Medio de pago</label>
                  <select style={s.input} value={formPago.medio_pago} onChange={e => setFormPago({ ...formPago, medio_pago: e.target.value })}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Cuenta que paga</label>
                  <select style={s.input} value={formPago.cuenta_id} onChange={e => setFormPago({ ...formPago, cuenta_id: e.target.value })} required>
                    <option value="">Seleccionar cuenta</option>
                    {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>Fecha de pago</label><input type="date" style={s.input} value={formPago.fecha_pago} onChange={e => setFormPago({ ...formPago, fecha_pago: e.target.value })} required /></div>
                <div><label style={s.label}>Referencia</label><input style={s.input} value={formPago.referencia} onChange={e => setFormPago({ ...formPago, referencia: e.target.value })} /></div>
              </div>
              <p style={{ fontSize: '12px', color: paleta.muted, margin: '12px 0 0' }}>Se registra un egreso en Movimientos y se descuenta el importe del saldo de la cuenta.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setPagando(null)}>Cancelar</button>
                <button type="submit" disabled={guardando} style={s.btnPrimario('#059669')}>{guardando ? 'Registrando…' : 'Confirmar pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editando && (
        <div style={modal}>
          <div style={modalCaja}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}><CalendarClock size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editar vencimiento</h4>
              <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
            </div>
            <form onSubmit={guardarEdicion}>
              <div style={s.grid2}>
                <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Concepto</label><input style={s.input} value={editando.concepto} onChange={e => setEditando({ ...editando, concepto: e.target.value })} required /></div>
                <div><label style={s.label}>Importe ($)</label><input type="number" step="0.01" min="0" style={s.input} value={editando.monto} onChange={e => setEditando({ ...editando, monto: e.target.value })} required /></div>
                <div><label style={s.label}>Vencimiento</label><input type="date" style={s.input} value={editando.fecha_vencimiento} onChange={e => setEditando({ ...editando, fecha_vencimiento: e.target.value })} required /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" style={s.btnSecundario} onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" style={s.btnPrimario(c.main)}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Compromisos
