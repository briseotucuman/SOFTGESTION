import { useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import {
  Upload, Loader2, AlertTriangle, CheckCircle2, X, FileUp,
  Receipt, ShoppingBag, HelpCircle, Check, Info, AlertCircle, Trash2,
  Package, ShieldAlert
} from 'lucide-react'

const c = colores.facturacion

// Tipos de comprobante AFIP / ARCA
const TIPOS_COMPROBANTE = {
  '1': { label: 'Factura A', esFactura: true },
  '2': { label: 'Nota de Débito A', esFactura: false },
  '3': { label: 'Nota de Crédito A', esFactura: false },
  '6': { label: 'Factura B', esFactura: true },
  '7': { label: 'Nota de Débito B', esFactura: false },
  '8': { label: 'Nota de Crédito B', esFactura: false },
  '11': { label: 'Factura C', esFactura: true },
  '12': { label: 'Nota de Débito C', esFactura: false },
  '13': { label: 'Nota de Crédito C', esFactura: false },
  '51': { label: 'Factura M', esFactura: true },
  '52': { label: 'Nota de Débito M', esFactura: false },
  '53': { label: 'Nota de Crédito M', esFactura: false },
  '201': { label: 'FCE MiPyME A', esFactura: true },
  '206': { label: 'FCE MiPyME B', esFactura: true },
  '211': { label: 'FCE MiPyME C', esFactura: true },
}

const CATEGORIAS_COMPRA = [
  'Insumos',
  'Servicios',
  'Mantenimiento',
  'Combustible',
  'Honorarios',
  'Impuestos',
  'Equipamiento',
  'Otro egreso'
]

function parseArgNumber(str) {
  if (!str || typeof str !== 'string' || str.trim() === '') return 0
  const limpio = str.trim().replace(/^"|"$/g, '').replace(/\$/g, '').replace(/\s+/g, '')
  const n = parseFloat(limpio.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function normalizarCuit(cuit) {
  return (cuit || '').toString().replace(/\D/g, '')
}

function normalizarNumeroFactura(num) {
  if (!num) return ''
  const limpio = num.toString().trim().replace(/[^0-9-]/g, '')
  const partes = limpio.split('-')
  if (partes.length === 2) {
    const pv = parseInt(partes[0], 10)
    const n = parseInt(partes[1], 10)
    if (!isNaN(pv) && !isNaN(n)) {
      return `${pv}-${n}`
    }
  }
  const soloDigitos = limpio.replace(/\D/g, '')
  return soloDigitos ? parseInt(soloDigitos, 10).toString() : limpio
}

function normalizarTextoComparacion(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(s\.?r\.?l\.?|s\.?a\.?s\.?|s\.?a\.?|sociedad anonima|responsable inscripto)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function normalizarFecha(str) {
  if (!str) return new Date().toISOString().split('T')[0]
  const limpio = str.trim().replace(/^"|"$/g, '')
  const partes = limpio.split(/[/\-.]/)
  if (partes.length === 3) {
    if (partes[0].length === 4) {
      // YYYY-MM-DD
      return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
    } else if (partes[2].length === 4) {
      // DD/MM/YYYY
      return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
    }
  }
  return limpio
}

// Split CSV line respecting double quotes
function splitCSVLine(line, delimiter = ';') {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += char
    }
  }
  result.push(cur.trim())
  return result.map(s => s.replace(/^"|"$/g, '').trim())
}

// Detect delimiter (, or ; or \t)
function detectarDelimitador(linea) {
  const comas = (linea.match(/,/g) || []).length
  const puntosComa = (linea.match(/;/g) || []).length
  const tabs = (linea.match(/\t/g) || []).length
  if (puntosComa >= comas && puntosComa >= tabs) return ';'
  if (comas >= puntosComa && comas >= tabs) return ','
  if (tabs > 0) return '\t'
  return ';'
}

function ImportarARCA({ tipoInicial = 'ventas', onImportado }) {
  const [tipoOperacion, setTipoOperacion] = useState(tipoInicial) // 'ventas' | 'compras'
  const [mostrarGuia, setMostrarGuia] = useState(false)
  const [estado, setEstado] = useState('idle') // idle | procesando | revision | guardando | listo | error
  const [error, setError] = useState('')
  const [infoMensaje, setInfoMensaje] = useState('')
  const [filas, setFilas] = useState([])
  const [marcarTodasCompletadas, setMarcarTodasCompletadas] = useState(false)
  const [categoriaMasiva, setCategoriaMasiva] = useState('Insumos')
  const [stats, setStats] = useState({ totalProcesadas: 0, totalMonto: 0 })

  function reiniciar() {
    setEstado('idle')
    setError('')
    setInfoMensaje('')
    setFilas([])
    setMarcarTodasCompletadas(false)
  }

  function procesarTextoCSV(texto, tipoForzado) {
    const textoLimpio = texto.replace(/^\uFEFF/, '').trim()
    const lineas = textoLimpio.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lineas.length < 2) {
      throw new Error('El archivo CSV está vacío o contiene únicamente el encabezado.')
    }

    const delimitador = detectarDelimitador(lineas[0])
    const header = splitCSVLine(lineas[0], delimitador)

    const normalizarHeader = (h) => h.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')

    const headersNormalizados = header.map(normalizarHeader)
    const findIndex = (posiblesNombres) => {
      for (const p of posiblesNombres) {
        const norm = normalizarHeader(p)
        const idx = headersNormalizados.findIndex(h => h === norm || h.includes(norm))
        if (idx !== -1) return idx
      }
      return -1
    }

    // Indices generales
    const iFecha = findIndex(['Fecha de Emision', 'Fecha Emision', 'Fecha'])
    const iTipo = findIndex(['Tipo de Comprobante', 'Tipo Comprobante', 'Tipo'])
    const iPV = findIndex(['Punto de Venta', 'Pto Vta', 'PV'])
    const iDesde = findIndex(['Numero Desde', 'Nro Desde', 'Desde', 'Numero'])
    const iHasta = findIndex(['Numero Hasta', 'Nro Hasta', 'Hasta'])
    const iCAE = findIndex(['Cod. Autorizacion', 'CAE', 'Codigo Autorizacion', 'Autorizacion'])
    const iTotal = findIndex(['Imp. Total', 'Importe Total', 'Total'])
    const iNetoGravado = findIndex(['Imp. Neto Gravado Total', 'Imp. Neto Gravado', 'Neto Gravado'])
    const iIVA = findIndex(['Total IVA', 'IVA'])

    // Detectar si es Emitidos (Ventas) o Recibidos (Compras)
    const iCuitReceptor = findIndex(['Nro. Doc. Receptor', 'Nro Doc Receptor', 'Doc Receptor', 'CUIT Receptor'])
    const iNombreReceptor = findIndex(['Denominacion Receptor', 'Nombre Receptor', 'Razon Social Receptor', 'Receptor'])
    const iCuitEmisor = findIndex(['Nro. Doc. Emisor', 'Nro Doc Emisor', 'Doc Emisor', 'CUIT Emisor'])
    const iNombreEmisor = findIndex(['Denominacion Emisor', 'Nombre Emisor', 'Razon Social Emisor', 'Emisor'])

    let tipoDetectado = tipoForzado || tipoOperacion

    if (iCuitEmisor !== -1 || iNombreEmisor !== -1) {
      tipoDetectado = 'compras'
    } else if (iCuitReceptor !== -1 || iNombreReceptor !== -1) {
      tipoDetectado = 'ventas'
    }

    if (tipoDetectado !== tipoOperacion) {
      setTipoOperacion(tipoDetectado)
      setInfoMensaje(`Se detectó automáticamente el formato de ${tipoDetectado === 'compras' ? 'Comprobantes Recibidos (Compras)' : 'Comprobantes Emitidos (Ventas)'}.`)
    }

    if (iFecha === -1 || iTipo === -1 || iPV === -1 || iDesde === -1 || iTotal === -1) {
      throw new Error(`El archivo no tiene el formato estándar de ARCA / AFIP. Columnas faltantes obligatorias (Fecha, Tipo, Punto de Venta, Número o Total). Columnas encontradas: ${header.slice(0, 8).join(', ')}...`)
    }

    const parsed = []
    for (let i = 1; i < lineas.length; i++) {
      const campos = splitCSVLine(lineas[i], delimitador)
      if (campos.length < 4) continue

      const tipoCod = campos[iTipo]?.trim()
      const tipoInfo = TIPOS_COMPROBANTE[tipoCod] || {
        label: `Cód. ${tipoCod} (${tipoCod === '3' || tipoCod === '8' || tipoCod === '13' ? 'Nota Crédito' : 'Comprobante'})`,
        esFactura: ['1', '6', '11', '51', '201', '206', '211'].includes(tipoCod)
      }

      const pvRaw = campos[iPV]?.replace(/\D/g, '') || '1'
      const pv = pvRaw.padStart(5, '0')
      const desdeRaw = campos[iDesde]?.replace(/\D/g, '') || '1'
      const numero = desdeRaw.padStart(8, '0')
      const hastaRaw = iHasta !== -1 ? campos[iHasta]?.replace(/\D/g, '') : desdeRaw
      const numeroHasta = hastaRaw.padStart(8, '0')

      const fechaEmision = normalizarFecha(campos[iFecha])
      const total = parseArgNumber(campos[iTotal])
      const netoGravado = iNetoGravado !== -1 ? parseArgNumber(campos[iNetoGravado]) : total
      const iva = iIVA !== -1 ? parseArgNumber(campos[iIVA]) : 0

      let cuit = ''
      let nombreEntidad = ''

      if (tipoDetectado === 'compras') {
        cuit = normalizarCuit(iCuitEmisor !== -1 ? campos[iCuitEmisor] : '')
        nombreEntidad = (iNombreEmisor !== -1 ? campos[iNombreEmisor] : '') || 'Proveedor no identificado'
      } else {
        cuit = normalizarCuit(iCuitReceptor !== -1 ? campos[iCuitReceptor] : '')
        nombreEntidad = (iNombreReceptor !== -1 ? campos[iNombreReceptor] : '') || 'Consumidor Final'
      }

      parsed.push({
        tipoOperacion: tipoDetectado,
        fecha_emision: fechaEmision,
        tipo_comprobante: tipoCod,
        tipoLabel: tipoInfo.label,
        esFactura: tipoInfo.esFactura,
        numero_factura: `${pv}-${numero}`,
        esRango: numero !== numeroHasta,
        cae: iCAE !== -1 ? (campos[iCAE] || '').trim() : '',
        cuit,
        nombreEntidad,
        subtotal: netoGravado,
        impuestos: iva,
        total,
        categoria: 'Insumos',
        yaCompletada: false,
      })
    }

    return { tipoDetectado, parsed }
  }

  async function manejarArchivo(e) {
    const file = e.target.files[0]
    if (!file) return
    setEstado('procesando')
    setError('')
    try {
      const texto = await file.text()
      const { tipoDetectado, parsed } = procesarTextoCSV(texto)

      if (parsed.length === 0) {
        throw new Error('No se encontraron comprobantes válidos para procesar en el archivo.')
      }

      if (tipoDetectado === 'ventas') {
        const [{ data: clientesExistentes }, { data: facturasExistentes }] = await Promise.all([
          supabase.from('clientes').select('id, razon_social, nombre_contacto, cuit'),
          supabase.from('facturas').select('numero_factura, cliente_id'),
        ])

        const numerosExistentes = new Set((facturasExistentes || []).map(f => f.numero_factura))

        const filasMatch = parsed.map(f => {
          const match = (clientesExistentes || []).find(cl =>
            (f.cuit && normalizarCuit(cl.cuit) === f.cuit) ||
            (cl.razon_social && f.nombreEntidad && cl.razon_social.trim().toLowerCase() === f.nombreEntidad.trim().toLowerCase())
          )
          const yaExiste = numerosExistentes.has(f.numero_factura)

          return {
            ...f,
            entidad_id: match ? match.id : '',
            esNuevo: !match,
            yaExiste,
            incluir: f.esFactura && !yaExiste,
            nombreEntidadResuelto: match ? (match.razon_social || match.nombre_contacto) : f.nombreEntidad,
          }
        })

        setFilas(filasMatch)
      } else {
        // Modo Compras - Detección exhaustiva contra Facturas de Compra, Costos e Insumos
        const [{ data: proveedoresExistentes }, { data: facturasCompraExistentes }, { data: costosExistentes }, { data: movStockExistentes }] = await Promise.all([
          supabase.from('proveedores').select('id, razon_social, cuit'),
          supabase.from('facturas_compra').select('id, numero_factura, proveedor_id, total, categoria, concepto, observaciones, creado_en, proveedores(razon_social, cuit)'),
          supabase.from('costos_variables').select('id, nombre, monto, observaciones, fecha'),
          supabase.from('movimientos_stock').select('id, motivo, observaciones')
        ])

        const filasMatch = parsed.map(f => {
          const normNumF = normalizarNumeroFactura(f.numero_factura)
          const cuitF = f.cuit ? normalizarCuit(f.cuit) : ''
          const nombreNormF = normalizarTextoComparacion(f.nombreEntidad)

          // 1. Coincidencia de proveedor
          const matchProv = (proveedoresExistentes || []).find(p =>
            (cuitF && normalizarCuit(p.cuit) === cuitF) ||
            (p.razon_social && nombreNormF && normalizarTextoComparacion(p.razon_social) === nombreNormF) ||
            (p.razon_social && nombreNormF && (normalizarTextoComparacion(p.razon_social).includes(nombreNormF) || nombreNormF.includes(normalizarTextoComparacion(p.razon_social))))
          )

          // 2. Comprobación exhaustiva en facturas_compra
          const matchFacturaCompra = (facturasCompraExistentes || []).find(fc => {
            const normNumFC = normalizarNumeroFactura(fc.numero_factura)
            if (!normNumFC || normNumFC !== normNumF) return false

            const cuitFC = fc.proveedores?.cuit ? normalizarCuit(fc.proveedores.cuit) : ''
            const nombreFC = normalizarTextoComparacion(fc.proveedores?.razon_social || '')

            if (cuitF && cuitFC && cuitF === cuitFC) return true
            if (nombreNormF && nombreFC && (nombreNormF.includes(nombreFC) || nombreFC.includes(nombreNormF))) return true
            if (Math.abs(Number(fc.total || 0) - Number(f.total || 0)) < 1.5) return true
            if (matchProv && fc.proveedor_id === matchProv.id) return true
            if (!fc.proveedor_id) return true

            return true
          })

          // 3. Comprobación en movimientos de stock o costos cargados desde el módulo de Insumos
          const matchStock = (movStockExistentes || []).find(m => {
            const motivo = (m.motivo || '') + ' ' + (m.observaciones || '')
            return motivo.includes(f.numero_factura) || (normNumF && motivo.includes(normNumF))
          })

          const matchCosto = (costosExistentes || []).find(c => {
            const nom = (c.nombre || '') + ' ' + (c.observaciones || '')
            return nom.includes(f.numero_factura) || (normNumF && nom.includes(normNumF))
          })

          // 4. Determinar si el origen es el módulo de Insumos
          let origenInsumos = false
          let motivoDuplicado = ''

          if (matchFacturaCompra) {
            const cat = (matchFacturaCompra.categoria || '').toLowerCase()
            const concepto = (matchFacturaCompra.concepto || '').toLowerCase()
            const obs = (matchFacturaCompra.observaciones || '').toLowerCase()

            if (cat === 'insumos' || concepto.includes('insumos') || obs.includes('insumos') || matchStock || matchCosto) {
              origenInsumos = true
              motivoDuplicado = `Ya importada por módulo Insumos (${matchFacturaCompra.numero_factura})`
            } else {
              motivoDuplicado = `Ya registrada en Cuentas por pagar (${matchFacturaCompra.numero_factura})`
            }
          } else if (matchStock || matchCosto) {
            origenInsumos = true
            motivoDuplicado = 'Ya registrada en stock/costos de Insumos'
          }

          const yaExiste = Boolean(matchFacturaCompra || matchStock || matchCosto)

          return {
            ...f,
            entidad_id: matchProv ? matchProv.id : '',
            esNuevo: !matchProv,
            yaExiste,
            origenInsumos,
            motivoDuplicado,
            incluir: f.esFactura && !yaExiste,
            nombreEntidadResuelto: matchProv ? matchProv.razon_social : f.nombreEntidad,
            categoria: 'Insumos',
          }
        })

        setFilas(filasMatch)
      }

      setEstado('revision')
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo CSV')
      setEstado('error')
    }
  }

  function actualizarFila(idx, campo, valor) {
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f))
  }

  function toggleTodasIncluir(val) {
    setFilas(prev => prev.map(f => f.esFactura && !f.yaExiste ? { ...f, incluir: val } : f))
  }

  function toggleTodasCompletadas() {
    const nuevo = !marcarTodasCompletadas
    setMarcarTodasCompletadas(nuevo)
    setFilas(prev => prev.map(f => ({ ...f, yaCompletada: nuevo })))
  }

  function aplicarCategoriaMasiva(cat) {
    setCategoriaMasiva(cat)
    setFilas(prev => prev.map(f => f.incluir ? { ...f, categoria: cat } : f))
  }

  async function confirmarImportacion() {
    setEstado('guardando')
    setError('')
    try {
      const aImportar = filas.filter(f => f.incluir)
      if (aImportar.length === 0) {
        throw new Error('No hay comprobantes seleccionados para importar.')
      }

      let totalImportado = 0
      let totalMonto = 0

      if (tipoOperacion === 'ventas') {
        const cacheClientes = {}

        for (const f of aImportar) {
          let clienteId = f.entidad_id
          if (!clienteId) {
            const key = f.cuit || f.nombreEntidad
            if (cacheClientes[key]) {
              clienteId = cacheClientes[key]
            } else {
              const { data: nuevoCliente, error: errCli } = await supabase.from('clientes').insert({
                razon_social: f.nombreEntidad,
                cuit: f.cuit,
                tipo_cliente: 'empresa',
                activo: true
              }).select('id').single()

              if (errCli) throw errCli
              clienteId = nuevoCliente.id
              cacheClientes[key] = clienteId
            }
          }

          const { error: errFactura } = await supabase.from('facturas').insert({
            numero_factura: f.numero_factura,
            cliente_id: clienteId,
            fecha_emision: f.fecha_emision,
            subtotal: f.subtotal,
            impuestos: f.impuestos,
            total: f.total,
            cae: f.cae || null,
            tipo_comprobante: f.tipoLabel,
            estado: f.yaCompletada ? 'cobrada' : 'emitida',
            observaciones: `Importada desde ARCA Comprobantes Emitidos | CAE: ${f.cae || 's/n'}`
          })

          if (errFactura) throw errFactura
          totalImportado++
          totalMonto += f.total
        }
      } else {
        // MODO COMPRAS
        const cacheProveedores = {}

        for (const f of aImportar) {
          let proveedorId = f.entidad_id
          if (!proveedorId) {
            const key = f.cuit || f.nombreEntidad
            if (cacheProveedores[key]) {
              proveedorId = cacheProveedores[key]
            } else {
              const { data: nuevoProv, error: errProv } = await supabase.from('proveedores').insert({
                razon_social: f.nombreEntidad,
                cuit: f.cuit,
                rubro: f.categoria || 'Insumos',
                activo: true,
                observaciones: 'Proveedor creado automáticamente al importar de ARCA'
              }).select('id').single()

              if (errProv) throw errProv
              proveedorId = nuevoProv.id
              cacheProveedores[key] = proveedorId
            }
          }

          const { error: errCompra } = await supabase.from('facturas_compra').insert({
            numero_factura: f.numero_factura,
            proveedor_id: proveedorId,
            fecha_emision: f.fecha_emision,
            fecha_vencimiento: f.fecha_emision,
            categoria: f.categoria || 'Insumos',
            subtotal: f.subtotal,
            total: f.total,
            estado: f.yaCompletada ? 'pagada' : 'pendiente',
            observaciones: `Importada desde ARCA Comprobantes Recibidos | CAE: ${f.cae || 's/n'} | ${f.tipoLabel}`
          })

          if (errCompra) throw errCompra
          totalImportado++
          totalMonto += f.total
        }
      }

      setStats({ totalProcesadas: totalImportado, totalMonto })
      setEstado('listo')
      if (onImportado) onImportado()
    } catch (err) {
      setError(err.message || 'Error al guardar comprobantes en el sistema')
      setEstado('revision')
    }
  }

  const incluidas = filas.filter(f => f.incluir)
  const totalMontoSeleccionado = incluidas.reduce((sum, f) => sum + Number(f.total || 0), 0)

  return (
    <div style={{ ...s.card, padding: '24px', border: `1px solid ${paleta.lineStrong}`, background: '#FFFFFF' }}>
      {/* HEADER DE LA SECCIÓN DE IMPORTACIÓN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: `1px solid ${paleta.line}`, paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '8px',
              background: '#0F172A', color: '#FFFFFF'
            }}>
              <FileUp size={16} />
            </span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: paleta.ink, letterSpacing: '-0.02em' }}>
              Centro de Importación ARCA (AFIP)
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: paleta.muted }}>
            Sincronizá ventas emitidas y compras recibidas directamente desde los archivos CSV oficiales de ARCA
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* BOTÓN TOGGLE GUÍA */}
          <button
            type="button"
            onClick={() => setMostrarGuia(!mostrarGuia)}
            style={{
              ...s.btnSecundario,
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12.5px', padding: '7px 14px',
              background: mostrarGuia ? '#F1F5F9' : '#FFFFFF'
            }}
          >
            <HelpCircle size={15} color={c.main} />
            {mostrarGuia ? 'Ocultar guía ARCA' : '¿Cómo descargar de ARCA?'}
          </button>
        </div>
      </div>

      {/* SELECTOR DE TIPO (VENTAS VS COMPRAS) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#F8FAFC', padding: '6px', borderRadius: '10px', border: `1px solid ${paleta.line}` }}>
        <button
          type="button"
          onClick={() => { setTipoOperacion('ventas'); reiniciar() }}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.15s ease',
            background: tipoOperacion === 'ventas' ? '#0F172A' : 'transparent',
            color: tipoOperacion === 'ventas' ? '#FFFFFF' : paleta.inkSoft,
            boxShadow: tipoOperacion === 'ventas' ? '0 2px 8px rgba(15,23,42,0.15)' : 'none'
          }}
        >
          <Receipt size={16} />
          Facturas de Ventas (Comprobantes Emitidos)
        </button>

        <button
          type="button"
          onClick={() => { setTipoOperacion('compras'); reiniciar() }}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '10px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '700', transition: 'all 0.15s ease',
            background: tipoOperacion === 'compras' ? '#0F766E' : 'transparent',
            color: tipoOperacion === 'compras' ? '#FFFFFF' : paleta.inkSoft,
            boxShadow: tipoOperacion === 'compras' ? '0 2px 8px rgba(15,118,110,0.2)' : 'none'
          }}
        >
          <ShoppingBag size={16} />
          Facturas de Compras (Comprobantes Recibidos)
        </button>
      </div>

      {/* GUÍA EXPLICATIVA ARCA */}
      {mostrarGuia && (
        <div style={{
          background: '#F8FAFC', border: `1px solid ${paleta.lineStrong}`,
          borderRadius: '10px', padding: '18px 20px', marginBottom: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Info size={18} color="#0F766E" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: paleta.ink }}>
              Paso a paso para exportar comprobantes desde ARCA / AFIP
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '12.5px', color: paleta.inkSoft, lineHeight: 1.5 }}>
            <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: `1px solid ${paleta.line}` }}>
              <strong style={{ color: paleta.ink, display: 'block', marginBottom: '6px' }}>
                1. Acceder al portal ARCA (AFIP)
              </strong>
              Entrá con tu CUIT y Clave Fiscal en <strong>arca.gob.ar</strong> (o afip.gob.ar). Buscá el servicio interactivo <strong>«Mis Comprobantes»</strong>.
            </div>
            <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: `1px solid ${paleta.line}` }}>
              <strong style={{ color: paleta.ink, display: 'block', marginBottom: '6px' }}>
                2. Elegir Emitidos o Recibidos
              </strong>
              • Para <strong>Ventas</strong>: Seleccioná <em>«Comprobantes emitidos»</em>.<br />
              • Para <strong>Compras</strong>: Seleccioná <em>«Comprobantes recibidos»</em>.<br />
              Elegí el rango de fechas (ej. mes en curso o mes cerrado) y presioná <strong>«Buscar»</strong>.
            </div>
            <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: `1px solid ${paleta.line}` }}>
              <strong style={{ color: paleta.ink, display: 'block', marginBottom: '6px' }}>
                3. Descargar en formato CSV
              </strong>
              Hacé clic en el botón <strong>«CSV»</strong> ubicado al final de los resultados. Guardá el archivo sin modificarlo y subilo en el recuadro inferior.
            </div>
          </div>
        </div>
      )}

      {/* MENSAJE INFORMATIVO DINÁMICO */}
      {infoMensaje && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
          color: '#1E40AF', fontSize: '13px'
        }}>
          <CheckCircle2 size={16} color="#2563EB" />
          <span>{infoMensaje}</span>
        </div>
      )}

      {/* AVISO / ACCIÓN PARA LIMPIAR ANTES DE REIMPORTAR */}
      {estado === 'idle' && tipoOperacion === 'ventas' && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#D97706" />
            <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '500' }}>
              ¿Querés reimportar desde cero? Podés vaciar todas las facturas de venta previas para que la carga quede 100% limpia con ARCA.
            </span>
          </div>
          <button
            type="button"
            style={{
              ...s.btnPeligro,
              padding: '6px 14px', fontSize: '12px', fontWeight: '700',
              display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}
            onClick={async () => {
              if (!confirm('¿Eliminar TODAS las facturas de venta para realizar una importación limpia desde ARCA?')) return
              try {
                const { data: facts } = await supabase.from('facturas').select('id')
                if (!facts || facts.length === 0) {
                  alert('No hay facturas cargadas para borrar.')
                  return
                }
                const ids = facts.map(f => f.id)
                await supabase.from('pagos').delete().in('factura_id', ids)
                await supabase.from('movimientos_financieros').update({ factura_id: null }).in('factura_id', ids)
                const { error: err } = await supabase.from('facturas').delete().in('id', ids)
                if (err) throw err
                alert(`Se eliminaron las ${ids.length} facturas de venta. Ahora podés subir tu archivo ARCA para tener la facturación limpia.`)
                if (onImportado) onImportado()
              } catch (e) {
                alert('Error al vaciar facturas: ' + e.message)
              }
            }}
          >
            <Trash2 size={13} />
            Vaciar facturas de venta previas
          </button>
        </div>
      )}

      {/* ÁREA DE CARGA DE ARCHIVO (ESTADO IDLE) */}
      {estado === 'idle' && (
        <label style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
          border: `2px dashed ${tipoOperacion === 'compras' ? '#0F766E' : paleta.lineStrong}`,
          borderRadius: '12px', padding: '48px 24px', cursor: 'pointer',
          background: tipoOperacion === 'compras' ? '#F0FDFA' : '#FAFAFA',
          transition: 'all 0.2s ease', textAlign: 'center'
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: tipoOperacion === 'compras' ? '#CCFBF1' : '#F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Upload size={24} color={tipoOperacion === 'compras' ? '#0F766E' : '#0F172A'} />
          </div>
          <div>
            <span style={{ display: 'block', color: paleta.ink, fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>
              Subí el archivo CSV de {tipoOperacion === 'ventas' ? 'Comprobantes Emitidos (Ventas)' : 'Comprobantes Recibidos (Compras)'}
            </span>
            <span style={{ color: paleta.muted, fontSize: '13px' }}>
              Hacé clic para seleccionar o arrastrá el archivo CSV oficial descargado de ARCA
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#FFFFFF', padding: '6px 14px', borderRadius: '20px',
            fontSize: '12px', color: paleta.inkSoft, border: `1px solid ${paleta.line}`
          }}>
            <Check size={13} color="#059669" />
            Validación de CAE, CUIT, detección de duplicados y creación automática de {tipoOperacion === 'ventas' ? 'clientes' : 'proveedores'}
          </div>
          <input type="file" accept=".csv,text/csv,application/vnd.ms-excel" onChange={manejarArchivo} style={{ display: 'none' }} />
        </label>
      )}

      {/* ESTADO: PROCESANDO */}
      {estado === 'procesando' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0' }}>
          <Loader2 size={32} color={tipoOperacion === 'compras' ? '#0F766E' : '#0F172A'} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: paleta.ink, fontWeight: '600', fontSize: '14px' }}>
            Analizando estructura del archivo ARCA y cruzando comprobantes existentes…
          </span>
          <span style={{ color: paleta.muted, fontSize: '12.5px' }}>
            Verificando CUITs, puntos de venta y numeración oficial
          </span>
        </div>
      )}

      {/* ESTADO: ERROR */}
      {estado === 'error' && (
        <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FEF2F2', borderRadius: '10px', border: '1px solid #FECACA' }}>
          <AlertTriangle size={32} color={paleta.danger} style={{ marginBottom: '10px' }} />
          <h4 style={{ color: paleta.danger, margin: '0 0 6px', fontWeight: '700', fontSize: '15px' }}>
            No se pudo procesar el archivo
          </h4>
          <p style={{ color: '#991B1B', fontSize: '13px', margin: '0 auto 16px', maxWidth: '520px' }}>
            {error}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button style={s.btnSecundario} onClick={reiniciar}>Probar con otro archivo</button>
            <button style={{ ...s.btnSecundario, background: '#FFFFFF' }} onClick={() => setMostrarGuia(true)}>Ver guía de formato</button>
          </div>
        </div>
      )}

      {/* ESTADO: REVISIÓN PREVIA A GUARDAR */}
      {(estado === 'revision' || estado === 'guardando') && (
        <div>
          {/* BARRA DE ACCIONES Y FILTROS */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '16px', flexWrap: 'wrap', gap: '12px',
            background: '#F8FAFC', padding: '12px 16px', borderRadius: '10px',
            border: `1px solid ${paleta.line}`
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: paleta.ink }}>
                {incluidas.length} de {filas.length} comprobante(s) seleccionado(s) para importar
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: paleta.muted }}>
                Total a incorporar:{' '}
                <strong style={{ color: paleta.ink, fontFamily: 'monospace' }}>
                  {totalMontoSeleccionado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </strong>
                {filas.filter(f => f.yaExiste).length > 0 && (
                  <span style={{ color: '#D97706', marginLeft: '8px' }}>
                    ({filas.filter(f => f.yaExiste).length} ya existentes en el sistema)
                  </span>
                )}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {/* ACCIÓN RÁPIDA: ASIGNAR CATEGORÍA MASIVA EN COMPRAS */}
              {tipoOperacion === 'compras' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: paleta.inkSoft, fontWeight: '600' }}>Categoría masiva:</span>
                  <select
                    style={{ ...s.input, width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                    value={categoriaMasiva}
                    onChange={e => aplicarCategoriaMasiva(e.target.value)}
                  >
                    {CATEGORIAS_COMPRA.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}

              {/* CHECKBOX MARCAR TODAS COBRADAS / PAGADAS */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: paleta.ink, cursor: 'pointer', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={marcarTodasCompletadas}
                  onChange={toggleTodasCompletadas}
                  style={{ cursor: 'pointer' }}
                />
                {tipoOperacion === 'ventas' ? 'Marcar como ya cobradas' : 'Marcar como ya pagadas'}
              </label>

              {/* BOTÓN SELECCIONAR / DESELECCIONAR TODAS */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => toggleTodasIncluir(true)}
                  style={{ ...s.btnSecundario, padding: '4px 10px', fontSize: '11.5px' }}
                >
                  Seleccionar todas
                </button>
                <button
                  type="button"
                  onClick={() => toggleTodasIncluir(false)}
                  style={{ ...s.btnSecundario, padding: '4px 10px', fontSize: '11.5px' }}
                >
                  Deseleccionar
                </button>
              </div>
            </div>
          </div>

          {/* ALERTA DUPLICADOS DE INSUMOS */}
          {filas.filter(f => f.origenInsumos).length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#FEF3C7', border: '1px solid #FCD34D',
              borderRadius: '8px', padding: '12px 16px', marginBottom: '14px',
              color: '#92400E', fontSize: '13px'
            }}>
              <Package size={20} color="#D97706" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Control anti-duplicación activo:</strong>
                Se detectaron y bloquearon <strong>{filas.filter(f => f.origenInsumos).length} comprobante(s)</strong> que ya habían sido importados previamente en el módulo de <strong>Insumos</strong>.
                Fueron excluidos automáticamente para no duplicar las deudas con proveedores ni distorsionar los costos.
              </div>
            </div>
          )}

          {/* TABLA DE DETALLE */}
          <div style={{ overflowX: 'auto', maxHeight: '420px', border: `1px solid ${paleta.line}`, borderRadius: '8px' }}>
            <table style={{ ...s.tabla, margin: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ ...s.tablaCabecera(c.main), width: '40px', textAlign: 'center' }}>Inc.</th>
                  <th style={s.tablaCabecera(c.main)}>Fecha</th>
                  <th style={s.tablaCabecera(c.main)}>Nº Factura</th>
                  <th style={s.tablaCabecera(c.main)}>Tipo</th>
                  <th style={s.tablaCabecera(c.main)}>
                    {tipoOperacion === 'ventas' ? 'Cliente (Receptor)' : 'Proveedor (Emisor)'}
                  </th>
                  {tipoOperacion === 'compras' && (
                    <th style={s.tablaCabecera(c.main)}>Categoría</th>
                  )}
                  <th style={{ ...s.tablaCabecera(c.main), textAlign: 'right' }}>Total</th>
                  <th style={{ ...s.tablaCabecera(c.main), textAlign: 'center' }}>
                    {tipoOperacion === 'ventas' ? '¿Ya cobrada?' : '¿Ya pagada?'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={i}
                    style={{
                      ...s.tablaFila(i),
                      opacity: f.incluir ? 1 : 0.45,
                      background: f.yaExiste ? '#FEF3C720' : undefined
                    }}
                  >
                    <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={f.incluir}
                        onChange={e => actualizarFila(i, 'incluir', e.target.checked)}
                        disabled={!f.esFactura || f.yaExiste}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>
                      {f.fecha_emision}
                    </td>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontWeight: '600', fontSize: '12px' }}>
                      {f.numero_factura}
                      {f.cae && (
                        <div style={{ fontSize: '10.5px', color: paleta.muted, fontWeight: 'normal' }}>
                          CAE: {f.cae}
                        </div>
                      )}
                    </td>
                    <td style={{ ...s.tablaCell, fontSize: '12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 6px', borderRadius: '4px',
                        fontSize: '11px', fontWeight: '600',
                        background: f.esFactura ? '#F1F5F9' : '#FEF2F2',
                        color: f.esFactura ? paleta.ink : '#991B1B'
                      }}>
                        {f.tipoLabel}
                      </span>
                      {f.yaExiste && f.origenInsumos && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          color: '#B45309', background: '#FEF3C7', border: '1px solid #FCD34D',
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', marginTop: '3px'
                        }} title={f.motivoDuplicado}>
                          <Package size={11} color="#B45309" />
                          Importada en Insumos
                        </div>
                      )}
                      {f.yaExiste && !f.origenInsumos && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          color: '#64748B', background: '#F1F5F9', border: '1px solid #E2E8F0',
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', marginTop: '3px'
                        }} title={f.motivoDuplicado}>
                          ⚠️ Ya en el sistema
                        </div>
                      )}
                    </td>
                    <td style={s.tablaCell}>
                      <div style={{ fontWeight: '600', color: paleta.ink, fontSize: '13px' }}>
                        {f.nombreEntidadResuelto}
                      </div>
                      <div style={{ fontSize: '11px', color: paleta.muted, display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>CUIT: {f.cuit || 'Sin CUIT'}</span>
                        {f.esNuevo && (
                          <span style={{
                            background: '#EFF6FF', color: '#1D4ED8',
                            padding: '1px 5px', borderRadius: '3px', fontWeight: '600'
                          }}>
                            {tipoOperacion === 'ventas' ? '+ Nuevo cliente' : '+ Nuevo proveedor'}
                          </span>
                        )}
                      </div>
                    </td>
                    {tipoOperacion === 'compras' && (
                      <td style={s.tablaCell}>
                        <select
                          value={f.categoria}
                          onChange={e => actualizarFila(i, 'categoria', e.target.value)}
                          disabled={!f.incluir}
                          style={{
                            ...s.input, padding: '3px 6px', fontSize: '11.5px', width: 'auto',
                            borderColor: paleta.line
                          }}
                        >
                          {CATEGORIAS_COMPRA.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td style={{ ...s.tablaCellBold, textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>
                      {f.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </td>
                    <td style={{ ...s.tablaCell, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={f.yaCompletada}
                        onChange={e => actualizarFila(i, 'yaCompletada', e.target.checked)}
                        disabled={!f.incluir}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px',
              padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', color: paleta.danger, fontSize: '13px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* BOTONES DE CONFIRMACIÓN */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button
              type="button"
              style={s.btnSecundario}
              onClick={reiniciar}
              disabled={estado === 'guardando'}
            >
              <X size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              Cancelar
            </button>
            <button
              type="button"
              style={{
                ...s.btnPrimario(tipoOperacion === 'compras' ? '#0F766E' : c.main),
                padding: '9px 20px', fontSize: '13.5px', fontWeight: '700'
              }}
              onClick={confirmarImportacion}
              disabled={estado === 'guardando' || incluidas.length === 0}
            >
              {estado === 'guardando' ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: 6, verticalAlign: '-2px' }} />
                  Importando {incluidas.length} comprobante(s)…
                </>
              ) : (
                `Confirmar e importar ${incluidas.length} factura(s) ${tipoOperacion === 'ventas' ? 'de venta' : 'de compra'}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ESTADO: LISTO */}
      {estado === 'listo' && (
        <div style={{ textAlign: 'center', padding: '36px 16px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={36} color="#059669" style={{ marginBottom: '12px' }} />
          <h4 style={{ color: '#065F46', margin: '0 0 6px', fontWeight: '800', fontSize: '17px' }}>
            ¡Importación exitosa!
          </h4>
          <p style={{ color: '#047857', fontSize: '13.5px', margin: '0 auto 16px', maxWidth: '500px' }}>
            Se importaron <strong>{stats.totalProcesadas} factura(s)</strong> con un total acumulado de{' '}
            <strong>{stats.totalMonto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>.
            Todos los comprobantes quedaron sincronizados con sus números de serie y CAE correspondientes.
          </p>
          <button
            type="button"
            style={{ ...s.btnPrimario(tipoOperacion === 'compras' ? '#0F766E' : c.main), padding: '8px 18px' }}
            onClick={reiniciar}
          >
            <FileUp size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Importar otro archivo de ARCA
          </button>
        </div>
      )}
    </div>
  )
}

export default ImportarARCA
