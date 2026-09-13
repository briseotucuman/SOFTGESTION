import { useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Upload, FileUp, Loader2, AlertTriangle, Trash2, Plus, CheckCircle2, X } from 'lucide-react'

const c = colores.insumos

// ---------- Utilidades de parseo ----------

const NUM_RE = /\d{1,3}(?:\.\d{3})*,\d{2,3}/g
const EXCLUDE_KEYWORDS = /subtotal|percepci|i\.?v\.?a\b|^total\b|\btotal\b|c\.?u\.?i\.?t|cliente\s*:|domicilio\s*:|cond\.?\s*de\s*venta|fecha\s*:|c\.a\.e|comprobante|referencias\s*:|observaciones\s*:|son\s*:|c[oó]digo\s+descripci|resp\.?\s*inscripto|ing\.?\s*brutos|inic\.?\s*activ/i

function parseArgNumber(str) {
  if (!str) return 0
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function buscarCoincidencia(nombre, lista, campo) {
  const n = normalizar(nombre)
  if (!n) return null
  let match = lista.find(x => normalizar(x[campo]) === n)
  if (match) return match
  match = lista.find(x => normalizar(x[campo]).includes(n) || n.includes(normalizar(x[campo])))
  return match || null
}

function fechaToISO(f) {
  const m = (f || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return new Date().toISOString().split('T')[0]
  return `${m[3]}-${m[2]}-${m[1]}`
}

async function extraerLineasPDF(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const lineas = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const filas = {}
    for (const item of content.items) {
      const y = Math.round(item.transform[5])
      if (!filas[y]) filas[y] = []
      filas[y].push({ x: item.transform[4], str: item.str })
    }
    const ys = Object.keys(filas).map(Number).sort((a, b) => b - a)
    for (const y of ys) {
      const texto = filas[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
      if (texto) lineas.push(texto)
    }
  }
  return lineas
}

function detectarProveedor(lineas) {
  for (const l of lineas.slice(0, 15)) {
    if (/s\.?\s*r\.?\s*l\.?|s\.?\s*a\.?\s*s\.?|s\.?\s*a\.?\b/i.test(l) && l.length < 70 && !/factura/i.test(l)) return l.trim()
  }
  return lineas[0]?.trim() || ''
}
function detectarNumeroFactura(lineas) {
  for (const l of lineas) { const m = l.match(/(\d{4,5}-\d{6,8})/); if (m) return m[1] }
  return ''
}
function detectarFecha(lineas) {
  for (const l of lineas) { if (/fecha/i.test(l)) { const m = l.match(/(\d{2}\/\d{2}\/\d{4})/); if (m) return m[1] } }
  for (const l of lineas) { const m = l.match(/(\d{2}\/\d{2}\/\d{4})/); if (m) return m[1] }
  return ''
}
function detectarTotal(lineas) {
  let best = null
  for (const l of lineas) { if (/\btotal\b/i.test(l) && !/subtotal/i.test(l)) { const nums = l.match(NUM_RE); if (nums) best = nums[nums.length - 1] } }
  return best ? parseArgNumber(best) : null
}
function detectarSubtotal(lineas) {
  for (const l of lineas) { if (/subtotal/i.test(l)) { const nums = l.match(NUM_RE); if (nums) return parseArgNumber(nums[0]) } }
  return null
}
function detectarObservaciones(lineas) {
  for (const l of lineas) { const m = l.match(/observaciones\s*:?\s*(.+)/i); if (m) return m[1].trim() }
  return ''
}

function parsearItems(lineas) {
  const items = []
  for (const raw of lineas) {
    const line = raw.trim()
    if (!line || EXCLUDE_KEYWORDS.test(line)) continue
    const nums = line.match(NUM_RE)
    if (!nums || nums.length < 2) {
      if (items.length && line.length > 1 && line.length < 45 && !/^\d+$/.test(line) && /[a-zA-ZÀ-ÿ]/.test(line)) {
        items[items.length - 1].descripcion += ' ' + line
      }
      continue
    }
    const cantidadStr = nums[0]
    const importeStr = nums[nums.length - 1]
    const cantidad = parseArgNumber(cantidadStr)
    const importe = parseArgNumber(importeStr)
    if (cantidad <= 0 || importe <= 0 || cantidad > 100000) continue
    const idx = line.indexOf(cantidadStr)
    if (idx <= 0) continue
    const antes = line.slice(0, idx).trim()
    const codeMatch = antes.match(/^([A-Z0-9]{3,8})\s+(.+)$/)
    const codigo = codeMatch ? codeMatch[1] : ''
    const descripcion = (codeMatch ? codeMatch[2] : antes).trim()
    if (!descripcion || descripcion.length < 3) continue
    const precio_unitario = Math.round((importe / cantidad) * 100) / 100
    items.push({ codigo, descripcion, cantidad, precio_unitario, importe })
  }
  return items
}

// ---------- Componente ----------

function ImportarFactura({ onImportado }) {
  const [estado, setEstado] = useState('idle') // idle | procesando | revision | guardando | listo | error
  const [error, setError] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [proveedorTexto, setProveedorTexto] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [numeroFactura, setNumeroFactura] = useState('')
  const [fecha, setFecha] = useState('')
  const [totalDetectado, setTotalDetectado] = useState(null)
  const [subtotalDetectado, setSubtotalDetectado] = useState(null)
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState([])
  const [proveedoresExistentes, setProveedoresExistentes] = useState([])
  const [insumosExistentes, setInsumosExistentes] = useState([])
  const [clientes, setClientes] = useState([])

  async function manejarArchivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setNombreArchivo(file.name)
    setEstado('procesando')
    setError('')
    try {
      const [{ data: prov }, { data: ins }, { data: cli }] = await Promise.all([
        supabase.from('proveedores').select('*').eq('activo', true),
        supabase.from('insumos').select('*').eq('activo', true),
        supabase.from('clientes').select('id, razon_social, nombre_contacto').eq('activo', true).order('razon_social')
      ])
      setProveedoresExistentes(prov || [])
      setInsumosExistentes(ins || [])
      setClientes(cli || [])

      const lineas = await extraerLineasPDF(file)
      if (lineas.length < 3) throw new Error('No se pudo extraer texto del PDF. Verificá que no sea una imagen escaneada sin texto seleccionable.')

      const provDetectado = detectarProveedor(lineas)
      const itemsDetectados = parsearItems(lineas)
      if (itemsDetectados.length === 0) throw new Error('No se detectaron productos en la factura. Podés cargarlos manualmente abajo.')

      const matchProv = buscarCoincidencia(provDetectado, prov || [], 'razon_social')
      const itemsConMatch = itemsDetectados.map(it => {
        const m = buscarCoincidencia(it.descripcion, ins || [], 'nombre')
        return { ...it, insumo_id: m ? m.id : '' }
      })

      setProveedorTexto(provDetectado)
      setProveedorId(matchProv ? matchProv.id : '')
      setNumeroFactura(detectarNumeroFactura(lineas))
      setFecha(fechaToISO(detectarFecha(lineas)))
      setTotalDetectado(detectarTotal(lineas))
      setSubtotalDetectado(detectarSubtotal(lineas))
      setObservacionesTexto(detectarObservaciones(lineas))
      setItems(itemsConMatch)
      setEstado('revision')
    } catch (err) {
      setError(err.message || 'Error al procesar el PDF')
      setEstado('error')
    }
  }

  function actualizarItem(i, campo, valor) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it))
  }
  function eliminarItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function agregarItem() {
    setItems(prev => [...prev, { codigo: '', descripcion: '', cantidad: 1, precio_unitario: 0, importe: 0, insumo_id: '' }])
  }

  const totalItems = items.reduce((a, it) => a + Number(it.importe || 0), 0)
  const baseComparacion = subtotalDetectado != null ? subtotalDetectado : totalDetectado
  const difiereDelTotal = baseComparacion != null && Math.abs(totalItems - baseComparacion) > 1

  async function confirmarImportacion() {
    setEstado('guardando')
    setError('')
    try {
      let provId = proveedorId
      if (!provId && proveedorTexto.trim()) {
        const { data, error: e1 } = await supabase.from('proveedores').insert({ razon_social: proveedorTexto.trim(), activo: true }).select().single()
        if (e1) throw e1
        provId = data.id
      }

      for (const it of items) {
        let insId = it.insumo_id
        let stockActual = 0
        if (!insId) {
          const { data: nuevoIns, error: e2 } = await supabase.from('insumos').insert({
            nombre: it.descripcion, unidad_medida: 'unidad', categoria: '', stock_actual: 0,
            stock_minimo: 0, precio_costo: it.precio_unitario, proveedor_id: provId || null, activo: true
          }).select().single()
          if (e2) throw e2
          insId = nuevoIns.id
        } else {
          const existente = insumosExistentes.find(x => x.id === insId)
          stockActual = Number(existente?.stock_actual || 0)
        }
        const stockNuevo = stockActual + Number(it.cantidad)
        const { error: e3 } = await supabase.from('movimientos_stock').insert({
          insumo_id: insId, tipo_movimiento: 'entrada', cantidad: it.cantidad,
          stock_anterior: stockActual, stock_nuevo: stockNuevo, precio_unitario: it.precio_unitario,
          motivo: `Factura ${numeroFactura || 's/n'} — ${proveedorTexto}`, observaciones: ''
        })
        if (e3) throw e3
        const { error: e4 } = await supabase.from('insumos').update({ stock_actual: stockNuevo }).eq('id', insId)
        if (e4) throw e4
      }

      const { error: e5 } = await supabase.from('costos_variables').insert({
        cliente_id: clienteId || null,
        nombre: `Factura ${numeroFactura || 's/n'} — ${proveedorTexto}`,
        categoria: 'Insumos',
        monto: totalDetectado || totalItems,
        fecha: fecha,
        observaciones: observacionesTexto
      })
      if (e5) throw e5

      const { error: e6 } = await supabase.from('facturas_compra').insert({
        proveedor_id: provId || null,
        cliente_id: clienteId || null,
        numero_factura: numeroFactura,
        fecha_emision: fecha,
        fecha_vencimiento: fecha,
        concepto: `Insumos — ${proveedorTexto}`,
        categoria: 'Insumos',
        subtotal: subtotalDetectado || totalItems,
        total: totalDetectado || totalItems,
        estado: 'pendiente',
        observaciones: observacionesTexto
      })
      if (e6) throw e6

      setEstado('listo')
      if (onImportado) onImportado()
    } catch (err) {
      setError(err.message || 'Error al guardar la importación')
      setEstado('revision')
    }
  }

  function reiniciar() {
    setEstado('idle'); setError(''); setNombreArchivo(''); setItems([])
    setProveedorTexto(''); setProveedorId(''); setNumeroFactura(''); setFecha('')
    setTotalDetectado(null); setObservacionesTexto(''); setClienteId('')
  }

  return (
    <div style={s.card}>
      {estado === 'idle' && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          border: `2px dashed ${paleta.line}`, borderRadius: '12px', padding: '40px 20px', cursor: 'pointer'
        }}>
          <Upload size={28} color={c.main} />
          <span style={{ color: paleta.ink, fontWeight: '600', fontSize: '14px' }}>Subí el PDF de la factura del proveedor</span>
          <span style={{ color: paleta.muted, fontSize: '12.5px' }}>Debe tener texto seleccionable (facturas electrónicas oficiales lo tienen)</span>
          <input type="file" accept="application/pdf" onChange={manejarArchivo} style={{ display: 'none' }} />
        </label>
      )}

      {estado === 'procesando' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0' }}>
          <Loader2 size={26} color={c.main} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: paleta.inkSoft, fontSize: '13.5px' }}>Leyendo {nombreArchivo}…</span>
        </div>
      )}

      {estado === 'error' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <AlertTriangle size={26} color={paleta.danger} style={{ marginBottom: '10px' }} />
          <p style={{ color: paleta.danger, fontWeight: '600', fontSize: '13.5px', marginBottom: '16px' }}>{error}</p>
          <button style={s.btnSecundario} onClick={reiniciar}>Probar con otro archivo</button>
        </div>
      )}

      {(estado === 'revision' || estado === 'guardando') && (
        <div>
          <div style={s.grid3}>
            <div>
              <label style={s.label}>Proveedor</label>
              <select style={s.input} value={proveedorId} onChange={e => setProveedorId(e.target.value)}>
                <option value="">Crear nuevo: {proveedorTexto || '(sin nombre)'}</option>
                {proveedoresExistentes.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
              </select>
              {!proveedorId && <input style={{ ...s.input, marginTop: '6px' }} value={proveedorTexto} onChange={e => setProveedorTexto(e.target.value)} placeholder="Nombre del proveedor nuevo" />}
            </div>
            <div><label style={s.label}>Nº de factura</label><input style={s.input} value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} /></div>
            <div><label style={s.label}>Fecha</label><input type="date" style={s.input} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={s.label}>Cliente / obra al que corresponde esta compra</label>
            <select style={s.input} value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">Sin asignar a un cliente</option>
              {clientes.map(cl => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
            </select>
            {observacionesTexto && (
              <p style={{ marginTop: '6px', fontSize: '12px', color: paleta.muted }}>
                Texto de "Observaciones" en la factura, como referencia: <em>"{observacionesTexto}"</em>
              </p>
            )}
          </div>

          <h4 style={{ margin: '22px 0 10px', fontSize: '14px', fontWeight: '700', color: paleta.ink }}>Productos detectados</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th style={s.tablaCabecera(c.main)}>Descripción</th>
                  <th style={s.tablaCabecera(c.main)}>Insumo</th>
                  <th style={s.tablaCabecera(c.main)}>Cant.</th>
                  <th style={s.tablaCabecera(c.main)}>Precio unit.</th>
                  <th style={s.tablaCabecera(c.main)}>Importe</th>
                  <th style={s.tablaCabecera(c.main)}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} style={s.tablaFila(i)}>
                    <td style={s.tablaCell}><input style={{ ...s.input, padding: '6px 8px' }} value={it.descripcion} onChange={e => actualizarItem(i, 'descripcion', e.target.value)} /></td>
                    <td style={s.tablaCell}>
                      <select style={{ ...s.input, padding: '6px 8px' }} value={it.insumo_id} onChange={e => actualizarItem(i, 'insumo_id', e.target.value)}>
                        <option value="">Crear nuevo insumo</option>
                        {insumosExistentes.map(ins => <option key={ins.id} value={ins.id}>{ins.nombre}</option>)}
                      </select>
                    </td>
                    <td style={s.tablaCell}><input type="number" step="0.01" style={{ ...s.input, padding: '6px 8px', width: '80px' }} value={it.cantidad} onChange={e => actualizarItem(i, 'cantidad', e.target.value)} /></td>
                    <td style={s.tablaCell}><input type="number" step="0.01" style={{ ...s.input, padding: '6px 8px', width: '100px' }} value={it.precio_unitario} onChange={e => actualizarItem(i, 'precio_unitario', e.target.value)} /></td>
                    <td style={s.tablaCellBold}>{Number(it.importe).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}><button onClick={() => eliminarItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} color={paleta.danger} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={agregarItem} style={{ ...s.btnSecundario, marginTop: '10px', fontSize: '12.5px', padding: '7px 14px' }}><Plus size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />Agregar línea</button>

          <div style={{ marginTop: '18px', padding: '14px 18px', background: paleta.paper, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12.5px', color: paleta.muted }}>Suma de líneas: <strong style={{ color: paleta.ink }}>{totalItems.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>
              {subtotalDetectado != null && <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: paleta.muted }}>Subtotal en la factura: <strong style={{ color: paleta.ink }}>{subtotalDetectado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>}
              {totalDetectado != null && <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: paleta.muted }}>Total facturado (con impuestos): <strong style={{ color: paleta.ink }}>{totalDetectado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong></p>}
              {difiereDelTotal && <p style={{ margin: '6px 0 0', fontSize: '12px', color: paleta.warn, display: 'flex', alignItems: 'center', gap: '5px' }}><AlertTriangle size={13} /> La suma de líneas no coincide con el subtotal — revisá las líneas antes de confirmar.</p>}
            </div>
          </div>

          {error && <p style={{ color: paleta.danger, fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button style={s.btnSecundario} onClick={reiniciar} disabled={estado === 'guardando'}><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</button>
            <button style={s.btnPrimario(c.main)} onClick={confirmarImportacion} disabled={estado === 'guardando' || items.length === 0}>
              {estado === 'guardando' ? 'Guardando…' : 'Confirmar e importar'}
            </button>
          </div>
        </div>
      )}

      {estado === 'listo' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <CheckCircle2 size={30} color={c.main} style={{ marginBottom: '10px' }} />
          <p style={{ color: paleta.ink, fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Factura importada</p>
          <p style={{ color: paleta.muted, fontSize: '13px', marginBottom: '18px' }}>Se actualizó el stock de {items.length} insumo(s) y quedó registrada como pendiente de pago en Finanzas.</p>
          <button style={s.btnPrimario(c.main)} onClick={reiniciar}><FileUp size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Importar otra factura</button>
        </div>
      )}
    </div>
  )
}

export default ImportarFactura
