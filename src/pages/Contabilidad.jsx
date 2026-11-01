import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { generarAsientos, traerTodo, arsC, r2 } from '../contabilidadUtils.js'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'
import ContabilidadInformes from './ContabilidadInformes.jsx'
import ContabilidadImpuestos from './ContabilidadImpuestos.jsx'

const hoyISO = new Date().toISOString().split('T')[0]
const inicioAnio = `${hoyISO.slice(0, 4)}-01-01`
const SOLAPAS = [['diario', 'Libro diario'], ['plan', 'Plan de cuentas'], ['mayor', 'Mayor'], ['sumas', 'Sumas y saldos'], ['balance', 'Balance y resultados'], ['impuestos', 'Impuestos']]
const ORIGEN = { manual: 'Manual', venta: 'Venta', compra: 'Compra', cobro: 'Cobro', pago_compra: 'Pago', movimiento: 'Movimiento', liquidacion: 'Sueldo' }

export default function Contabilidad() {
  const [vista, setVista] = useState('diario')
  const [desde, setDesde] = useState(inicioAnio)
  const [hasta, setHasta] = useState(hoyISO)
  const [cuentas, setCuentas] = useState([])
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [generando, setGenerando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const { data: pc, error: e1 } = await supabase.from('plan_cuentas').select('*').order('codigo')
      if (e1) throw e1
      setCuentas(pc || [])
      const ls = await traerTodo(() => supabase.from('asiento_lineas').select('id, asiento_id, cuenta_id, debe, haber, detalle, cliente_id, asientos!inner(id, numero, fecha, descripcion, origen_tipo)').lte('asientos.fecha', hasta).order('id'))
      setLineas(ls)
    } catch (e) {
      setError(/relation .* does not exist|schema cache|plan_cuentas/i.test(e.message || '')
        ? 'Falta crear las tablas de Contabilidad. Ejecutá el script contabilidad_softgestion.sql en Supabase (SQL Editor).'
        : (e.message || String(e)))
    }
    setCargando(false)
  }, [hasta])
  useEffect(() => { cargar() }, [cargar])

  const generar = async (regenerar) => {
    if (regenerar && !confirm('Se vuelven a generar los asientos automáticos del período (los manuales no se tocan). ¿Continuar?')) return
    setGenerando(true); setError(''); setAviso('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { creados } = await generarAsientos({ desde, hasta, regenerar, usuario: user?.email || null })
      setAviso(creados ? `Se generaron ${creados} asientos nuevos.` : 'No había operaciones nuevas para contabilizar en el período.')
      await cargar()
    } catch (e) { setError(e.message || String(e)) }
    setGenerando(false)
  }

  const ctx = { cuentas, lineas, desde, hasta, recargar: cargar }
  return (
    <div>
      <div style={{ ...s.card, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div><label style={s.label}>Desde</label><input type="date" style={s.input} value={desde} onChange={e => setDesde(e.target.value)} /></div>
        <div><label style={s.label}>Hasta</label><input type="date" style={s.input} value={hasta} onChange={e => setHasta(e.target.value)} /></div>
        <button style={s.btnPrimario('#1e40af')} disabled={generando} onClick={() => generar(false)}>
          <RefreshCw size={14} className={generando ? 'sg-girar' : ''} /> {generando ? 'Contabilizando…' : 'Generar asientos del período'}
        </button>
        <button style={s.btnSecundario} disabled={generando} onClick={() => generar(true)}>Regenerar automáticos</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {SOLAPAS.map(([id, nombre]) => <button key={id} style={vista === id ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVista(id)}>{nombre}</button>)}
      </div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      {aviso && <div style={{ ...s.card, padding: 12, color: paleta.success, background: paleta.successSoft }}>{aviso}</div>}
      {cargando ? <div style={s.card}>Cargando…</div> : !error && (
        vista === 'diario' ? <LibroDiario {...ctx} /> :
        vista === 'plan' ? <PlanCuentas {...ctx} /> :
        vista === 'impuestos' ? <ContabilidadImpuestos {...ctx} /> :
        <ContabilidadInformes {...ctx} vista={vista} />
      )}
    </div>
  )
}

/* ---------------- Libro diario + asiento manual ---------------- */
function LibroDiario({ cuentas, lineas, desde, hasta, recargar }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoyISO)
  const [desc, setDesc] = useState('')
  const [fil, setFil] = useState([{ cuenta: '', debe: '', haber: '' }, { cuenta: '', debe: '', haber: '' }])
  const [msg, setMsg] = useState('')
  const [origen, setOrigen] = useState('todos')
  const nombre = useMemo(() => Object.fromEntries(cuentas.map(c => [c.id, `${c.codigo} ${c.nombre}`])), [cuentas])
  const imputables = cuentas.filter(c => c.imputable && c.activo)

  const asientos = useMemo(() => {
    const m = {}
    lineas.filter(l => l.asientos.fecha >= desde && l.asientos.fecha <= hasta).forEach(l => { (m[l.asiento_id] ||= { ...l.asientos, lineas: [] }).lineas.push(l) })
    return Object.values(m).filter(a => origen === 'todos' || a.origen_tipo === origen).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)
  }, [lineas, desde, hasta, origen])

  const td = { Debe: fil.reduce((a, f) => a + (Number(f.debe) || 0), 0), Haber: fil.reduce((a, f) => a + (Number(f.haber) || 0), 0) }
  const balancea = Math.abs(td.Debe - td.Haber) < 0.005 && td.Debe > 0
  const setF = (i, k, v) => setFil(fil.map((f, j) => j === i ? { ...f, [k]: v } : f))

  const guardar = async () => {
    setMsg('')
    const ls = fil.filter(f => f.cuenta && (Number(f.debe) > 0 || Number(f.haber) > 0))
    if (!desc.trim()) return setMsg('Poné una descripción.')
    if (ls.length < 2 || !balancea) return setMsg('El asiento debe tener al menos 2 líneas y debe = haber.')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: a, error } = await supabase.from('asientos').insert([{ fecha, descripcion: desc.trim(), origen_tipo: 'manual', creado_por: user?.email || null }]).select('id').single()
    if (error) return setMsg(error.message)
    const { error: e2 } = await supabase.from('asiento_lineas').insert(ls.map(f => ({ asiento_id: a.id, cuenta_id: f.cuenta, debe: r2(f.debe), haber: r2(f.haber) })))
    if (e2) { await supabase.from('asientos').delete().eq('id', a.id); return setMsg(e2.message) }
    setDesc(''); setFil([{ cuenta: '', debe: '', haber: '' }, { cuenta: '', debe: '', haber: '' }]); setAbierto(false); recargar()
  }
  const borrar = async a => {
    if (!confirm(`¿Eliminar el asiento N° ${a.numero}?${a.origen_tipo !== 'manual' ? ' Es automático: podés volver a generarlo.' : ''}`)) return
    const { error } = await supabase.from('asientos').delete().eq('id', a.id)
    if (error) alert(error.message); else recargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={s.btnPrimario()} onClick={() => setAbierto(!abierto)}><Plus size={14} /> Asiento manual</button>
        <select style={{ ...s.input, width: 'auto' }} value={origen} onChange={e => setOrigen(e.target.value)}>
          <option value="todos">Todos los orígenes</option>
          {Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: paleta.muted, fontSize: 12, alignSelf: 'center' }}>{asientos.length} asientos en el período</span>
      </div>
      {abierto && (
        <div style={s.card}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 220 }}><label style={s.label}>Descripción</label><input style={s.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ej: Aporte de capital" /></div>
          </div>
          {fil.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <select style={{ ...s.input, flex: '2 1 240px' }} value={f.cuenta} onChange={e => setF(i, 'cuenta', e.target.value)}>
                <option value="">Cuenta…</option>
                {imputables.map(c => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
              </select>
              <input type="number" step="0.01" style={{ ...s.input, flex: '1 1 110px' }} placeholder="Debe" value={f.debe} onChange={e => setFil(fil.map((x, j) => j === i ? { ...x, debe: e.target.value, haber: e.target.value ? '' : x.haber } : x))} />
              <input type="number" step="0.01" style={{ ...s.input, flex: '1 1 110px' }} placeholder="Haber" value={f.haber} onChange={e => setFil(fil.map((x, j) => j === i ? { ...x, haber: e.target.value, debe: e.target.value ? '' : x.debe } : x))} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button style={s.btnSecundario} onClick={() => setFil([...fil, { cuenta: '', debe: '', haber: '' }])}>+ Línea</button>
            <span style={{ fontSize: 13, color: balancea ? paleta.success : paleta.danger, fontWeight: 600 }}>Debe {arsC(td.Debe)} · Haber {arsC(td.Haber)} {balancea ? '✓' : `(diferencia ${arsC(td.Debe - td.Haber)})`}</span>
            <button style={{ ...s.btnPrimario('#15803D'), marginLeft: 'auto' }} onClick={guardar}>Guardar asiento</button>
          </div>
          {msg && <div style={{ color: paleta.danger, marginTop: 8, fontSize: 13 }}>{msg}</div>}
        </div>
      )}
      {asientos.length === 0 && <div style={s.card}>No hay asientos en el período. Tocá <b>Generar asientos del período</b> para contabilizar lo ya cargado en el sistema.</div>}
      {asientos.map(a => (
        <div key={a.id} style={{ ...s.card, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <b>N° {a.numero}</b><span style={{ color: paleta.muted }}>{a.fecha.split('-').reverse().join('/')}</span>
            <span style={{ fontSize: 11, background: paleta.infoSoft, color: paleta.info, borderRadius: 8, padding: '2px 8px' }}>{ORIGEN[a.origen_tipo] || a.origen_tipo}</span>
            <span style={{ flex: 1, minWidth: 160 }}>{a.descripcion}</span>
            <button style={s.btnPeligro} onClick={() => borrar(a)} title="Eliminar"><Trash2 size={12} /></button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {a.lineas.sort((x, y) => (y.debe > 0) - (x.debe > 0)).map(l => (
                  <tr key={l.id}>
                    <td style={{ padding: '3px 6px', paddingLeft: l.haber > 0 ? 28 : 6 }}>{nombre[l.cuenta_id]}{l.detalle ? <span style={{ color: paleta.muted }}> · {l.detalle}</span> : null}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', width: 120, fontFamily: paleta.fontMono }}>{l.debe > 0 ? arsC(l.debe) : ''}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', width: 120, fontFamily: paleta.fontMono }}>{l.haber > 0 ? arsC(l.haber) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Plan de cuentas ---------------- */
function PlanCuentas({ cuentas, lineas, recargar }) {
  const [f, setF] = useState({ codigo: '', nombre: '', tipo: 'activo', padre: '', imputable: true })
  const [msg, setMsg] = useState('')
  const movidas = useMemo(() => new Set(lineas.map(l => l.cuenta_id)), [lineas])
  const padres = cuentas.filter(c => !c.imputable)

  const crear = async () => {
    setMsg('')
    if (!f.codigo.trim() || !f.nombre.trim()) return setMsg('Completá código y nombre.')
    const padre = cuentas.find(c => c.codigo === f.padre)
    const { error } = await supabase.from('plan_cuentas').insert([{ codigo: f.codigo.trim(), nombre: f.nombre.trim(), tipo: padre?.tipo || f.tipo, rubro: padre?.rubro || null, imputable: f.imputable, padre_codigo: f.padre || null }])
    if (error) return setMsg(error.message)
    setF({ codigo: '', nombre: '', tipo: 'activo', padre: '', imputable: true }); recargar()
  }
  const alternar = async c => { await supabase.from('plan_cuentas').update({ activo: !c.activo }).eq('id', c.id); recargar() }
  const borrar = async c => {
    if (!confirm(`¿Eliminar la cuenta ${c.codigo} ${c.nombre}?`)) return
    const { error } = await supabase.from('plan_cuentas').delete().eq('id', c.id)
    if (error) alert('No se puede eliminar (tiene movimientos o subcuentas). Podés desactivarla.'); else recargar()
  }
  const nivel = c => c.codigo.split('.').length - 1

  return (
    <div>
      <div style={{ ...s.card, padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={s.label}>Código</label><input style={{ ...s.input, width: 120 }} value={f.codigo} onChange={e => setF({ ...f, codigo: e.target.value })} placeholder="5.2.08" /></div>
        <div style={{ flex: 1, minWidth: 200 }}><label style={s.label}>Nombre</label><input style={s.input} value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></div>
        <div><label style={s.label}>Cuenta padre</label>
          <select style={s.input} value={f.padre} onChange={e => setF({ ...f, padre: e.target.value })}>
            <option value="">Raíz</option>{padres.map(c => <option key={c.id} value={c.codigo}>{c.codigo} {c.nombre}</option>)}
          </select></div>
        <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={f.imputable} onChange={e => setF({ ...f, imputable: e.target.checked })} /> Imputable</label>
        <button style={s.btnPrimario()} onClick={crear}><Plus size={14} /> Agregar cuenta</button>
        {msg && <div style={{ color: paleta.danger, fontSize: 13, width: '100%' }}>{msg}</div>}
      </div>
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Código', 'Cuenta', 'Tipo', 'Imputable', ''].map(h => <th key={h} style={{ ...s.tablaCabecera?.(), textAlign: 'left', padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} style={{ opacity: c.activo ? 1 : 0.45, borderTop: `1px solid ${paleta.line}` }}>
                <td style={{ padding: '5px 10px', fontFamily: paleta.fontMono }}>{c.codigo}</td>
                <td style={{ padding: '5px 10px', paddingLeft: 10 + nivel(c) * 16, fontWeight: c.imputable ? 400 : 700 }}>{c.nombre}</td>
                <td style={{ padding: '5px 10px', textTransform: 'capitalize' }}>{c.tipo}</td>
                <td style={{ padding: '5px 10px' }}>{c.imputable ? 'Sí' : 'No'}</td>
                <td style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>
                  <button style={s.btnSecundario} onClick={() => alternar(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>{' '}
                  {!c.sistema && !movidas.has(c.id) && <button style={s.btnPeligro} onClick={() => borrar(c)}><Trash2 size={12} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
