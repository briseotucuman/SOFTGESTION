import { useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { Upload, Loader2, AlertTriangle, CheckCircle2, X, FileUp } from 'lucide-react'

const c = colores.facturacion

// Tipos de comprobante AFIP/ARCA que representan facturas de venta (no notas de crédito/débito)
const TIPOS_FACTURA = { '1': 'Factura A', '6': 'Factura B', '11': 'Factura C', '51': 'Factura M' }

function parseArgNumber(str) {
  if (!str || str.trim() === '') return 0
  const n = parseFloat(str.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function normalizarCuit(cuit) {
  return (cuit || '').replace(/\D/g, '')
}

function parseCSVArca(texto) {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim())
  const header = lineas[0].split(';').map(h => h.replace(/^"|"$/g, '').trim())
  const idx = (nombre) => header.findIndex(h => h === nombre)
  const iFecha = idx('Fecha de Emisión'), iTipo = idx('Tipo de Comprobante'), iPV = idx('Punto de Venta')
  const iDesde = idx('Número Desde'), iHasta = idx('Número Hasta'), iCAE = idx('Cód. Autorización')
  const iCuit = idx('Nro. Doc. Receptor'), iNombre = idx('Denominación Receptor')
  const iNetoGravado = idx('Imp. Neto Gravado Total'), iNoGravado = idx('Imp. Neto No Gravado')
  const iExento = idx('Imp. Op. Exentas'), iIVA = idx('Total IVA'), iTotal = idx('Imp. Total')

  if ([iFecha, iTipo, iPV, iDesde, iTotal].some(i => i === -1)) {
    throw new Error('El archivo no tiene el formato esperado de ARCA (faltan columnas clave). Verificá que sea el export de "Mis Comprobantes → Comprobantes emitidos".')
  }

  return lineas.slice(1).map(linea => {
    const campos = linea.split(';').map(c => c.replace(/^"|"$/g, ''))
    const tipoCod = campos[iTipo]
    const puntoVenta = campos[iPV].padStart(5, '0')
    const numero = campos[iDesde].padStart(8, '0')
    const numeroHasta = campos[iHasta].padStart(8, '0')
    return {
      fecha_emision: campos[iFecha],
      tipo_comprobante: tipoCod,
      esFactura: !!TIPOS_FACTURA[tipoCod],
      tipoLabel: TIPOS_FACTURA[tipoCod] || `Cód. ${tipoCod} (nota de débito/crédito — no se importa)`,
      numero_factura: `${puntoVenta}-${numero}`,
      esRango: numero !== numeroHasta,
      cae: campos[iCAE],
      cuit: normalizarCuit(campos[iCuit]),
      nombreCliente: campos[iNombre],
      subtotal: parseArgNumber(campos[iNetoGravado]) + parseArgNumber(campos[iNoGravado]) + parseArgNumber(campos[iExento]),
      impuestos: parseArgNumber(campos[iIVA]),
      total: parseArgNumber(campos[iTotal]),
    }
  })
}

function ImportarARCA({ onImportado }) {
  const [estado, setEstado] = useState('idle') // idle | procesando | revision | guardando | listo | error
  const [error, setError] = useState('')
  const [filas, setFilas] = useState([])
  const [marcarTodasCobradas, setMarcarTodasCobradas] = useState(false)

  async function manejarArchivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setEstado('procesando')
    setError('')
    try {
      const texto = await file.text()
      const parseadas = parseCSVArca(texto)

      const [{ data: clientesExistentes }, { data: facturasExistentes }] = await Promise.all([
        supabase.from('clientes').select('id, razon_social, nombre_contacto, cuit'),
        supabase.from('facturas').select('numero_factura'),
      ])
      const numerosExistentes = new Set((facturasExistentes || []).map(f => f.numero_factura))

      const conMatch = parseadas.map(f => {
        const clienteMatch = (clientesExistentes || []).find(cl => normalizarCuit(cl.cuit) === f.cuit && f.cuit)
        const yaExiste = numerosExistentes.has(f.numero_factura)
        return {
          ...f,
          cliente_id: clienteMatch ? clienteMatch.id : '',
          crearCliente: !clienteMatch,
          yaExiste,
          incluir: f.esFactura && !yaExiste,
          yaCobrada: false,
        }
      })

      setFilas(conMatch)
      setEstado('revision')
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo')
      setEstado('error')
    }
  }

  function actualizarFila(i, campo, valor) {
    setFilas(prev => prev.map((f, idx) => idx === i ? { ...f, [campo]: valor } : f))
  }

  function toggleTodasCobradas() {
    const nuevo = !marcarTodasCobradas
    setMarcarTodasCobradas(nuevo)
    setFilas(prev => prev.map(f => ({ ...f, yaCobrada: nuevo })))
  }

  async function confirmarImportacion() {
    setEstado('guardando')
    setError('')
    try {
      const clientesCache = {}
      let importadas = 0
      for (const f of filas) {
        if (!f.incluir) continue
        let clienteId = f.cliente_id
        if (!clienteId && f.crearCliente) {
          const key = f.cuit || f.nombreCliente
          if (clientesCache[key]) {
            clienteId = clientesCache[key]
          } else {
            const { data: nuevoCliente, error: e1 } = await supabase.from('clientes').insert({
              razon_social: f.nombreCliente, cuit: f.cuit, tipo_cliente: 'empresa', activo: true
            }).select().single()
            if (e1) throw e1
            clienteId = nuevoCliente.id
            clientesCache[key] = clienteId
          }
        }
        const { error: e2 } = await supabase.from('facturas').insert({
          numero_factura: f.numero_factura,
          cliente_id: clienteId || null,
          fecha_emision: f.fecha_emision,
          subtotal: f.subtotal,
          impuestos: f.impuestos,
          total: f.total,
          cae: f.cae,
          tipo_comprobante: f.tipoLabel,
          estado: f.yaCobrada ? 'cobrada' : 'emitida',
          observaciones: 'Importada desde ARCA'
        })
        if (e2) throw e2
        importadas++
      }
      setEstado('listo')
      setFilas(prev => [...prev, { _resumenImportadas: importadas }])
      if (onImportado) onImportado()
    } catch (err) {
      setError(err.message || 'Error al guardar las facturas')
      setEstado('revision')
    }
  }

  function reiniciar() {
    setEstado('idle'); setError(''); setFilas([]); setMarcarTodasCobradas(false)
  }

  const incluidas = filas.filter(f => f.incluir)
  const omitidas = filas.filter(f => !f.incluir && !f._resumenImportadas)
  const totalImportado = filas.find(f => f._resumenImportadas)?._resumenImportadas

  return (
    <div style={s.card}>
      {estado === 'idle' && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          border: `2px dashed ${paleta.line}`, borderRadius: '12px', padding: '40px 20px', cursor: 'pointer'
        }}>
          <Upload size={28} color={c.main} />
          <span style={{ color: paleta.ink, fontWeight: '600', fontSize: '14px' }}>Subí el CSV exportado de ARCA (Mis Comprobantes → Comprobantes emitidos)</span>
          <span style={{ color: paleta.muted, fontSize: '12.5px' }}>El número de factura y el CAE van a coincidir exactamente con ARCA</span>
          <input type="file" accept=".csv" onChange={manejarArchivo} style={{ display: 'none' }} />
        </label>
      )}

      {estado === 'procesando' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0' }}>
          <Loader2 size={26} color={c.main} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: paleta.inkSoft, fontSize: '13.5px' }}>Leyendo archivo…</span>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: paleta.muted }}>
              {incluidas.length} factura(s) para importar · {omitidas.length} omitida(s) (notas de crédito/débito o ya existentes)
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: paleta.inkSoft, cursor: 'pointer' }}>
              <input type="checkbox" checked={marcarTodasCobradas} onChange={toggleTodasCobradas} /> Marcar todas como ya cobradas
            </label>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th style={s.tablaCabecera(c.main)}>Incluir</th>
                  <th style={s.tablaCabecera(c.main)}>Fecha</th>
                  <th style={s.tablaCabecera(c.main)}>Nº factura</th>
                  <th style={s.tablaCabecera(c.main)}>Tipo</th>
                  <th style={s.tablaCabecera(c.main)}>Cliente</th>
                  <th style={s.tablaCabecera(c.main)}>Total</th>
                  <th style={s.tablaCabecera(c.main)}>Ya cobrada</th>
                </tr>
              </thead>
              <tbody>
                {filas.filter(f => !f._resumenImportadas).map((f, i) => (
                  <tr key={i} style={{ ...s.tablaFila(i), opacity: f.incluir ? 1 : 0.5 }}>
                    <td style={s.tablaCell}><input type="checkbox" checked={f.incluir} onChange={e => actualizarFila(i, 'incluir', e.target.checked)} disabled={!f.esFactura} /></td>
                    <td style={s.tablaCell}>{new Date(f.fecha_emision + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px' }}>{f.numero_factura}</td>
                    <td style={{ ...s.tablaCell, fontSize: '12px' }}>
                      {f.tipoLabel}
                      {f.yaExiste && <div style={{ color: paleta.warn, fontSize: '11px', fontWeight: '600' }}>Ya existe en el sistema</div>}
                    </td>
                    <td style={s.tablaCell}>
                      {f.crearCliente ? (
                        <span style={{ color: paleta.warn, fontSize: '12.5px' }}>{f.nombreCliente} <em>(cliente nuevo)</em></span>
                      ) : (
                        <span>{f.nombreCliente}</span>
                      )}
                    </td>
                    <td style={s.tablaCellBold}>{f.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                    <td style={s.tablaCell}><input type="checkbox" checked={f.yaCobrada} onChange={e => actualizarFila(i, 'yaCobrada', e.target.checked)} disabled={!f.incluir} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p style={{ color: paleta.danger, fontSize: '13px', marginTop: '12px', fontWeight: '600' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button style={s.btnSecundario} onClick={reiniciar} disabled={estado === 'guardando'}><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</button>
            <button style={s.btnPrimario(c.main)} onClick={confirmarImportacion} disabled={estado === 'guardando' || incluidas.length === 0}>
              {estado === 'guardando' ? 'Importando…' : `Importar ${incluidas.length} factura(s)`}
            </button>
          </div>
        </div>
      )}

      {estado === 'listo' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <CheckCircle2 size={30} color={c.main} style={{ marginBottom: '10px' }} />
          <p style={{ color: paleta.ink, fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Importación completa</p>
          <p style={{ color: paleta.muted, fontSize: '13px', marginBottom: '18px' }}>Se importaron {totalImportado} factura(s) con su número y CAE reales de ARCA.</p>
          <button style={s.btnPrimario(c.main)} onClick={reiniciar}><FileUp size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Importar otro archivo</button>
        </div>
      )}
    </div>
  )
}

export default ImportarARCA
