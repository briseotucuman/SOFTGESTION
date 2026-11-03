import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { Plus, Check, RotateCw, Trash2 } from 'lucide-react'

const TIPOS = ['ART', 'Seguro', 'Examen médico', 'Certificado / capacitación', 'Habilitación', 'Ropa de trabajo', 'Impuesto / trámite', 'Otro']
const hoy = new Date().toISOString().split('T')[0]
const fmt = f => String(f).split('-').reverse().join('/')
const dias = f => Math.round((new Date(f + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86400000)
const vacio = { tipo: 'ART', titulo: '', empleado_id: '', cliente_id: '', fecha_vencimiento: '', aviso_dias: 30, observaciones: '' }

// Tablero de vencimientos: documentación del personal, seguros, trámites y fin de contratos
export default function Vencimientos() {
  const [filas, setFilas] = useState([])
  const [contratos, setContratos] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState(vacio)
  const [abierto, setAbierto] = useState(false)
  const [ver, setVer] = useState('pendientes')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [v, c, e, cl] = await Promise.all([
      supabase.from('vencimientos').select('*, empleados(nombre, apellido), clientes(razon_social, nombre_contacto)').order('fecha_vencimiento'),
      supabase.from('contratos').select('id, numero_contrato, fecha_fin, clientes(razon_social, nombre_contacto)').eq('estado', 'activo').not('fecha_fin', 'is', null),
      supabase.from('empleados').select('id, nombre, apellido').eq('activo', true).order('apellido'),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true).order('razon_social')
    ])
    if (v.error) setError('Falta crear las tablas nuevas: ejecutá mejoras_softgestion.sql en Supabase (SQL Editor).'); else { setError(''); setFilas(v.data || []) }
    setContratos(c.data || []); setEmpleados(e.data || []); setClientes(cl.data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const todas = useMemo(() => [
    ...filas.map(f => ({ ...f, origen: 'manual', quien: f.empleados ? `${f.empleados.apellido} ${f.empleados.nombre}` : (f.clientes?.razon_social || f.clientes?.nombre_contacto || '') })),
    ...contratos.map(c => ({ id: 'c' + c.id, origen: 'contrato', tipo: 'Contrato', titulo: `Fin del contrato ${c.numero_contrato || ''}`, fecha_vencimiento: c.fecha_fin, aviso_dias: 60, cumplido: false, quien: c.clientes?.razon_social || c.clientes?.nombre_contacto || '' }))
  ].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)), [filas, contratos])

  const estado = f => { const d = dias(f.fecha_vencimiento); return d < 0 ? ['Vencido', paleta.danger, paleta.dangerSoft] : d <= f.aviso_dias ? [d === 0 ? 'Vence hoy' : `Vence en ${d} d`, paleta.warn, paleta.warnSoft] : [`En ${d} d`, paleta.success, paleta.successSoft] }
  const visibles = todas.filter(f => ver === 'todos' || (ver === 'pendientes' ? !f.cumplido : f.cumplido))
  const urgentes = todas.filter(f => !f.cumplido && dias(f.fecha_vencimiento) <= f.aviso_dias).length

  const guardar = async () => {
    if (!form.titulo.trim() || !form.fecha_vencimiento) return setError('Completá el título y la fecha.')
    const { error: e } = await supabase.from('vencimientos').insert([{ ...form, titulo: form.titulo.trim(), empleado_id: form.empleado_id || null, cliente_id: form.cliente_id || null, aviso_dias: Number(form.aviso_dias) || 30, observaciones: form.observaciones || null }])
    if (e) return setError(e.message)
    setForm(vacio); setAbierto(false); cargar()
  }
  const cumplir = async f => { await supabase.from('vencimientos').update({ cumplido: true }).eq('id', f.id); cargar() }
  const renovar = async f => {
    const nueva = prompt('Nueva fecha de vencimiento (AAAA-MM-DD):', `${Number(f.fecha_vencimiento.slice(0, 4)) + 1}${f.fecha_vencimiento.slice(4)}`)
    if (!nueva || !/^\d{4}-\d{2}-\d{2}$/.test(nueva)) return
    await supabase.from('vencimientos').update({ fecha_vencimiento: nueva, cumplido: false }).eq('id', f.id); cargar()
  }
  const borrar = async f => { if (confirm('¿Eliminar este vencimiento?')) { await supabase.from('vencimientos').delete().eq('id', f.id); cargar() } }

  return (
    <div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button style={s.btnPrimario()} onClick={() => setAbierto(!abierto)}><Plus size={14} /> Nuevo vencimiento</button>
        {[['pendientes', 'Pendientes'], ['cumplidos', 'Cumplidos'], ['todos', 'Todos']].map(([id, l]) => <button key={id} style={ver === id ? s.btnPrimario('#1e40af') : s.btnSecundario} onClick={() => setVer(id)}>{l}</button>)}
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: urgentes ? paleta.warn : paleta.success }}>{urgentes ? `${urgentes} requieren atención` : 'Todo al día'}</span>
      </div>
      {abierto && (
        <div style={{ ...s.card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={s.label}>Tipo</label><select style={s.input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></div>
          <div style={{ flex: 1, minWidth: 200 }}><label style={s.label}>Detalle</label><input style={s.input} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: ART — póliza anual" /></div>
          <div><label style={s.label}>Empleado (opcional)</label><select style={s.input} value={form.empleado_id} onChange={e => setForm({ ...form, empleado_id: e.target.value })}><option value="">—</option>{empleados.map(x => <option key={x.id} value={x.id}>{x.apellido} {x.nombre}</option>)}</select></div>
          <div><label style={s.label}>Cliente (opcional)</label><select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}><option value="">—</option>{clientes.map(x => <option key={x.id} value={x.id}>{x.razon_social || x.nombre_contacto}</option>)}</select></div>
          <div><label style={s.label}>Vence</label><input type="date" style={s.input} value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} /></div>
          <div><label style={s.label}>Avisar (días antes)</label><input type="number" style={{ ...s.input, width: 90 }} value={form.aviso_dias} onChange={e => setForm({ ...form, aviso_dias: e.target.value })} /></div>
          <button style={s.btnPrimario('#15803D')} onClick={guardar}>Guardar</button>
        </div>
      )}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{['Estado', 'Tipo', 'Detalle', 'Persona / cliente', 'Vence', ''].map(h => <th key={h} style={{ ...s.tablaCabecera(), padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {visibles.map(f => { const [txt, col, bg] = f.cumplido ? ['Cumplido', paleta.muted, paleta.surfaceMuted] : estado(f); return (
              <tr key={f.id} style={{ borderTop: `1px solid ${paleta.line}` }}>
                <td style={{ padding: '6px 10px' }}><span style={{ background: bg, color: col, borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{txt}</span></td>
                <td style={{ padding: '6px 10px' }}>{f.tipo}</td><td style={{ padding: '6px 10px' }}>{f.titulo}</td><td style={{ padding: '6px 10px' }}>{f.quien}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmt(f.fecha_vencimiento)}</td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{f.origen === 'manual' && <>
                  {!f.cumplido && <button style={s.btnSecundario} title="Marcar cumplido" onClick={() => cumplir(f)}><Check size={13} /></button>}{' '}
                  <button style={s.btnSecundario} title="Renovar" onClick={() => renovar(f)}><RotateCw size={13} /></button>{' '}
                  <button style={s.btnPeligro} onClick={() => borrar(f)}><Trash2 size={12} /></button></>}</td>
              </tr>) })}
          </tbody>
        </table>
        {visibles.length === 0 && <div style={{ padding: 14, color: paleta.muted }}>No hay vencimientos para mostrar.</div>}
      </div>
    </div>
  )
}
