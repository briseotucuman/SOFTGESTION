import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { FolderOpen, Upload, Download, Trash2, Search } from 'lucide-react'

const c = colores.reportes
const CATEGORIAS = ['Factura de compra', 'Factura de venta', 'Cheque', 'Contrato', 'Comprobante de pago', 'Retención / certificado', 'Impuestos / ARCA', 'Préstamo / banco', 'Personal', 'Otro']
const nombreCli = x => x?.razon_social || x?.nombre_contacto || ''
const fmtTam = b => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const limpiar = n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
const VACIO = { categoria: 'Factura de compra', fecha_documento: new Date().toLocaleDateString('en-CA'), cliente_id: '', proveedor_id: '', nota: '' }

// Archivo digital: PDF y fotos de facturas, cheques, contratos y comprobantes, ordenados por categoría y cliente
export default function Documentos() {
  const [docs, setDocs] = useState([])
  const [cli, setCli] = useState([])
  const [prov, setProv] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(VACIO)
  const [archivos, setArchivos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroCli, setFiltroCli] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarSubida, setMostrarSubida] = useState(false)

  async function cargar() {
    const res = await Promise.all([
      supabase.from('documentos').select('*').order('creado_en', { ascending: false }),
      supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true),
      supabase.from('proveedores').select('id, razon_social').eq('activo', true)
    ])
    const err = res.find(r => r.error); setError(err ? err.error.message : '')
    setDocs(res[0].data || []); setCli(res[1].data || []); setProv(res[2].data || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return docs.filter(d => (!filtroCat || d.categoria === filtroCat) && (!filtroCli || d.cliente_id === filtroCli) &&
      (!q || [d.nombre, d.nota, d.categoria, nombreCli(cli.find(x => x.id === d.cliente_id)), prov.find(x => x.id === d.proveedor_id)?.razon_social].some(v => (v || '').toLowerCase().includes(q))))
  }, [docs, filtroCat, filtroCli, busqueda, cli, prov])

  async function subir(e) {
    e.preventDefault()
    if (!archivos.length) { alert('Elegí al menos un archivo'); return }
    const grande = archivos.find(a => a.size > 15 * 1024 * 1024)
    if (grande) { alert(`"${grande.name}" supera los 15 MB`); return }
    setSubiendo(true)
    const { data: u } = await supabase.auth.getUser()
    const fallos = []
    for (const f of archivos) {
      const carpeta = form.categoria.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()
      const ruta = `${carpeta}/${Date.now()}_${limpiar(f.name)}`
      const { error: e1 } = await supabase.storage.from('documentos').upload(ruta, f, { contentType: f.type || undefined })
      if (e1) { fallos.push(`${f.name}: ${e1.message}`); continue }
      const { error: e2 } = await supabase.from('documentos').insert([{
        categoria: form.categoria, nombre: f.name, ruta, tamano: f.size, tipo_archivo: f.type || null,
        fecha_documento: form.fecha_documento || null, cliente_id: form.cliente_id || null, proveedor_id: form.proveedor_id || null,
        nota: form.nota || null, subido_por: u?.user?.email || null
      }])
      if (e2) { await supabase.storage.from('documentos').remove([ruta]); fallos.push(`${f.name}: ${e2.message}`) }
    }
    setSubiendo(false)
    if (fallos.length) alert('No se pudieron subir:\n' + fallos.join('\n'))
    setArchivos([]); setForm(VACIO); setMostrarSubida(false)
    document.getElementById('sg-doc-archivos') && (document.getElementById('sg-doc-archivos').value = '')
    cargar()
  }
  async function abrir(d) {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.ruta, 120)
    if (error) { alert('No se pudo abrir: ' + error.message); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function borrar(d) {
    if (!window.confirm(`¿Eliminar "${d.nombre}"? No se puede deshacer.`)) return
    await supabase.storage.from('documentos').remove([d.ruta])
    await supabase.from('documentos').delete().eq('id', d.id)
    cargar()
  }

  return (
    <div>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display: 'flex', alignItems: 'center', gap: 9 }}><FolderOpen size={19} /> Documentos</h3>
          <p style={s.cabeceraSubtexto}>{docs.length} archivos guardados</p>
        </div>
        <button style={s.btnPrimario('rgba(255,255,255,0.2)')} onClick={() => setMostrarSubida(!mostrarSubida)}><Upload size={14} /> Subir documentos</button>
      </div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 12, marginBottom: 10 }}>Error: {error}</div>}

      {mostrarSubida && (
        <form onSubmit={subir} style={s.card}>
          <div style={s.grid2}>
            <div><label style={s.label}>Categoría</label>
              <select style={s.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map(x => <option key={x}>{x}</option>)}</select></div>
            <div><label style={s.label}>Fecha del documento</label><input type="date" style={s.input} value={form.fecha_documento} onChange={e => setForm({ ...form, fecha_documento: e.target.value })} /></div>
            <div><label style={s.label}>Cliente (opcional)</label>
              <select style={s.input} value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}><option value="">—</option>{cli.map(x => <option key={x.id} value={x.id}>{nombreCli(x)}</option>)}</select></div>
            <div><label style={s.label}>Proveedor (opcional)</label>
              <select style={s.input} value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value })}><option value="">—</option>{prov.map(x => <option key={x.id} value={x.id}>{x.razon_social}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Nota (opcional)</label><input style={s.input} value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} placeholder="Ej.: Factura A 0001-00001234, cheque N° 5567…" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={s.label}>Archivos (PDF, fotos, Excel; hasta 15 MB cada uno)</label>
              <input id="sg-doc-archivos" type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.csv,.doc,.docx" onChange={e => setArchivos([...e.target.files])} style={s.input} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
            <button type="button" style={s.btnSecundario} onClick={() => setMostrarSubida(false)}>Cancelar</button>
            <button type="submit" disabled={subiendo} style={s.btnPrimario('#1e40af')}>{subiendo ? 'Subiendo…' : `Subir${archivos.length ? ` (${archivos.length})` : ''}`}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
          <input style={{ ...s.buscador, paddingLeft: 32 }} placeholder="Buscar documento…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select style={{ ...s.input, width: 'auto' }} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}><option value="">Todas las categorías</option>{CATEGORIAS.map(x => <option key={x}>{x}</option>)}</select>
        <select style={{ ...s.input, width: 'auto' }} value={filtroCli} onChange={e => setFiltroCli(e.target.value)}><option value="">Todos los clientes</option>{cli.map(x => <option key={x.id} value={x.id}>{nombreCli(x)}</option>)}</select>
      </div>

      {cargando ? <p style={{ color: '#64748b' }}>Cargando…</p> : lista.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>{docs.length ? 'No hay documentos con esos filtros.' : 'Todavía no hay documentos. Subí el primero con "Subir documentos".'}</div>
      ) : (
        <div style={{ ...s.card, padding: 0, overflowX: 'auto' }}>
          <table style={s.tabla}>
            <thead><tr>{['Documento', 'Categoría', 'Fecha', 'Cliente / proveedor', 'Nota', 'Tamaño', ''].map((h, i) => <th key={i} style={s.tablaCabecera()}>{h}</th>)}</tr></thead>
            <tbody>
              {lista.map((d, i) => (
                <tr key={d.id} style={s.tablaFila(i)}>
                  <td style={s.tablaCellBold}>{d.nombre}</td>
                  <td style={s.tablaCell}><span style={s.badge('#dbeafe', '#1d4ed8')}>{d.categoria}</span></td>
                  <td style={s.tablaCell}>{d.fecha_documento ? d.fecha_documento.split('-').reverse().join('/') : '—'}</td>
                  <td style={s.tablaCell}>{nombreCli(cli.find(x => x.id === d.cliente_id)) || prov.find(x => x.id === d.proveedor_id)?.razon_social || '—'}</td>
                  <td style={{ ...s.tablaCell, maxWidth: 240 }}>{d.nota || '—'}</td>
                  <td style={s.tablaCell}>{d.tamano ? fmtTam(d.tamano) : '—'}</td>
                  <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>
                    <button style={{ ...s.btnPrimario('#1e40af'), padding: '5px 10px', fontSize: 12 }} onClick={() => abrir(d)} title="Abrir"><Download size={14} /></button>{' '}
                    <button style={s.btnPeligro} onClick={() => borrar(d)} title="Eliminar"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
