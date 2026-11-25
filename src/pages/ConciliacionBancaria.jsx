import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase, emitirCambioDatos } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { esCuentaBancaria, clasificarMovimientoBancario } from '../finanzasUtils.js'
import {
  CheckCircle2, AlertCircle, Upload, Check, RefreshCw,
  DollarSign, FileSpreadsheet, Search, Filter, ShieldCheck,
  Download, Link2, Unlink, Layers, ArrowDownLeft, ArrowUpRight,
  Plus, Trash2, X, FileText, CheckSquare, Square, ChevronRight, HelpCircle,
  Building2, Landmark, CreditCard, Receipt, ArrowRightLeft, Users, Zap, Info, Sparkles
} from 'lucide-react'

const c = colores.finanzas

function normalizarTextoHeader(val) {
  return String(val ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function parseMontoCelda(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100
  if (val === null || val === undefined) return 0
  let sVal = String(val).trim()
  if (!sVal) return 0

  // Si viene con prefijo tipo "Saldo Disponible: 10.330,51", quedarnos con el importe
  if (sVal.includes(':')) {
    const despues = sVal.split(':').slice(1).join(':').trim()
    if (despues) sVal = despues
  }

  sVal = sVal.replace(/[$ARS\s]/gi, '')
  const esNegativo = sVal.startsWith('-') || (sVal.startsWith('(') && sVal.endsWith(')')) || sVal.endsWith('-')
  sVal = sVal.replace(/[()\-+]/g, '')
  if (!/\d/.test(sVal)) return 0

  if (sVal.includes(',') && sVal.includes('.')) {
    if (sVal.lastIndexOf(',') > sVal.lastIndexOf('.')) {
      sVal = sVal.replace(/\./g, '').replace(',', '.')
    } else {
      sVal = sVal.replace(/,/g, '')
    }
  } else if (sVal.includes(',')) {
    sVal = sVal.replace(',', '.')
  } else if ((sVal.match(/\./g) || []).length > 1) {
    sVal = sVal.replace(/\./g, '')
  }

  const num = parseFloat(sVal)
  if (isNaN(num)) return 0
  return Math.round((esNegativo ? -num : num) * 100) / 100
}

function parseFechaCelda(val) {
  if (val === null || val === undefined || val === '') return null

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof val === 'number' && val > 20000 && val < 90000) {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  const limpio = String(val).trim().replace(/^["']|["']$/g, '').split(' ')[0]
  const partes = limpio.split(/[/\-.]/)
  if (partes.length === 3 && partes.every(p => /^\d+$/.test(p))) {
    if (partes[0].length === 4) {
      return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
    }
    const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2].padStart(4, '20')
    const mes = partes[1].padStart(2, '0')
    const dia = partes[0].padStart(2, '0')
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(dia) >= 1 && Number(dia) <= 31) {
      return `${anio}-${mes}-${dia}`
    }
  }
  return null
}

function extraerSaldoDeCeldaTexto(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return isNaN(val) ? null : Math.round(val * 100) / 100
  const texto = String(val).trim()
  if (!texto) return null
  const norm = normalizarTextoHeader(texto)
  if (norm.includes('saldo')) {
    const match = texto.match(/[-+(]?\s*\$?\s*[\d.]+,\d{1,2}|[-+(]?\s*\$?\s*\d+(?:\.\d{1,2})?/)
    if (match) {
      return parseMontoCelda(texto)
    }
  }
  return null
}

// Saldo del movimiento más nuevo cuando el extracto no informa el saldo en el encabezado.
// Prueba la continuidad entre filas consecutivas para saber si el archivo viene del más nuevo al más
// viejo y si "Saldo parcial" es el saldo antes o después de cada movimiento (BBVA: antes).
function saldoFinalPorContinuidad(filas) {
  const f = (filas || []).filter(x => x.saldo != null)
  if (f.length === 0) return null
  if (f.length === 1) return Math.round((f[0].saldo + f[0].monto) * 100) / 100
  const ok = (a, b) => Math.abs(a - b) < 0.05
  const c = { descAntes: 0, ascAntes: 0, descDespues: 0, ascDespues: 0 }
  for (let i = 0; i < f.length - 1; i++) {
    const a = f[i], b = f[i + 1]
    if (ok(b.saldo + b.monto, a.saldo)) c.descAntes++
    if (ok(a.saldo + a.monto, b.saldo)) c.ascAntes++
    if (ok(a.saldo, b.saldo + a.monto)) c.descDespues++
    if (ok(b.saldo, a.saldo + b.monto)) c.ascDespues++
  }
  const mejor = Object.entries(c).sort((x, y) => y[1] - x[1])[0]
  if (mejor[1] === 0) return null
  const desc = mejor[0].startsWith('desc'), antes = mejor[0].endsWith('Antes')
  const nueva = desc ? f[0] : f[f.length - 1]
  return Math.round((antes ? nueva.saldo + nueva.monto : nueva.saldo) * 100) / 100
}

// ¿El extracto pertenece a la cuenta elegida? (compara los dígitos del número de cuenta del encabezado del banco)
function cuentaNoCoincide(meta, cuenta) {
  const nro = String(meta?.cuenta || '').split('(')[0].replace(/\D/g, '')
  if (!nro || !cuenta) return false
  const dest = `${cuenta.banco || ''} ${cuenta.numero || ''}`.replace(/\D/g, '')
  return dest.length > 0 && !dest.includes(nro)
}

// Parseo unificado de matrices (Excel .xlsx/.xls y CSV/TSV) con soporte completo para extractos BBVA y bancos argentinos
function parsearMatrizResumenBancario(matrizRaw) {
  if (!Array.isArray(matrizRaw) || matrizRaw.length === 0) {
    return { filas: [], meta: { empresa: '', cuenta: '', sucursal: '', saldoHeader: null, saldoUltimoMovimiento: null, saldoFinal: null, periodo: '' } }
  }

  const filasRaw = matrizRaw.map(fila =>
    Array.isArray(fila) ? fila.map(celda => (celda === null || celda === undefined ? '' : celda)) : [fila]
  )

  // 1. Buscar la fila cabecera dentro de las primeras 35 filas
  let headerIndex = -1
  for (let i = 0; i < Math.min(filasRaw.length, 35); i++) {
    const cols = filasRaw[i].map(normalizarTextoHeader)
    const tieneFecha = cols.some(col => col === 'fecha' || col.startsWith('fecha') || col === 'fec' || col === 'dia')
    const tieneColFinanciera = cols.some(col =>
      col.includes('concepto') || col.includes('descrip') || col.includes('detalle') ||
      col.includes('movimiento') || col.includes('importe') || col.includes('monto') ||
      col.includes('debito') || col.includes('credito') || col.includes('saldo')
    )
    if (tieneFecha && tieneColFinanciera) {
      headerIndex = i
      break
    }
  }

  // 2. Extraer metadatos superiores previos a la tabla (Empresa, Cuenta, Sucursal, Saldo, Movimientos de)
  const meta = {
    empresa: '',
    cuenta: '',
    sucursal: '',
    saldoHeader: null,
    saldoUltimoMovimiento: null,
    saldoFinal: null,
    periodo: ''
  }

  const limiteMeta = headerIndex !== -1 ? headerIndex : Math.min(filasRaw.length, 10)
  for (let i = 0; i < limiteMeta; i++) {
    const fila = filasRaw[i]
    for (let j = 0; j < fila.length; j++) {
      const cel = String(fila[j] ?? '').trim()
      if (!cel) continue
      const norm = normalizarTextoHeader(cel)
      // Buscar el valor en la primera celda no vacía siguiente
      const siguienteValor = (() => {
        for (let k = j + 1; k < fila.length; k++) {
          if (fila[k] !== '' && fila[k] !== null && fila[k] !== undefined) return fila[k]
        }
        return null
      })()

      if (norm.startsWith('empresa') && siguienteValor !== null) {
        meta.empresa = String(siguienteValor).trim()
        break
      } else if (norm.startsWith('cuenta') && siguienteValor !== null) {
        meta.cuenta = String(siguienteValor).trim()
        break
      } else if (norm.startsWith('sucursal') && siguienteValor !== null) {
        meta.sucursal = String(siguienteValor).trim()
        break
      } else if ((norm === 'saldo:' || norm === 'saldo' || norm.startsWith('saldo actual') || norm.startsWith('saldo disponible')) && siguienteValor !== null) {
        const sNum = parseMontoCelda(siguienteValor)
        if (!isNaN(sNum)) meta.saldoHeader = sNum
        break
      } else if ((norm.startsWith('movimientos') || norm.startsWith('periodo')) && siguienteValor !== null) {
        meta.periodo = String(siguienteValor).trim()
        break
      }
    }
  }

  // 3. Mapear índices de columnas
  let iFecha = -1, iFechaValor = -1, iConcepto = -1, iDetalle = -1
  let iDebito = -1, iCredito = -1, iImporte = -1, iSaldo = -1, iComp = -1
  let dataStartIndex = 0

  if (headerIndex !== -1) {
    dataStartIndex = headerIndex + 1
    const h = filasRaw[headerIndex].map(normalizarTextoHeader)
    h.forEach((col, idx) => {
      if (!col) return
      if (col === 'fecha' || ((col.includes('fecha') || col === 'fec' || col === 'dia') && !col.includes('valor') && iFecha === -1)) {
        iFecha = idx
      } else if (col.includes('fecha') && col.includes('valor')) {
        iFechaValor = idx
      } else if (col.includes('concepto') || col.includes('descrip') || col.includes('movimiento') || col.includes('motivo') || col.includes('transaccion')) {
        if (iConcepto === -1) iConcepto = idx
      } else if (col.includes('detalle')) {
        iDetalle = idx
      } else if (col.includes('debito') || col.includes('cargo') || col.includes('egreso') || col === 'debe') {
        iDebito = idx
      } else if (col.includes('credito') || col.includes('abono') || col.includes('ingreso') || col === 'haber') {
        iCredito = idx
      } else if (col.includes('importe') || col.includes('monto') || col === 'valor') {
        iImporte = idx
      } else if (col.includes('saldo')) {
        iSaldo = idx
      } else if (col.includes('comp') || col.includes('ref') || col.includes('numero') || col.includes('ticket')) {
        iComp = idx
      }
    })
    if (iFecha === -1 && iFechaValor !== -1) iFecha = iFechaValor
    if (iConcepto === -1 && iDetalle !== -1) {
      iConcepto = iDetalle
      iDetalle = -1
    }
  } else {
    iFecha = 0
    iConcepto = 1
    if (filasRaw[0] && filasRaw[0].length >= 4 && filasRaw.some(r => parseMontoCelda(r[2]) !== 0 && parseMontoCelda(r[3]) !== 0)) {
      iImporte = 2
      iSaldo = 3
    } else {
      iImporte = 2
    }
  }

  if (iFecha === -1) iFecha = 0
  if (iConcepto === -1) iConcepto = 1

  const resultado = []
  for (let i = dataStartIndex; i < filasRaw.length; i++) {
    const f = filasRaw[i]
    if (!f || f.length < 2 || !f.some(col => String(col ?? '').trim().length > 0)) continue

    const fecha = parseFechaCelda(f[iFecha]) || (iFechaValor !== -1 ? parseFechaCelda(f[iFechaValor]) : null)
    if (!fecha) continue // Saltar filas vacías, encabezados repetidos o totales sin fecha

    const conceptoBase = String(f[iConcepto] ?? '').trim()
    const detalleExtra = iDetalle !== -1 ? String(f[iDetalle] ?? '').trim() : ''
    const refComp = iComp !== -1 ? String(f[iComp] ?? '').trim() : ''
    const referencia = [detalleExtra, refComp].filter(Boolean).join(' · ')
    const concepto = conceptoBase || detalleExtra || 'Movimiento bancario'

    let monto = 0
    if (iDebito !== -1 && iCredito !== -1) {
      const cred = Math.abs(parseMontoCelda(f[iCredito]))
      const deb = Math.abs(parseMontoCelda(f[iDebito]))
      if (cred > 0 && deb === 0) monto = cred
      else if (deb > 0 && cred === 0) monto = -deb
      else monto = Math.round((cred - deb) * 100) / 100
    } else if (iImporte !== -1 && f[iImporte] !== '' && f[iImporte] !== null && f[iImporte] !== undefined) {
      monto = parseMontoCelda(f[iImporte])
    } else if (f[2] !== undefined) {
      monto = parseMontoCelda(f[2])
    }

    // Red de seguridad: impuestos y comisiones del banco son siempre débitos. Si el archivo los trae sin
    // signo (una sola columna de importe), se toman como egreso. Devoluciones y reintegros se respetan.
    let signoCorregido = false
    if (monto > 0 && iCredito === -1) {
      const dn = conceptoBase.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const tipoCl = clasificarMovimientoBancario(conceptoBase, monto).tipo
      if ((tipoCl === 'impuesto' || tipoCl === 'gasto_bancario' || /debito autom/.test(dn)) &&
          !/devol|reint|reversa|bonif|anula|acredit|ajuste a favor/.test(dn)) {
        monto = -monto
        signoCorregido = true
      }
    }

    if (monto === 0 && !conceptoBase) continue

    // Buscar saldo explícito en la columna Saldo o en cualquier columna adicional con texto "Saldo Disponible: ..."
    let saldoInformado = null
    if (iSaldo !== -1 && f[iSaldo] !== '' && f[iSaldo] !== null && f[iSaldo] !== undefined) {
      const s = extraerSaldoDeCeldaTexto(f[iSaldo]) ?? parseMontoCelda(f[iSaldo])
      if (s !== null && !isNaN(s)) saldoInformado = s
    }
    if (saldoInformado === null) {
      for (let colIdx = 0; colIdx < f.length; colIdx++) {
        if (colIdx === iFecha || colIdx === iFechaValor || colIdx === iConcepto || colIdx === iDebito || colIdx === iCredito) continue
        const sDetectado = extraerSaldoDeCeldaTexto(f[colIdx])
        if (sDetectado !== null) {
          saldoInformado = sDetectado
          break
        }
      }
    }

    resultado.push({
      id: `ext_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      fecha,
      descripcion: concepto,
      monto,
      credito: monto > 0 ? monto : 0,
      debito: monto < 0 ? Math.abs(monto) : 0,
      saldo: saldoInformado,
      saldoInformado: saldoInformado !== null,
      signoCorregido,
      referencia
    })
  }

  if (resultado.length === 0) {
    return { filas: [], meta }
  }

  // 4. Detectar orden cronológico (BBVA exporta descendente: más reciente primero) y completar saldos intradía
  const esDescendente = resultado.length > 1 && resultado[0].fecha > resultado[resultado.length - 1].fecha
  const crono = esDescendente ? [...resultado].reverse() : [...resultado]

  const primerIdxConSaldo = crono.findIndex(r => r.saldo !== null)
  if (primerIdxConSaldo !== -1) {
    for (let j = primerIdxConSaldo - 1; j >= 0; j--) {
      crono[j].saldo = Math.round((crono[j + 1].saldo - crono[j + 1].monto) * 100) / 100
    }
    for (let j = primerIdxConSaldo + 1; j < crono.length; j++) {
      if (crono[j].saldo === null) {
        crono[j].saldo = Math.round((crono[j - 1].saldo + crono[j].monto) * 100) / 100
      }
    }
  } else if (meta.saldoHeader !== null) {
    crono[crono.length - 1].saldo = meta.saldoHeader
    for (let j = crono.length - 2; j >= 0; j--) {
      crono[j].saldo = Math.round((crono[j + 1].saldo - crono[j + 1].monto) * 100) / 100
    }
  }

  const saldoUltimoMovimiento = crono[crono.length - 1]?.saldo ?? null
  meta.saldoUltimoMovimiento = saldoUltimoMovimiento
  meta.saldoFinal = meta.saldoHeader !== null ? meta.saldoHeader : (saldoFinalPorContinuidad(resultado) ?? saldoUltimoMovimiento)
  meta.esDescendente = esDescendente

  return { filas: resultado, meta }
}

// Parseo de texto plano (CSV, TSV o copiado directo de Homebanking)
function parsearResumenBancario(texto, delimitadorForzado) {
  if (!texto || !texto.trim()) {
    return { filas: [], meta: { empresa: '', cuenta: '', sucursal: '', saldoHeader: null, saldoUltimoMovimiento: null, saldoFinal: null, periodo: '' } }
  }
  const textoLimpio = texto.replace(/^\uFEFF/, '').trim()
  const lineas = textoLimpio.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lineas.length === 0) {
    return { filas: [], meta: { empresa: '', cuenta: '', sucursal: '', saldoHeader: null, saldoUltimoMovimiento: null, saldoFinal: null, periodo: '' } }
  }

  let sep = delimitadorForzado
  if (!sep) {
    const muestra = lineas.slice(0, 10)
    const cuentaTabs = muestra.filter(l => l.includes('\t')).length
    const cuentaSemi = muestra.filter(l => (l.match(/;/g) || []).length >= 2).length
    const cuentaComa = muestra.filter(l => (l.match(/,/g) || []).length >= 2).length
    if (cuentaTabs > 0) sep = '\t'
    else if (cuentaSemi >= cuentaComa && cuentaSemi > 0) sep = ';'
    else if (cuentaComa > 0) sep = ','
    else sep = '\t'
  }

  const filasRaw = lineas.map(l => l.split(sep).map(col => col.trim().replace(/^["']|["']$/g, '')))
  return parsearMatrizResumenBancario(filasRaw)
}

function ConciliacionBancaria({
  cuentas = [],
  movimientos = [],
  facturasCompra = [],
  facturasVenta = [],
  pagosCompra = [],
  pagosVenta = [],
  proveedores = [],
  clientes = [],
  onActualizarDatos,
  cuentaInicialId
}) {
  // En conciliación bancaria SOLO se admiten cuentas de banco reales, NUNCA efectivo
  const cuentasBancarias = useMemo(() => {
    return cuentas.filter(esCuentaBancaria)
  }, [cuentas])

  const [cuentaId, setCuentaId] = useState(() => {
    if (cuentaInicialId && cuentasBancarias.some(ct => ct.id === cuentaInicialId)) {
      return cuentaInicialId
    }
    return cuentasBancarias[0]?.id || ''
  })
  const [prevCuentaInicialId, setPrevCuentaInicialId] = useState(cuentaInicialId)

  // Ajustar cuenta si cuentaInicialId cambia
  if (cuentaInicialId !== prevCuentaInicialId) {
    setPrevCuentaInicialId(cuentaInicialId)
    if (cuentaInicialId && cuentasBancarias.some(ct => ct.id === cuentaInicialId)) {
      setCuentaId(cuentaInicialId)
    }
  }

  // Si la cuenta actual seleccionada no pertenece a cuentas bancarias, ajustar
  if (cuentaId && !cuentasBancarias.some(ct => ct.id === cuentaId) && cuentasBancarias.length > 0) {
    setCuentaId(cuentasBancarias[0]?.id || '')
  } else if (!cuentaId && cuentasBancarias.length > 0) {
    setCuentaId(cuentasBancarias[0]?.id || '')
  }

  const [extractosPorCuenta, setExtractosPorCuenta] = useState(() => {
    try {
      const rawExt = localStorage.getItem('briseo_extractos_bancarios')
      return rawExt ? JSON.parse(rawExt) : {}
    } catch {
      return {}
    }
  })
  const [extractoActivoId, setExtractoActivoId] = useState('')
  const [conciliacionesMap, setConciliacionesMap] = useState(() => {
    try {
      const rawConc = localStorage.getItem('briseo_conciliaciones')
      return rawConc ? JSON.parse(rawConc) : {}
    } catch {
      return {}
    }
  }) // { [extractoRowId]: movimientoId }

  // Filtros
  const [filtroVista, setFiltroVista] = useState('todos') // todos | pendientes | conciliados
  const [filtroTipo, setFiltroTipo] = useState('todos') // todos | transferencia | gasto_bancario | impuesto | sueldo
  const [busqueda, setBusqueda] = useState('')
  const [vistaInforme, setVistaInforme] = useState(false)

  // Modales
  const [modalCarga, setModalCarga] = useState(false)
  const [modoCarga, setModoCarga] = useState('archivo') // archivo | pegar | manual
  const [nombreExtracto, setNombreExtracto] = useState('')
  const [textoPegado, setTextoPegado] = useState('')
  const [delimitadorSel] = useState('')
  const [filasPrevia, setFilasPrevia] = useState([])
  const [metaPrevia, setMetaPrevia] = useState(null)
  const [cargandoArchivo, setCargandoArchivo] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')

  // Modal para vincular a factura de compra / venta
  const [vincularFacturaModal, setVincularFacturaModal] = useState(null)
  const [guardandoVinculacionFactura, setGuardandoVinculacionFactura] = useState(false)
  const [busquedaFactura, setBusquedaFactura] = useState('')

  // Modal Guía Explicativa
  const [modalGuia, setModalGuia] = useState(false)
  const [autoRegistrandoLote, setAutoRegistrandoLote] = useState(false)

  // Incorporar fila del extracto a movimientos
  const [incorporandoFila, setIncorporandoFila] = useState(null)
  const [formInc, setFormInc] = useState({
    categoria: 'Gastos bancarios',
    descripcion: '',
    forma_pago: 'Transferencia',
    comprobante: '',
    cuenta_id: ''
  })
  const [guardandoInc, setGuardandoInc] = useState(false)

  // Selección manual en dos columnas
  const [bancoSeleccionado, setBancoSeleccionado] = useState(null)
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState(null)

  // Guardar en localStorage ante cambios
  function guardarExtractosEnStorage(nuevosExtractos) {
    setExtractosPorCuenta(nuevosExtractos)
    try {
      localStorage.setItem('briseo_extractos_bancarios', JSON.stringify(nuevosExtractos))
    } catch (e) {
      console.warn('Error saving extractos in storage:', e)
    }
  }

  function guardarConciliacionesEnStorage(nuevoMap) {
    setConciliacionesMap(nuevoMap)
    try {
      localStorage.setItem('briseo_conciliaciones', JSON.stringify(nuevoMap))
    } catch (e) {
      console.warn('Error saving conciliaciones in storage:', e)
    }
  }

  const cuentaActiva = useMemo(() => {
    return cuentasBancarias.find(ct => ct.id === cuentaId) || cuentasBancarias[0] || null
  }, [cuentasBancarias, cuentaId])

  // Lista de extractos de la cuenta actual
  const extractosDeEstaCuenta = useMemo(() => {
    if (!cuentaId) return []
    return extractosPorCuenta[cuentaId] || []
  }, [extractosPorCuenta, cuentaId])

  // Extracto activo
  const extractoActual = useMemo(() => {
    if (!extractosDeEstaCuenta.length) return null
    if (extractoActivoId) {
      const found = extractosDeEstaCuenta.find(e => e.id === extractoActivoId)
      if (found) return found
    }
    return extractosDeEstaCuenta[extractosDeEstaCuenta.length - 1]
  }, [extractosDeEstaCuenta, extractoActivoId])

  // Movimientos del sistema pertenecientes a esta cuenta
  const movimientosSistemaCuenta = useMemo(() => {
    if (!cuentaId) return []
    return movimientos
      .filter(m => m.cuenta_id === cuentaId)
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [movimientos, cuentaId])

  // Mapeo de conciliados inversos (movimientoId -> extractoFilaId)
  const movConciliadosSet = useMemo(() => {
    return new Set(Object.values(conciliacionesMap))
  }, [conciliacionesMap])

  // Procesar archivo al subir (.xlsx, .xls, .csv, .txt, .tsv)
  function manejarSubidaArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorCarga('')
    setCargandoArchivo(true)
    setFilasPrevia([])
    setMetaPrevia(null)
    setNombreExtracto(file.name.replace(/\.[^/.]+$/, ''))

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const esExcel = ['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const result = evt.target?.result
        let parsed = { filas: [], meta: null }

        if (esExcel && result instanceof ArrayBuffer) {
          try {
            const wb = XLSX.read(new Uint8Array(result), { type: 'array', cellDates: false })
            let mejorMatriz = []
            for (const sheetName of wb.SheetNames) {
              const ws = wb.Sheets[sheetName]
              const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
              if (matriz.length > mejorMatriz.length) mejorMatriz = matriz
            }
            parsed = parsearMatrizResumenBancario(mejorMatriz)
          } catch {
            // Fallback por si el archivo .xls fuera en realidad texto CSV/TSV
            const dec = new TextDecoder('utf-8')
            parsed = parsearResumenBancario(dec.decode(result), delimitadorSel || undefined)
          }
        } else if (typeof result === 'string') {
          parsed = parsearResumenBancario(result, delimitadorSel || undefined)
        }

        if (!parsed.filas || parsed.filas.length === 0) {
          setErrorCarga('No se pudieron extraer transacciones del archivo. Verificá que contenga columnas de Fecha, Concepto, Crédito/Débito o Importe.')
        } else {
          setFilasPrevia(parsed.filas)
          setMetaPrevia(parsed.meta)
          if (parsed.meta?.cuenta && !nombreExtracto) {
            setNombreExtracto(`${file.name.replace(/\.[^/.]+$/, '')} · ${parsed.meta.cuenta}`)
          }
        }
      } catch (err) {
        setErrorCarga('Error al leer el archivo: ' + err.message)
      } finally {
        setCargandoArchivo(false)
      }
    }
    reader.onerror = () => {
      setErrorCarga('Error al abrir el archivo.')
      setCargandoArchivo(false)
    }

    if (esExcel) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file, 'UTF-8')
    }
  }

  // Procesar texto pegado
  function manejarProcesarTextoPegado() {
    setErrorCarga('')
    setMetaPrevia(null)
    if (!textoPegado.trim()) {
      setErrorCarga('Pegá las filas de tu Homebanking en el área de texto.')
      return
    }
    try {
      const parsed = parsearResumenBancario(textoPegado, delimitadorSel || undefined)
      if (!parsed.filas || parsed.filas.length === 0) {
        setErrorCarga('No se detectaron transacciones válidas en el texto pegado.')
      } else {
        setFilasPrevia(parsed.filas)
        setMetaPrevia(parsed.meta)
      }
    } catch (err) {
      setErrorCarga('Error al procesar: ' + err.message)
    }
  }

  // Confirmar y guardar el extracto bancario cargado
  function confirmarGuardarExtracto() {
    if (!cuentaId) {
      alert('Seleccioná una cuenta bancaria.')
      return
    }
    if (filasPrevia.length === 0) {
      alert('No hay transacciones para guardar.')
      return
    }
    if (cuentaNoCoincide(metaPrevia, cuentaActiva) &&
        !window.confirm(`Este extracto es de la cuenta ${metaPrevia.cuenta}, pero elegiste ${cuentaActiva?.banco}. ¿Guardarlo igual?`)) {
      return
    }

    const saldoUltimoPorOrden = metaPrevia?.esDescendente
      ? filasPrevia[0]?.saldo
      : filasPrevia[filasPrevia.length - 1]?.saldo
    const saldoFinalCalculado = metaPrevia?.saldoFinal ?? saldoUltimoPorOrden ?? null

    const nuevoExtracto = {
      id: `ext_banco_${Date.now()}`,
      nombre: nombreExtracto.trim() || `Resumen ${cuentaActiva?.banco || 'Bancario'} (${new Date().toLocaleDateString('es-AR')})`,
      fechaCarga: new Date().toISOString(),
      cuentaId,
      filas: filasPrevia,
      totalMovimientos: filasPrevia.length,
      saldoFinal: saldoFinalCalculado,
      meta: metaPrevia || null
    }

    const listaActual = extractosPorCuenta[cuentaId] || []
    const nuevaLista = [...listaActual, nuevoExtracto]
    const nuevoMap = { ...extractosPorCuenta, [cuentaId]: nuevaLista }

    guardarExtractosEnStorage(nuevoMap)
    setExtractoActivoId(nuevoExtracto.id)
    setModalCarga(false)
    setFilasPrevia([])
    setMetaPrevia(null)
    setTextoPegado('')
    setNombreExtracto('')

    // Ejecutar auto-conciliación inmediata
    autoConciliar(nuevoExtracto.filas, movimientosSistemaCuenta, conciliacionesMap)
  }

  // Auto-conciliación inteligente
  function autoConciliar(filasBancoParam, movsSistemaParam, mapActualParam) {
    const filasBanco = filasBancoParam || extractoActual?.filas || []
    const movsSistema = movsSistemaParam || movimientosSistemaCuenta || []
    const mapActual = { ...(mapActualParam || conciliacionesMap) }

    let countCoincidencias = 0

    // Recorrer filas del banco no conciliadas
    filasBanco.forEach(b => {
      if (mapActual[b.id]) return // Ya conciliada

      const montoBanco = Number(b.monto)
      const esIngresoBanco = montoBanco > 0
      const absMontoBanco = Math.abs(montoBanco)

      // Buscar candidato en sistema que coincida en signo, monto y fecha cercana (±4 días)
      const candidato = movsSistema.find(m => {
        // No debe estar ya conciliado con otra fila
        if (Object.values(mapActual).includes(m.id)) return false

        // Coincidencia de tipo
        if (esIngresoBanco && m.tipo !== 'ingreso') return false
        if (!esIngresoBanco && m.tipo !== 'egreso') return false

        // Coincidencia de monto exacto
        if (Math.abs(Number(m.monto) - absMontoBanco) > 0.02) return false

        // Coincidencia de fecha dentro de ±4 días
        const diffDias = Math.abs((new Date(b.fecha) - new Date(m.fecha)) / (1000 * 60 * 60 * 24))
        return diffDias <= 4
      })

      if (candidato) {
        mapActual[b.id] = candidato.id
        countCoincidencias++
      }
    })

    guardarConciliacionesEnStorage(mapActual)
    if (countCoincidencias > 0) {
      alert(`Auto-conciliación exitosa: se emparejaron ${countCoincidencias} movimientos con el extracto bancario.`)
    } else {
      alert('No se encontraron nuevas coincidencias exactas para auto-conciliar.')
    }
  }

  // Vincular pareja seleccionada manualmente
  function vincularParejaSeleccionada() {
    if (!bancoSeleccionado || !sistemaSeleccionado) {
      alert('Seleccioná un movimiento del extracto bancario y un movimiento del sistema para vincularlos.')
      return
    }

    const nuevoMap = { ...conciliacionesMap, [bancoSeleccionado.id]: sistemaSeleccionado.id }
    guardarConciliacionesEnStorage(nuevoMap)
    setBancoSeleccionado(null)
    setSistemaSeleccionado(null)
  }

  // Desvincular una fila
  function desvincularFila(filaBancoId) {
    const nuevoMap = { ...conciliacionesMap }
    delete nuevoMap[filaBancoId]
    guardarConciliacionesEnStorage(nuevoMap)
  }

  // Reiniciar todas las conciliaciones del extracto
  function reiniciarConciliaciones() {
    if (!confirm('¿Deseas desvincular todas las conciliaciones de este resumen bancario?')) return
    const nuevoMap = { ...conciliacionesMap }
    ;(extractoActual?.filas || []).forEach(f => {
      delete nuevoMap[f.id]
    })
    guardarConciliacionesEnStorage(nuevoMap)
    setBancoSeleccionado(null)
    setSistemaSeleccionado(null)
  }

  // Eliminar extracto guardado
  function eliminarExtractoActual() {
    if (!confirm(`¿Eliminar el extracto "${extractoActual?.nombre}"?`)) return
    const lista = extractosDeEstaCuenta.filter(e => e.id !== extractoActual.id)
    const nuevoMap = { ...extractosPorCuenta, [cuentaId]: lista }
    guardarExtractosEnStorage(nuevoMap)
    setExtractoActivoId(lista[lista.length - 1]?.id || '')
  }

  // Saldo pendiente de factura de compra (proveedor)
  function saldoFacturaCompra(fact) {
    const pagado = (pagosCompra || [])
      .filter(p => p.factura_compra_id === fact.id)
      .reduce((a, p) => a + Number(p.monto), 0)
    return Math.max(0, Number(fact.total) - pagado)
  }

  // Saldo pendiente de factura de venta (cliente)
  function saldoFacturaVenta(fact) {
    const pagado = (pagosVenta || [])
      .filter(p => p.factura_id === fact.id)
      .reduce((a, p) => a + Number(p.monto), 0)
    return Math.max(0, Number(fact.total) - pagado)
  }

  // Abrir modal para incorporar fila del banco a movimientos_financieros
  function abrirIncorporarFila(fila, categoriaForzada) {
    setIncorporandoFila(fila)
    const clasif = clasificarMovimientoBancario(fila.descripcion, fila.monto)
    const sugerenciaCat = categoriaForzada || clasif.categoriaSugerida

    setFormInc({
      categoria: sugerenciaCat,
      descripcion: fila.descripcion,
      forma_pago: (clasif.tipo === 'impuesto' || clasif.tipo === 'gasto_bancario') ? 'Débito automático' : 'Transferencia',
      comprobante: fila.referencia || '',
      cuenta_id: cuentaId
    })
  }

  // Abrir modal para vincular fila del banco con factura de proveedor o cliente
  function abrirVincularFactura(fila) {
    const esCompra = Number(fila.monto) < 0 // Egreso = pago proveedor, Ingreso = cobro cliente
    setVincularFacturaModal({
      fila,
      esCompra,
      factura: null,
      referencia: fila.referencia || ''
    })
    setBusquedaFactura('')
  }

  // Confirmar vinculación de factura con movimiento bancario (registra el pago y cancela la factura)
  async function confirmarVinculacionFactura(e) {
    e.preventDefault()
    if (!vincularFacturaModal?.fila || !vincularFacturaModal?.factura) {
      alert('Por favor seleccioná una factura para vincular.')
      return
    }
    setGuardandoVinculacionFactura(true)
    try {
      const { fila, factura, esCompra, referencia } = vincularFacturaModal
      const montoFila = Math.abs(Number(fila.monto))
      const fechaPago = fila.fecha || new Date().toISOString().split('T')[0]

      if (esCompra) {
        // 1. Registrar pago_compra
        await supabase.from('pagos_compra').insert([{
          factura_compra_id: factura.id,
          monto: montoFila,
          medio_pago: 'transferencia',
          cuenta_id: cuentaId,
          referencia: referencia || fila.referencia || null
        }])

        // 2. Registrar movimiento financiero de egreso
        const { data: nuevoMov, error: errMov } = await supabase.from('movimientos_financieros').insert([{
          fecha: fechaPago,
          tipo: 'egreso',
          categoria: factura.categoria || 'Insumos',
          descripcion: `Pago factura ${factura.numero_factura || 's/n'} — ${factura.proveedores?.razon_social || 'Proveedor'}`,
          monto: montoFila,
          cuenta_id: cuentaId,
          comprobante: referencia || fila.referencia || factura.numero_factura || null,
          forma_pago: 'Transferencia'
        }]).select('id').single()

        if (errMov) throw errMov

        // 3. Actualizar estado de la factura de compra
        const totalPagadoAntes = (pagosCompra || [])
          .filter(p => p.factura_compra_id === factura.id)
          .reduce((a, p) => a + Number(p.monto), 0)
        const totalPagadoNuevo = totalPagadoAntes + montoFila
        const nuevoEstado = totalPagadoNuevo >= Number(factura.total) - 0.01 ? 'pagada' : 'parcial'
        await supabase.from('facturas_compra').update({ estado: nuevoEstado }).eq('id', factura.id)

        // 4. Ajustar saldo de la cuenta bancaria
        if (cuentaId) {
          const { data: ctData } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuentaId).single()
          if (ctData) {
            await supabase.from('cuentas_bancarias').update({ saldo: Number(ctData.saldo) - montoFila }).eq('id', cuentaId)
          }
        }

        // 5. Vincular de inmediato la fila del banco con el nuevo movimiento
        const nuevoMap = { ...conciliacionesMap, [fila.id]: nuevoMov.id }
        guardarConciliacionesEnStorage(nuevoMap)

      } else {
        // Ingreso -> Factura de venta a cliente
        // 1. Registrar pago
        await supabase.from('pagos').insert([{
          factura_id: factura.id,
          fecha_pago: fechaPago,
          monto: montoFila,
          medio_pago: 'transferencia',
          cuenta_id: cuentaId,
          referencia: referencia || fila.referencia || null
        }])

        // 2. Registrar movimiento financiero de ingreso
        const { data: nuevoMov, error: errMov } = await supabase.from('movimientos_financieros').insert([{
          fecha: fechaPago,
          tipo: 'ingreso',
          categoria: 'Cobranzas',
          descripcion: `Cobro factura ${factura.numero_factura || 's/n'} — ${factura.clientes?.razon_social || factura.clientes?.nombre_contacto || 'Cliente'}`,
          monto: montoFila,
          cuenta_id: cuentaId,
          comprobante: referencia || fila.referencia || factura.numero_factura || null,
          forma_pago: 'Transferencia',
          factura_id: factura.id
        }]).select('id').single()

        if (errMov) throw errMov

        // 3. Actualizar estado de la factura de venta
        const totalCobradoAntes = (pagosVenta || [])
          .filter(p => p.factura_id === factura.id)
          .reduce((a, p) => a + Number(p.monto), 0)
        const totalCobradoNuevo = totalCobradoAntes + montoFila
        const nuevoEstado = totalCobradoNuevo >= Number(factura.total) - 0.01 ? 'cobrada' : 'parcial'
        await supabase.from('facturas').update({ estado: nuevoEstado }).eq('id', factura.id)

        // 4. Ajustar saldo de la cuenta bancaria
        if (cuentaId) {
          const { data: ctData } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuentaId).single()
          if (ctData) {
            await supabase.from('cuentas_bancarias').update({ saldo: Number(ctData.saldo) + montoFila }).eq('id', cuentaId)
          }
        }

        // 5. Vincular de inmediato la fila del banco con el nuevo movimiento
        const nuevoMap = { ...conciliacionesMap, [fila.id]: nuevoMov.id }
        guardarConciliacionesEnStorage(nuevoMap)
      }

      setVincularFacturaModal(null)
      if (onActualizarDatos) await onActualizarDatos()
      emitirCambioDatos('conciliacion')
      alert(`Factura #${vincularFacturaModal.factura.numero_factura || 's/n'} vinculada y conciliada exitosamente con el extracto bancario.`)
    } catch (err) {
      alert('Error al vincular factura con el banco: ' + err.message)
    } finally {
      setGuardandoVinculacionFactura(false)
    }
  }

  // Registro en lote (masivo) de gastos bancarios e impuestos no registrados
  async function registrarGastosEImpuestosEnLote() {
    const filasBanco = extractoActual?.filas || []
    const pendientes = filasBanco.filter(f => {
      if (conciliacionesMap[f.id]) return false
      const cl = clasificarMovimientoBancario(f.descripcion, f.monto)
      return cl.tipo === 'gasto_bancario' || cl.tipo === 'impuesto'
    })

    if (pendientes.length === 0) {
      alert('No se encontraron gastos bancarios ni impuestos pendientes de registrar en este resumen.')
      return
    }

    const totalMonto = pendientes.reduce((acc, f) => acc + Math.abs(Number(f.monto)), 0)
    const confirmar = confirm(`¿Deseas registrar automáticamente ${pendientes.length} gastos bancarios e impuestos por un total de ${totalMonto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}?\n\nSe crearán los movimientos contables en Finanzas y quedarán conciliados de inmediato.`)
    if (!confirmar) return

    setAutoRegistrandoLote(true)
    try {
      const nuevoMap = { ...conciliacionesMap }
      let deltaSaldoTotal = 0

      for (const fila of pendientes) {
        const cl = clasificarMovimientoBancario(fila.descripcion, fila.monto)
        const tipo = fila.monto > 0 ? 'ingreso' : 'egreso'
        const montoAbs = Math.abs(Number(fila.monto))
        deltaSaldoTotal += (tipo === 'ingreso' ? montoAbs : -montoAbs)

        const { data: nuevoMov, error: errMov } = await supabase.from('movimientos_financieros').insert([{
          fecha: fila.fecha,
          tipo,
          categoria: cl.categoriaSugerida,
          descripcion: fila.descripcion,
          monto: montoAbs,
          cuenta_id: cuentaId,
          forma_pago: 'Débito automático',
          comprobante: fila.referencia || null
        }]).select('id').single()

        if (!errMov && nuevoMov) {
          nuevoMap[fila.id] = nuevoMov.id
        }
      }

      // Actualizar saldo de cuenta bancaria
      if (cuentaId && deltaSaldoTotal !== 0) {
        const { data: ctData } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuentaId).single()
        if (ctData) {
          await supabase.from('cuentas_bancarias').update({ saldo: Number(ctData.saldo) + deltaSaldoTotal }).eq('id', cuentaId)
        }
      }

      guardarConciliacionesEnStorage(nuevoMap)
      if (onActualizarDatos) await onActualizarDatos()
      emitirCambioDatos('conciliacion')
      alert(`¡Listo! Se registraron y conciliaron ${pendientes.length} partidas de gastos bancarios e impuestos correctamente.`)
    } catch (err) {
      alert('Error en registro en lote: ' + err.message)
    } finally {
      setAutoRegistrandoLote(false)
    }
  }

  // Guardar movimiento incorporado y marcarlo como conciliado
  async function guardarMovimientoIncorporado(e) {
    e.preventDefault()
    if (!incorporandoFila) return
    setGuardandoInc(true)
    try {
      const tipo = incorporandoFila.monto > 0 ? 'ingreso' : 'egreso'
      const montoAbs = Math.abs(incorporandoFila.monto)

      const { data: nuevoMov, error: errMov } = await supabase.from('movimientos_financieros').insert([{
        fecha: incorporandoFila.fecha,
        tipo,
        categoria: formInc.categoria,
        descripcion: formInc.descripcion || incorporandoFila.descripcion,
        monto: montoAbs,
        cuenta_id: cuentaId,
        forma_pago: formInc.forma_pago,
        comprobante: formInc.comprobante || null
      }]).select('id').single()

      if (errMov) throw errMov

      // Ajustar saldo de la cuenta bancaria
      if (cuentaId) {
        const delta = tipo === 'ingreso' ? montoAbs : -montoAbs
        const { data: ctData } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuentaId).single()
        if (ctData) {
          await supabase.from('cuentas_bancarias').update({ saldo: Number(ctData.saldo) + delta }).eq('id', cuentaId)
        }
      }

      // Marcar de inmediato como conciliado
      const nuevoMap = { ...conciliacionesMap, [incorporandoFila.id]: nuevoMov.id }
      guardarConciliacionesEnStorage(nuevoMap)

      setIncorporandoFila(null)
      if (onActualizarDatos) await onActualizarDatos()
      emitirCambioDatos('conciliacion')
      alert('Movimiento registrado en Finanzas y conciliado exitosamente.')
    } catch (err) {
      alert('Error al incorporar movimiento: ' + err.message)
    } finally {
      setGuardandoInc(false)
    }
  }

  // Cálculos de métricas de conciliación y clasificaciones
  const metricas = useMemo(() => {
    const filasBanco = extractoActual?.filas || []
    const totalBanco = filasBanco.length

    let conciliadosCount = 0
    let montoConciliado = 0
    let montoPendienteBanco = 0

    let countTransferencias = 0
    let totalTransferencias = 0
    let countGastosBancarios = 0
    let totalGastosBancarios = 0
    let countImpuestos = 0
    let totalImpuestos = 0
    let countSueldos = 0
    let totalSueldos = 0
    let countGastosImpuestosPendientes = 0
    let totalGastosImpuestosPendientes = 0

    filasBanco.forEach(b => {
      const conc = Boolean(conciliacionesMap[b.id])
      const absMonto = Math.abs(Number(b.monto))
      const cl = clasificarMovimientoBancario(b.descripcion, b.monto)

      if (conc) {
        conciliadosCount++
        montoConciliado += Number(b.monto)
      } else {
        montoPendienteBanco += Number(b.monto)
      }

      if (cl.tipo === 'transferencia') {
        countTransferencias++
        totalTransferencias += absMonto
      } else if (cl.tipo === 'gasto_bancario') {
        countGastosBancarios++
        totalGastosBancarios += absMonto
        if (!conc) {
          countGastosImpuestosPendientes++
          totalGastosImpuestosPendientes += absMonto
        }
      } else if (cl.tipo === 'impuesto') {
        countImpuestos++
        totalImpuestos += absMonto
        if (!conc) {
          countGastosImpuestosPendientes++
          totalGastosImpuestosPendientes += absMonto
        }
      } else if (cl.tipo === 'sueldo') {
        countSueldos++
        totalSueldos += absMonto
      }
    })

    const pendientesBanco = totalBanco - conciliadosCount

    // Movimientos del sistema pendientes (no conciliados con el extracto)
    const movsPendientesSistema = movimientosSistemaCuenta.filter(m => !movConciliadosSet.has(m.id))
    const montoPendienteSistema = movsPendientesSistema.reduce((acc, m) => acc + (m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)), 0)

    const saldoSistema = Number(cuentaActiva?.saldo || 0)
    // El saldo del extracto es el saldo informado en la última fila del banco, o se calcula partiendo del saldo disponible
    const saldoBancoInformado = extractoActual?.saldoFinal ?? (saldoSistema + montoPendienteBanco - montoPendienteSistema)

    const diferencia = saldoBancoInformado - saldoSistema

    return {
      totalBanco,
      conciliadosCount,
      pendientesBanco,
      pendientesSistemaCount: movsPendientesSistema.length,
      saldoBancoInformado,
      saldoSistema,
      diferencia,
      montoConciliado,
      montoPendienteBanco,
      montoPendienteSistema,
      porcentajeConciliado: totalBanco > 0 ? Math.round((conciliadosCount / totalBanco) * 100) : 0,
      countTransferencias,
      totalTransferencias,
      countGastosBancarios,
      totalGastosBancarios,
      countImpuestos,
      totalImpuestos,
      countSueldos,
      totalSueldos,
      countGastosImpuestosPendientes,
      totalGastosImpuestosPendientes
    }
  }, [extractoActual, conciliacionesMap, movimientosSistemaCuenta, movConciliadosSet, cuentaActiva])

  // Filtrado de filas del extracto
  const filasBancoFiltradas = useMemo(() => {
    if (!extractoActual?.filas) return []
    return extractoActual.filas.filter(f => {
      const estaConciliado = Boolean(conciliacionesMap[f.id])
      if (filtroVista === 'pendientes' && estaConciliado) return false
      if (filtroVista === 'conciliados' && !estaConciliado) return false

      const cl = clasificarMovimientoBancario(f.descripcion, f.monto)
      if (filtroTipo !== 'todos' && cl.tipo !== filtroTipo) return false

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        const coincide = f.descripcion.toLowerCase().includes(q) ||
          f.monto.toString().includes(q) ||
          cl.label.toLowerCase().includes(q) ||
          cl.detalle.toLowerCase().includes(q) ||
          (f.referencia && f.referencia.toLowerCase().includes(q))
        if (!coincide) return false
      }
      return true
    })
  }, [extractoActual, conciliacionesMap, filtroVista, filtroTipo, busqueda])

  // Filtrado de movimientos del sistema
  const movimientosSistemaFiltrados = useMemo(() => {
    return movimientosSistemaCuenta.filter(m => {
      const estaConciliado = movConciliadosSet.has(m.id)
      if (filtroVista === 'pendientes' && estaConciliado) return false
      if (filtroVista === 'conciliados' && !estaConciliado) return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        const coincide = (m.descripcion || '').toLowerCase().includes(q) ||
          (m.categoria || '').toLowerCase().includes(q) ||
          m.monto.toString().includes(q) ||
          (m.comprobante && m.comprobante.toLowerCase().includes(q))
        if (!coincide) return false
      }
      return true
    })
  }, [movimientosSistemaCuenta, movConciliadosSet, filtroVista, busqueda])

  if (cuentasBancarias.length === 0) {
    return (
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        padding: '40px 24px',
        border: '1px solid #E2E8F0',
        textAlign: 'center',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
      }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: '#FEF3C7',
          color: '#D97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Building2 size={26} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>
          Solo cuentas bancarias para conciliación
        </h3>
        <p style={{ fontSize: '13.5px', color: '#64748B', maxWidth: '540px', margin: '0 auto 14px', lineHeight: 1.5 }}>
          La conciliación bancaria solo puede realizarse sobre <strong>cuentas de banco</strong> (cuentas corrientes o cajas de ahorro bancarias). Las cuentas de <strong>caja chica o efectivo físico</strong> no admiten resúmenes bancarios.
        </p>
        <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: 0 }}>
          Podés crear una cuenta bancaria desde la sección superior (+ Cuenta) para conciliar movimientos contra extractos.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* CABECERA DE CONCILIACIÓN BANCARIA */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '22px 24px',
        border: '1px solid #E5E7EB',
        marginBottom: '20px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{
              color: '#3B66F5',
              fontSize: '11.5px',
              fontWeight: '600',
              display: 'block',
              marginBottom: '4px'
            }}>
              Control contable · Solo cuentas bancarias
            </span>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.02em' }}>
              Conciliación Bancaria y Resúmenes
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
              Comprobá los saldos de extractos contra tus movimientos contables, auto-conciliá cobros y pagos, y detectá débitos no registrados.
            </p>
          </div>

          {/* ACCIONES SUPERIORES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setModalCarga(true)}
              style={{
                ...s.btnPrimario('#3B66F5'),
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              <Upload size={15} />
              Cargar Resumen Bancario
            </button>
            {extractoActual && (
              <>
                <button
                  type="button"
                  onClick={() => autoConciliar()}
                  title="Emparejar automáticamente por monto y fecha coincidente"
                  style={{
                    background: '#EEF2FF',
                    border: '1px solid #DBEAFE',
                    color: '#3B66F5',
                    borderRadius: '999px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} />
                  Auto-conciliar
                </button>
                <button
                  type="button"
                  onClick={() => setVistaInforme(!vistaInforme)}
                  style={{
                    background: vistaInforme ? '#18191C' : '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    color: vistaInforme ? '#FFFFFF' : '#334155',
                    borderRadius: '999px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileText size={14} />
                  {vistaInforme ? 'Ver Tablero Interactivo' : 'Ver Informe Formal'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setModalGuia(true)}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#334155',
                borderRadius: '999px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Guía práctica: cómo registrar gastos, impuestos y vincular facturas con pagos"
            >
              <HelpCircle size={15} color="#3B66F5" />
              <span>¿Cómo conciliar?</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE CUENTA Y EXTRACTO ACTIVO */}
        <div style={{
          marginTop: '18px',
          paddingTop: '16px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Cuenta Bancaria */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Landmark size={14} color="#3B66F5" />
                <span>Cuenta bancaria:</span>
              </span>
              <select
                style={{
                  ...s.input,
                  minWidth: '220px',
                  padding: '7px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0F172A',
                  borderColor: '#CBD5E1'
                }}
                value={cuentaId}
                onChange={e => {
                  setCuentaId(e.target.value)
                  setExtractoActivoId('')
                  setBancoSeleccionado(null)
                  setSistemaSeleccionado(null)
                }}
              >
                {cuentasBancarias.map(ct => (
                  <option key={ct.id} value={ct.id}>
                    🏦 {ct.banco} — {ct.tipo.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <span style={{
                fontSize: '11px',
                color: '#0F766E',
                background: '#F0FDFA',
                border: '1px solid #CCFBF1',
                padding: '3px 8px',
                borderRadius: '6px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} />
                Solo cuentas de banco (no efectivo)
              </span>
            </div>

            {/* Resumen cargado */}
            {extractosDeEstaCuenta.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Extracto:</span>
                <select
                  style={{
                    ...s.input,
                    minWidth: '240px',
                    padding: '7px 12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0F172A',
                    borderColor: '#CBD5E1'
                  }}
                  value={extractoActual?.id || ''}
                  onChange={e => {
                    setExtractoActivoId(e.target.value)
                    setBancoSeleccionado(null)
                    setSistemaSeleccionado(null)
                  }}
                >
                  {extractosDeEstaCuenta.map(ext => (
                    <option key={ext.id} value={ext.id}>
                      {ext.nombre} ({ext.totalMovimientos} movs)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={eliminarExtractoActual}
                  title="Eliminar este resumen"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>

          {extractoActual && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={reiniciarConciliaciones}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Desconciliar todo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TARJETAS DE SALDOS Y CONCILIACIÓN */}
      {extractoActual ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {/* Card 1: Saldo según Extracto */}
          <div style={{ background: '#3B66F5', color: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(59, 102, 245, 0.22)' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.82)' }}>
              Saldo según Extracto Bancario
            </span>
            <p style={{
              margin: '6px 0 0',
              fontSize: '21px',
              fontWeight: '700',
              fontVariantNumeric: 'tabular-nums',
              color: '#FFFFFF'
            }}>
              {metricas.saldoBancoInformado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.78)', fontWeight: '500', marginTop: '6px', display: 'block' }}>
              {extractoActual?.meta?.saldoHeader != null && extractoActual?.meta?.saldoUltimoMovimiento != null && Math.abs(extractoActual.meta.saldoHeader - extractoActual.meta.saldoUltimoMovimiento) > 0.01
                ? `Cabecera banco (Últ. mov.: ${Number(extractoActual.meta.saldoUltimoMovimiento).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })})`
                : (extractoActual?.meta?.cuenta ? `Cuenta ${extractoActual.meta.cuenta}` : 'Reportado por Homebanking')}
            </span>
          </div>

          {/* Card 2: Saldo según Sistema */}
          <div style={{ ...s.card, margin: 0, padding: '18px 20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>
              Saldo según Libros (Finanzas)
            </span>
            <p style={{
              margin: '6px 0 0',
              fontSize: '21px',
              fontWeight: '700',
              fontVariantNumeric: 'tabular-nums',
              color: metricas.saldoSistema >= 0 ? '#0F172A' : '#DC2626'
            }}>
              {metricas.saldoSistema.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
            <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '6px', display: 'block' }}>
              {movimientosSistemaCuenta.length} movimientos en cuenta
            </span>
          </div>

          {/* Card 3: Diferencia de Conciliación */}
          <div style={{
            ...s.card,
            margin: 0,
            padding: '18px 20px',
            background: Math.abs(metricas.diferencia) < 0.01 ? '#F0FDF4' : '#FFF7ED',
            borderColor: Math.abs(metricas.diferencia) < 0.01 ? '#BBF7D0' : '#FED7AA'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: Math.abs(metricas.diferencia) < 0.01 ? '#15803D' : '#9A3412'
            }}>
              Diferencia de Conciliación
            </span>
            <p style={{
              margin: '6px 0 0',
              fontSize: '21px',
              fontWeight: '700',
              fontVariantNumeric: 'tabular-nums',
              color: Math.abs(metricas.diferencia) < 0.01 ? '#15803D' : '#C2410C'
            }}>
              {Math.abs(metricas.diferencia) < 0.01 ? '$ 0,00' : metricas.diferencia.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '600',
              color: Math.abs(metricas.diferencia) < 0.01 ? '#15803D' : '#C2410C',
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {Math.abs(metricas.diferencia) < 0.01 ? (
                <>
                  <CheckCircle2 size={13} color="#15803D" /> Conciliación Cuadrada
                </>
              ) : (
                <>
                  <AlertCircle size={13} color="#C2410C" /> Partidas por conciliar
                </>
              )}
            </span>
          </div>

          {/* Card 4: Estado de Partidas */}
          <div style={{ background: '#18191C', color: '#FFFFFF', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 30px rgba(24, 25, 28, 0.18)' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.78)' }}>
              Progreso Conciliado
            </span>
            <p style={{
              margin: '6px 0 0',
              fontSize: '21px',
              fontWeight: '700',
              fontVariantNumeric: 'tabular-nums',
              color: '#FFFFFF'
            }}>
              {metricas.porcentajeConciliado}%
            </p>
            <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: '999px', height: '6px', overflow: 'hidden', margin: '8px 0 4px' }}>
              <div style={{
                background: '#A6BEFF',
                height: '100%',
                borderRadius: '999px',
                width: `${metricas.porcentajeConciliado}%`,
                transition: 'width 0.4s ease'
              }} />
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.72)' }}>
              {metricas.conciliadosCount} de {metricas.totalBanco} en extracto
            </span>
          </div>
        </div>
      ) : (
        /* BANNER DE BIENVENIDA A LA CONCILIACIÓN */
        <div style={{
          background: '#FFFFFF',
          border: '2px dashed #CBD5E1',
          borderRadius: '20px',
          padding: '48px 24px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <FileSpreadsheet size={40} color="#3B66F5" style={{ margin: '0 auto 14px' }} />
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
            No hay resúmenes bancarios cargados para {cuentaActiva?.banco || 'esta cuenta'}
          </h4>
          <p style={{ margin: '8px auto 20px', maxWidth: '540px', fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
            Subí el archivo Excel (.xlsx / .xls) o CSV descargado directamente de tu Homebanking (BBVA, Macro, Santander, Galicia, Nación, etc.) con sus movimientos y saldos, o pegá las filas desde tu pantalla.
          </p>
          <button
            type="button"
            onClick={() => setModalCarga(true)}
            style={{
              ...s.btnPrimario('#3B66F5'),
              padding: '10px 22px',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Upload size={16} />
            Cargar primer resumen bancario
          </button>
        </div>
      )}

      {/* VISTA INFORME FORMAL DE CONCILIACIÓN */}
      {vistaInforme && extractoActual && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0F172A', paddingBottom: '14px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                Cédula de Conciliación Bancaria Formal
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748B' }}>
                Entidad: {cuentaActiva?.banco} · {cuentaActiva?.tipo} · Período: {extractoActual.nombre}
              </p>
            </div>
            <span style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontWeight: '700',
              fontSize: '12px',
              background: Math.abs(metricas.diferencia) < 0.01 ? '#ECFDF5' : '#FEF3C7',
              color: Math.abs(metricas.diferencia) < 0.01 ? '#047857' : '#B45309'
            }}>
              {Math.abs(metricas.diferencia) < 0.01 ? 'ESTADO: CONCILIADA Y CUADRADA' : 'ESTADO: CON PARTIDAS PENDIENTES'}
            </span>
          </div>

          <div style={{ maxWidth: '640px', margin: '0 auto', fontSize: '13px', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontWeight: '700' }}>
              <span>Saldo según Resumen Bancario:</span>
              <span style={{ fontFamily: paleta.fontMono }}>{metricas.saldoBancoInformado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#059669' }}>
              <span>(+) Depósitos / Ingresos registrados en empresa no acreditados en banco:</span>
              <span style={{ fontFamily: paleta.fontMono }}>
                {movimientosSistemaCuenta
                  .filter(m => m.tipo === 'ingreso' && !movConciliadosSet.has(m.id))
                  .reduce((a, m) => a + Number(m.monto), 0)
                  .toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#DC2626' }}>
              <span>(-) Pagos / Egresos registrados en empresa no debitados en banco:</span>
              <span style={{ fontFamily: paleta.fontMono }}>
                {movimientosSistemaCuenta
                  .filter(m => m.tipo === 'egreso' && !movConciliadosSet.has(m.id))
                  .reduce((a, m) => a + Number(m.monto), 0)
                  .toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#9333EA' }}>
              <span>(+/-) Movimientos bancarios pendientes de registración contable:</span>
              <span style={{ fontFamily: paleta.fontMono }}>
                {(extractoActual.filas.filter(f => !conciliacionesMap[f.id]).reduce((a, f) => a + Number(f.monto), 0))
                  .toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #0F172A', borderBottom: '2px solid #0F172A', fontWeight: '800', fontSize: '14.5px', marginTop: '10px' }}>
              <span>(=) Saldo según Libros Contables (Finanzas):</span>
              <span style={{ fontFamily: paleta.fontMono, color: '#0F172A' }}>{metricas.saldoSistema.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: '700', color: Math.abs(metricas.diferencia) < 0.01 ? '#059669' : '#DC2626' }}>
              <span>Diferencia Neta de Conciliación:</span>
              <span style={{ fontFamily: paleta.fontMono }}>
                {Math.abs(metricas.diferencia) < 0.01 ? '$ 0,00' : metricas.diferencia.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* BARRA FLOTANTE DE VINCULACIÓN MANUAL SI HAY SELECCIONADOS */}
      {bancoSeleccionado && sistemaSeleccionado && (
        <div style={{
          position: 'sticky',
          top: '20px',
          zIndex: 40,
          background: '#18191C',
          color: '#FFFFFF',
          borderRadius: '18px',
          padding: '14px 20px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 14px 32px -5px rgba(24, 25, 28, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link2 size={18} color="#A6BEFF" />
            <div>
              <span style={{ fontSize: '13px', fontWeight: '700' }}>
                Conciliar pareja seleccionada:
              </span>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                Banco: <strong>{bancoSeleccionado.descripcion} ({Number(bancoSeleccionado.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })})</strong> ↔
                Sistema: <strong>{sistemaSeleccionado.descripcion || sistemaSeleccionado.categoria} ({Number(sistemaSeleccionado.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })})</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setBancoSeleccionado(null)
                setSistemaSeleccionado(null)
              }}
              style={{ background: 'transparent', border: '1px solid #475569', color: '#CBD5E1', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={vincularParejaSeleccionada}
              style={{ background: '#3B66F5', border: 'none', color: '#FFFFFF', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              Confirmar vinculación
            </button>
          </div>
        </div>
      )}

      {/* TABLERO DUAL DE CONCILIACIÓN */}
      {!vistaInforme && extractoActual && (
        <>
          {/* BARRA DE FILTROS Y BÚSQUEDA */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Filtros de estado y categoría */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Segmented buttons de estado */}
              <div style={{ display: 'inline-flex', background: '#FFFFFF', padding: '4px', borderRadius: '999px', border: '1px solid #E5E7EB', gap: '3px' }}>
                {[
                  { id: 'todos', label: `Todos (${metricas.totalBanco})` },
                  { id: 'pendientes', label: `Pendientes (${metricas.pendientesBanco})` },
                  { id: 'conciliados', label: `Conciliados (${metricas.conciliadosCount})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFiltroVista(tab.id)}
                    style={{
                      background: filtroVista === tab.id ? '#18191C' : 'transparent',
                      color: filtroVista === tab.id ? '#FFFFFF' : '#64748B',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '5px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Filtros por tipo de movimiento */}
              <div style={{ display: 'inline-flex', background: '#FFFFFF', padding: '4px', borderRadius: '999px', border: '1px solid #E5E7EB', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('todos')}
                  style={{
                    background: filtroTipo === 'todos' ? '#3B66F5' : 'transparent',
                    color: filtroTipo === 'todos' ? '#FFFFFF' : '#475569',
                    border: 'none', borderRadius: '999px', padding: '5px 12px', fontSize: '11.5px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Todas las categorías
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('transferencia')}
                  style={{
                    background: filtroTipo === 'transferencia' ? '#0284C7' : 'transparent',
                    color: filtroTipo === 'transferencia' ? '#FFFFFF' : '#0369A1',
                    border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <ArrowRightLeft size={12} />
                  Transf. ({metricas.countTransferencias})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('gasto_bancario')}
                  style={{
                    background: filtroTipo === 'gasto_bancario' ? '#D97706' : 'transparent',
                    color: filtroTipo === 'gasto_bancario' ? '#FFFFFF' : '#B45309',
                    border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <CreditCard size={12} />
                  Gastos bancarios ({metricas.countGastosBancarios})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('impuesto')}
                  style={{
                    background: filtroTipo === 'impuesto' ? '#7C3AED' : 'transparent',
                    color: filtroTipo === 'impuesto' ? '#FFFFFF' : '#6D28D9',
                    border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Landmark size={12} />
                  Impuestos ({metricas.countImpuestos})
                </button>
              </div>

              {/* Botón de registro automático masivo de gastos e impuestos */}
              {metricas.countGastosImpuestosPendientes > 0 && (
                <button
                  type="button"
                  disabled={autoRegistrandoLote}
                  onClick={registrarGastosEImpuestosEnLote}
                  style={{
                    background: '#F5F3FF',
                    border: '1px solid #DDD6FE',
                    color: '#7C3AED',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: autoRegistrandoLote ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Registrar y conciliar automáticamente todas las comisiones bancarias e impuestos sin registrar"
                >
                  <Zap size={13} className={autoRegistrandoLote ? 'animate-spin' : ''} />
                  <span>Auto-registrar {metricas.countGastosImpuestosPendientes} gastos/impuestos</span>
                </button>
              )}
            </div>

            {/* Input búsqueda */}
            <div style={{ position: 'relative', width: '250px' }}>
              <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar por concepto o importe..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{
                  ...s.input,
                  paddingLeft: '32px',
                  paddingRight: '10px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  fontSize: '12px',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* DUAL PANELS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* PANEL IZQUIERDO: EXTRACTO BANCARIO */}
            <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{
                background: '#F8FAFC',
                padding: '12px 16px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={16} color="#0F766E" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                    1. Resumen Bancario ({filasBancoFiltradas.length})
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Identificación automática de partidas
                </span>
              </div>

              {filasBancoFiltradas.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No hay transacciones del extracto que coincidan con los filtros seleccionados.
                </div>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={{ ...s.tablaCabecera('#0F172A'), width: '30px' }}></th>
                        <th style={s.tablaCabecera('#0F172A')}>Fecha</th>
                        <th style={s.tablaCabecera('#0F172A')}>Concepto & Clasificación</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Importe</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Saldo</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasBancoFiltradas.map((f, i) => {
                        const estaConciliado = Boolean(conciliacionesMap[f.id])
                        const esSel = bancoSeleccionado?.id === f.id
                        const esCredito = f.monto > 0
                        const cl = clasificarMovimientoBancario(f.descripcion, f.monto)

                        return (
                          <tr
                            key={f.id}
                            style={{
                              ...s.tablaFila(i),
                              background: esSel ? '#E0F2FE' : (estaConciliado ? '#F0FDFA' : undefined),
                              cursor: estaConciliado ? 'default' : 'pointer'
                            }}
                            onClick={() => {
                              if (!estaConciliado) {
                                setBancoSeleccionado(esSel ? null : f)
                              }
                            }}
                          >
                            <td style={{ ...s.tablaCell, width: '30px', textAlign: 'center' }}>
                              {!estaConciliado && (
                                <input
                                  type="radio"
                                  checked={esSel}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                              )}
                            </td>
                            <td style={{ ...s.tablaCell, fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {f.fecha}
                            </td>
                            <td style={s.tablaCell}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  color: cl.color,
                                  background: cl.bg,
                                  border: `1px solid ${cl.border}`,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }} title={cl.detalle}>
                                  {cl.tipo === 'impuesto' && <Landmark size={10} />}
                                  {cl.tipo === 'gasto_bancario' && <CreditCard size={10} />}
                                  {cl.tipo === 'transferencia' && <ArrowRightLeft size={10} />}
                                  {cl.tipo === 'sueldo' && <Users size={10} />}
                                  <span>{cl.label}</span>
                                </span>
                              </div>
                              <div style={{ fontWeight: '600', color: '#0F172A', fontSize: '12px', lineHeight: 1.3 }}>
                                {f.descripcion}
                              </div>
                              {f.referencia && (
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  {f.referencia}
                                </span>
                              )}
                            </td>
                            <td style={{
                              ...s.tablaCellBold,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              fontFamily: paleta.fontMono,
                              color: esCredito ? '#059669' : '#DC2626'
                            }}>
                              {esCredito ? '+' : ''}{Number(f.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                            </td>
                            <td style={{
                              ...s.tablaCell,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              fontFamily: paleta.fontMono,
                              fontSize: '11.5px',
                              fontWeight: f.saldoInformado ? '700' : '500',
                              color: f.saldo === null || f.saldo === undefined ? '#94A3B8' : (Number(f.saldo) < 0 ? '#DC2626' : '#334155')
                            }} title={f.saldoInformado ? 'Saldo Disponible informado por el banco' : 'Saldo corrido calculado'}>
                              {f.saldo !== null && f.saldo !== undefined
                                ? Number(f.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
                                : '—'}
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {estaConciliado ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{
                                    background: '#D1FAE5',
                                    color: '#065F46',
                                    borderRadius: '4px',
                                    padding: '3px 7px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <Check size={11} /> Conciliado
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      desvincularFila(f.id)
                                    }}
                                    title="Desvincular movimiento"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}
                                  >
                                    <Unlink size={13} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {cl.tipo === 'impuesto' ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        abrirIncorporarFila(f, 'Impuestos')
                                      }}
                                      title="Registrar este impuesto en Finanzas y conciliar de inmediato"
                                      style={{
                                        background: '#F5F3FF',
                                        border: '1px solid #DDD6FE',
                                        borderRadius: '5px',
                                        padding: '4px 7px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        color: '#7C3AED',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Landmark size={11} /> Registrar impuesto
                                    </button>
                                  ) : cl.tipo === 'gasto_bancario' ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        abrirIncorporarFila(f, 'Gastos bancarios')
                                      }}
                                      title="Registrar este gasto/comisión en Finanzas y conciliar de inmediato"
                                      style={{
                                        background: '#FFFBEB',
                                        border: '1px solid #FDE68A',
                                        borderRadius: '5px',
                                        padding: '4px 7px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        color: '#D97706',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <CreditCard size={11} /> Registrar gasto
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        abrirIncorporarFila(f)
                                      }}
                                      title="Registrar como movimiento contable en Finanzas"
                                      style={{
                                        background: '#F8FAFC',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '5px',
                                        padding: '4px 7px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#2563EB',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Plus size={11} /> Asentar
                                    </button>
                                  )}

                                  {/* Botón Vincular a Factura */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      abrirVincularFactura(f)
                                    }}
                                    title={f.monto < 0 ? "Vincular este pago a Factura de Compra de proveedor" : "Vincular este cobro a Factura de Venta de cliente"}
                                    style={{
                                      background: '#F0FDFA',
                                      border: '1px solid #99F6E4',
                                      borderRadius: '5px',
                                      padding: '4px 7px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#0F766E',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    <FileText size={11} /> Factura
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* PANEL DERECHO: MOVIMIENTOS EN SISTEMA */}
            <div style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{
                background: '#F8FAFC',
                padding: '12px 16px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} color="#334155" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                    2. Movimientos Registrados en Sistema ({movimientosSistemaFiltrados.length})
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Libro banco interno
                </span>
              </div>

              {movimientosSistemaFiltrados.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  No hay movimientos registrados para esta cuenta en este período.
                </div>
              ) : (
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={{ ...s.tablaCabecera('#0F172A'), width: '30px' }}></th>
                        <th style={s.tablaCabecera('#0F172A')}>Fecha</th>
                        <th style={s.tablaCabecera('#0F172A')}>Descripción / Categoría</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Monto</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosSistemaFiltrados.map((m, i) => {
                        const estaConciliado = movConciliadosSet.has(m.id)
                        const esSel = sistemaSeleccionado?.id === m.id
                        const esIngreso = m.tipo === 'ingreso'

                        return (
                          <tr
                            key={m.id}
                            style={{
                              ...s.tablaFila(i),
                              background: esSel ? '#E0F2FE' : (estaConciliado ? '#F0FDFA' : undefined),
                              cursor: estaConciliado ? 'default' : 'pointer'
                            }}
                            onClick={() => {
                              if (!estaConciliado) {
                                setSistemaSeleccionado(esSel ? null : m)
                              }
                            }}
                          >
                            <td style={{ ...s.tablaCell, width: '30px', textAlign: 'center' }}>
                              {!estaConciliado && (
                                <input
                                  type="radio"
                                  checked={esSel}
                                  onChange={() => {}}
                                  style={{ cursor: 'pointer' }}
                                />
                              )}
                            </td>
                            <td style={{ ...s.tablaCell, fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {m.fecha}
                            </td>
                            <td style={s.tablaCell}>
                              <div style={{ fontWeight: '600', color: '#0F172A', fontSize: '12.5px' }}>
                                {m.descripcion || m.categoria || 'Movimiento'}
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                {m.categoria} · {m.forma_pago || 'Transferencia'}
                              </span>
                            </td>
                            <td style={{
                              ...s.tablaCellBold,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              color: esIngreso ? '#059669' : '#DC2626'
                            }}>
                              {esIngreso ? '+' : '-'}{Number(m.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                            </td>
                            <td style={{ ...s.tablaCell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {estaConciliado ? (
                                <span style={{
                                  background: '#D1FAE5',
                                  color: '#065F46',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: '700'
                                }}>
                                  ✓ Conciliado
                                </span>
                              ) : (
                                <span style={{
                                  background: '#FEF3C7',
                                  color: '#92400E',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}>
                                  En tránsito
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* MODAL PARA CARGAR RESUMEN BANCARIO */}
      {modalCarga && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                  Cargar Resumen Bancario
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  Cuenta: <strong>{cuentaActiva?.banco} ({cuentaActiva?.tipo})</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalCarga(false)
                  setFilasPrevia([])
                  setTextoPegado('')
                  setErrorCarga('')
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Nombre del extracto */}
            <div style={{ marginBottom: '16px' }}>
              <label style={s.label}>Nombre o Etiqueta del Resumen</label>
              <input
                type="text"
                style={s.input}
                placeholder={`Ej. Extracto ${cuentaActiva?.banco} - ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}
                value={nombreExtracto}
                onChange={e => setNombreExtracto(e.target.value)}
              />
            </div>

            {/* Selector de modo */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setModoCarga('archivo')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${modoCarga === 'archivo' ? '#0F766E' : '#CBD5E1'}`,
                  background: modoCarga === 'archivo' ? '#F0FDFA' : '#FFFFFF',
                  color: modoCarga === 'archivo' ? '#0F766E' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Subir Archivo (Excel .xlsx / .xls / CSV)
              </button>
              <button
                type="button"
                onClick={() => setModoCarga('pegar')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${modoCarga === 'pegar' ? '#0F766E' : '#CBD5E1'}`,
                  background: modoCarga === 'pegar' ? '#F0FDFA' : '#FFFFFF',
                  color: modoCarga === 'pegar' ? '#0F766E' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Copiar y Pegar desde Homebanking
              </button>
            </div>

            {/* MODO ARCHIVO */}
            {modoCarga === 'archivo' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  border: '2px dashed #CBD5E1',
                  borderRadius: '10px',
                  padding: '28px 16px',
                  cursor: 'pointer',
                  background: '#F8FAFC'
                }}>
                  <Upload size={28} color="#0F766E" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                    {cargandoArchivo ? 'Leyendo archivo Excel / extracto...' : 'Seleccioná el archivo Excel (.xlsx, .xls) o CSV del banco'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'center' }}>
                    Compatible con exportación directa de BBVA, Macro, Santander, Galicia, Nación (Crédito, Débito, Detalle y Saldo Disponible)
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.tsv"
                    style={{ display: 'none' }}
                    onChange={manejarSubidaArchivo}
                  />
                </label>
              </div>
            )}

            {/* MODO PEGAR */}
            {modoCarga === 'pegar' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={s.label}>Pegá las líneas copiadas directamente de la tabla de tu Homebanking:</label>
                <textarea
                  rows={6}
                  style={{ ...s.input, fontFamily: paleta.fontMono, fontSize: '11.5px', resize: 'vertical' }}
                  placeholder="28/09/2026   TRANSF INMEDIATA RECIBIDA   $ 450.000,00   $ 1.250.000,00&#10;29/09/2026   DEBITO AFIP IVA            -$ 85.000,00   $ 1.165.000,00"
                  value={textoPegado}
                  onChange={e => setTextoPegado(e.target.value)}
                />
                <button
                  type="button"
                  onClick={manejarProcesarTextoPegado}
                  style={{
                    ...s.btnSecundario,
                    marginTop: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  Procesar texto pegado
                </button>
              </div>
            )}

            {/* ERROR */}
            {errorCarga && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{errorCarga}</span>
              </div>
            )}

            {/* METADATOS DETECTADOS DEL BANCO */}
            {cuentaNoCoincide(metaPrevia, cuentaActiva) && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: '#FFE4E6', color: '#9F1239', fontSize: 12, fontWeight: 600 }}>
                Atención: el archivo es de la cuenta {metaPrevia.cuenta} y tenés seleccionada {cuentaActiva?.banco}. Cambiá de cuenta antes de guardar.
              </div>
            )}
            {filasPrevia.some(f => f.signoCorregido) && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: '#FEF3C7', color: '#92400E', fontSize: 12 }}>
                {filasPrevia.filter(f => f.signoCorregido).length} movimiento(s) de impuestos/comisiones venían con signo positivo en el archivo y se tomaron como débitos (egresos).
              </div>
            )}
            {metaPrevia && (metaPrevia.empresa || metaPrevia.cuenta || metaPrevia.saldoHeader !== null) && (
              <div style={{
                background: '#F0FDFA',
                border: '1px solid #99F6E4',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '8px',
                fontSize: '11.5px'
              }}>
                {metaPrevia.empresa && (
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Empresa</span>
                    <strong style={{ color: '#0F172A' }}>{metaPrevia.empresa}</strong>
                  </div>
                )}
                {metaPrevia.cuenta && (
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Cuenta Banco</span>
                    <strong style={{ color: '#0F172A' }}>{metaPrevia.cuenta}</strong>
                  </div>
                )}
                {metaPrevia.saldoHeader !== null && (
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Saldo Cabecera</span>
                    <strong style={{ color: '#0F766E', fontFamily: paleta.fontMono }}>
                      {Number(metaPrevia.saldoHeader).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </strong>
                  </div>
                )}
                {metaPrevia.saldoUltimoMovimiento !== null && (
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Saldo Últ. Mov.</span>
                    <strong style={{ color: '#0F172A', fontFamily: paleta.fontMono }}>
                      {Number(metaPrevia.saldoUltimoMovimiento).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* VISTA PREVIA DE FILAS EXTRAÍDAS */}
            {filasPrevia.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}>
                    Vista previa: {filasPrevia.length} transacciones detectadas
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: '700' }}>
                    Saldo final detectado: {(metaPrevia?.saldoFinal ?? filasPrevia[0]?.saldo) != null
                      ? Number(metaPrevia?.saldoFinal ?? filasPrevia[0]?.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
                      : '—'}
                  </span>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <table style={s.tabla}>
                    <thead>
                      <tr>
                        <th style={s.tablaCabecera('#0F172A')}>Fecha</th>
                        <th style={s.tablaCabecera('#0F172A')}>Concepto / Detalle</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Monto</th>
                        <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasPrevia.slice(0, 15).map((f, i) => (
                        <tr key={i} style={s.tablaFila(i)}>
                          <td style={{ ...s.tablaCell, fontSize: '11.5px', whiteSpace: 'nowrap' }}>{f.fecha}</td>
                          <td style={{ ...s.tablaCell, fontSize: '11.5px' }}>
                            <div style={{ fontWeight: '600', color: '#0F172A' }}>{f.descripcion}</div>
                            {f.referencia && <div style={{ fontSize: '10.5px', color: '#64748B' }}>{f.referencia}</div>}
                          </td>
                          <td style={{ ...s.tablaCellBold, fontSize: '11.5px', textAlign: 'right', fontFamily: paleta.fontMono, whiteSpace: 'nowrap', color: f.monto >= 0 ? '#059669' : '#DC2626' }}>
                            {f.monto > 0 ? '+' : ''}{Number(f.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                          </td>
                          <td style={{ ...s.tablaCell, fontSize: '11.5px', textAlign: 'right', fontFamily: paleta.fontMono, whiteSpace: 'nowrap', fontWeight: f.saldoInformado ? '700' : '500', color: (f.saldo ?? 0) < 0 ? '#DC2626' : '#334155' }}>
                            {f.saldo !== null && f.saldo !== undefined
                              ? Number(f.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filasPrevia.length > 15 && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                    ... y {filasPrevia.length - 15} filas adicionales
                  </p>
                )}
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                style={s.btnSecundario}
                onClick={() => {
                  setModalCarga(false)
                  setFilasPrevia([])
                  setMetaPrevia(null)
                  setTextoPegado('')
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={filasPrevia.length === 0}
                style={{
                  ...s.btnPrimario(c.main),
                  opacity: filasPrevia.length === 0 ? 0.5 : 1,
                  cursor: filasPrevia.length === 0 ? 'not-allowed' : 'pointer'
                }}
                onClick={confirmarGuardarExtracto}
              >
                Confirmar y guardar resumen ({filasPrevia.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA INCORPORAR FILA DEL EXTRACTO A MOVIMIENTOS */}
      {incorporandoFila && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                  Incorporar a Finanzas
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Registrar partida del banco como movimiento contable
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncorporandoFila(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardarMovimientoIncorporado}>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '12.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Fecha del banco:</span>
                  <strong>{incorporandoFila.fecha}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Concepto banco:</span>
                  <strong style={{ maxWidth: '240px', textAlign: 'right' }}>{incorporandoFila.descripcion}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Monto:</span>
                  <strong style={{ color: incorporandoFila.monto >= 0 ? '#059669' : '#DC2626', fontSize: '14px', fontFamily: paleta.fontMono }}>
                    {incorporandoFila.monto >= 0 ? '+' : ''}{Number(incorporandoFila.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </strong>
                </div>
              </div>

              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Tipo de movimiento</label>
                  <input
                    type="text"
                    readOnly
                    style={{ ...s.input, background: '#F1F5F9', fontWeight: '700', color: incorporandoFila.monto >= 0 ? '#059669' : '#DC2626' }}
                    value={incorporandoFila.monto >= 0 ? 'Ingreso' : 'Egreso'}
                  />
                </div>
                <div>
                  <label style={s.label}>Categoría contable</label>
                  <select
                    style={s.input}
                    value={formInc.categoria}
                    onChange={e => setFormInc({ ...formInc, categoria: e.target.value })}
                    required
                  >
                    {incorporandoFila.monto >= 0 ? (
                      <>
                        <option value="Cobranzas">Cobranzas</option>
                        <option value="Rendimientos e intereses">Rendimientos e intereses</option>
                        <option value="Ajuste de saldo">Ajuste de saldo</option>
                        <option value="Otro ingreso">Otro ingreso</option>
                      </>
                    ) : (
                      <>
                        <option value="Gastos bancarios">Gastos bancarios (comisión / impuestos)</option>
                        <option value="Impuestos">Impuestos (AFIP / IIBB / Déb-Créd)</option>
                        <option value="Servicios">Servicios</option>
                        <option value="Insumos">Insumos</option>
                        <option value="Haberes">Haberes / Sueldos</option>
                        <option value="Alquileres">Alquileres</option>
                        <option value="Ajuste de saldo">Ajuste de saldo</option>
                        <option value="Otro egreso">Otro egreso</option>
                      </>
                    )}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.label}>Descripción</label>
                  <input
                    type="text"
                    style={s.input}
                    value={formInc.descripcion}
                    onChange={e => setFormInc({ ...formInc, descripcion: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={s.label}>Medio de pago</label>
                  <select
                    style={s.input}
                    value={formInc.forma_pago}
                    onChange={e => setFormInc({ ...formInc, forma_pago: e.target.value })}
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Débito automático">Débito automático</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Efectivo">Efectivo</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Nº Comprobante / Ref</label>
                  <input
                    type="text"
                    style={s.input}
                    value={formInc.comprobante}
                    onChange={e => setFormInc({ ...formInc, comprobante: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...s.btnSecundario, marginRight: 'auto', color: '#0F766E' }}
                  title={Number(incorporandoFila.monto) < 0 ? 'Registrar este pago contra una factura de compra' : 'Registrar este cobro contra una factura de venta'}
                  onClick={() => { const fila = incorporandoFila; setIncorporandoFila(null); abrirVincularFactura(fila) }}
                >
                  <FileText size={13} /> {Number(incorporandoFila.monto) < 0 ? 'Imputar a factura de compra' : 'Imputar a factura de venta'}
                </button>
                <button
                  type="button"
                  style={s.btnSecundario}
                  onClick={() => setIncorporandoFila(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoInc}
                  style={s.btnPrimario(c.main)}
                >
                  {guardandoInc ? 'Registrando...' : 'Registrar y conciliar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VINCULAR MOVIMIENTO BANCARIO DIRECTAMENTE A FACTURA */}
      {vincularFacturaModal && (() => {
        const { fila, esCompra, factura } = vincularFacturaModal
        const montoAbs = Math.abs(Number(fila.monto))

        // Facturas elegibles pendientes
        let listaFacturas = []
        if (esCompra) {
          listaFacturas = (facturasCompra || [])
            .filter(f => f.estado !== 'pagada' && f.estado !== 'anulada')
            .map(f => {
              const saldo = saldoFacturaCompra(f)
              const esCoincidenciaExacta = Math.abs(saldo - montoAbs) < 0.05
              return { ...f, saldo, esCoincidenciaExacta }
            })
            .filter(f => f.saldo > 0)
        } else {
          listaFacturas = (facturasVenta || [])
            .filter(f => !['pagada', 'cobrada', 'anulada'].includes(f.estado))
            .map(f => {
              const saldo = saldoFacturaVenta(f)
              const esCoincidenciaExacta = Math.abs(saldo - montoAbs) < 0.05
              return { ...f, saldo, esCoincidenciaExacta }
            })
            .filter(f => f.saldo > 0)
        }

        // Filtro por texto
        const q = busquedaFactura.trim().toLowerCase()
        const filtradas = listaFacturas.filter(f => {
          if (!q) return true
          const nombre = esCompra
            ? (f.proveedores?.razon_social || proveedores.find(p => p.id === f.proveedor_id)?.razon_social || '')
            : (f.clientes?.razon_social || f.clientes?.nombre_contacto || clientes.find(c => c.id === f.cliente_id)?.razon_social || clientes.find(c => c.id === f.cliente_id)?.nombre_contacto || '')
          const num = f.numero_factura || ''
          return nombre.toLowerCase().includes(q) || num.toLowerCase().includes(q)
        }).sort((a, b) => {
          if (a.esCoincidenciaExacta && !b.esCoincidenciaExacta) return -1
          if (!a.esCoincidenciaExacta && b.esCoincidenciaExacta) return 1
          return new Date(b.fecha_emision || 0) - new Date(a.fecha_emision || 0)
        })

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 75, padding: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: esCompra ? '#C2410C' : '#047857',
                      background: esCompra ? '#FFF7ED' : '#ECFDF5',
                      border: `1px solid ${esCompra ? '#FFEDD5' : '#D1FAE5'}`,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {esCompra ? 'PAGO A PROVEEDOR' : 'COBRANZA DE CLIENTE'}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                    {esCompra ? 'Vincular a Factura de Compra' : 'Vincular a Factura de Venta'}
                  </h4>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Partida bancaria: <strong>{fila.descripcion}</strong> · Fecha: <strong>{fila.fecha}</strong> · Monto: <strong style={{ color: esCompra ? '#DC2626' : '#059669' }}>{esCompra ? '-' : '+'}{montoAbs.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVincularFacturaModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Buscador de factura */}
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder={esCompra ? "Buscar por proveedor o Nº factura..." : "Buscar por cliente o Nº factura..."}
                  value={busquedaFactura}
                  onChange={e => setBusquedaFactura(e.target.value)}
                  style={{ ...s.input, paddingLeft: '32px', fontSize: '13px' }}
                />
              </div>

              {/* Lista de facturas pendientes */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
                {filtradas.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                    {esCompra
                      ? 'No hay facturas de compra pendientes que coincidan con la búsqueda.'
                      : 'No hay facturas de venta pendientes que coincidan con la búsqueda.'}
                  </div>
                ) : (
                  filtradas.map(f => {
                    const sel = factura?.id === f.id
                    const nombreEntidad = esCompra
                      ? (f.proveedores?.razon_social || 'Proveedor s/n')
                      : (f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Cliente s/n')

                    return (
                      <div
                        key={f.id}
                        onClick={() => setVincularFacturaModal({ ...vincularFacturaModal, factura: f })}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #F1F5F9',
                          background: sel ? '#F0FDFA' : (f.esCoincidenciaExacta ? '#FEFCE8' : '#FFFFFF'),
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="radio"
                            checked={sel}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{nombreEntidad}</strong>
                              <span style={{ fontSize: '11.5px', color: '#64748B' }}>#{f.numero_factura || 's/n'}</span>
                              {f.esCoincidenciaExacta && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  color: '#B45309',
                                  background: '#FEF3C7',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #FDE68A',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  <Sparkles size={11} /> Coincidencia exacta de monto
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>
                              Emisión: {f.fecha_emision || '—'} · Total factura: {Number(f.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Saldo pendiente</span>
                          <strong style={{ fontSize: '13.5px', color: '#0F172A', fontFamily: paleta.fontMono }}>
                            {f.saldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                          </strong>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Detalle de imputación si hay seleccionada */}
              {factura && (() => {
                const saldoActual = esCompra ? saldoFacturaCompra(factura) : saldoFacturaVenta(factura)
                const nuevoSaldo = Math.max(0, saldoActual - montoAbs)
                const canceladaTotal = nuevoSaldo < 0.01

                return (
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px',
                    marginBottom: '16px',
                    fontSize: '12.5px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748B' }}>Factura a imputar:</span>
                      <strong>#{factura.numero_factura || 's/n'} — {esCompra ? factura.proveedores?.razon_social : (factura.clientes?.razon_social || factura.clientes?.nombre_contacto)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#64748B' }}>Monto que cancela este movimiento:</span>
                      <strong style={{ color: '#0F766E' }}>{montoAbs.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #CBD5E1', paddingTop: '6px', marginTop: '6px' }}>
                      <span style={{ color: '#64748B' }}>Estado posterior de la factura:</span>
                      <strong style={{ color: canceladaTotal ? '#059669' : '#D97706' }}>
                        {canceladaTotal ? 'Quedará TOTALMENTE PAGADA (Saldo: $0,00)' : `Quedará con saldo pendiente de ${nuevoSaldo.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`}
                      </strong>
                    </div>
                  </div>
                )
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={s.btnSecundario}
                  onClick={() => setVincularFacturaModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!factura || guardandoVinculacionFactura}
                  onClick={confirmarVinculacionFactura}
                  style={{
                    ...s.btnPrimario(c.main),
                    opacity: !factura || guardandoVinculacionFactura ? 0.6 : 1,
                    cursor: !factura || guardandoVinculacionFactura ? 'not-allowed' : 'pointer'
                  }}
                >
                  {guardandoVinculacionFactura ? 'Registrando y vinculando...' : 'Confirmar vinculación y cancelar factura'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL GUÍA EXPLICATIVA: CÓMO CONCILIAR, REGISTRAR GASTOS Y VINCULAR FACTURAS */}
      {modalGuia && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HelpCircle size={20} color="#0F766E" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                    Guía de Conciliación Bancaria y Vinculación
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                    Respuestas directas a las operaciones contables del módulo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalGuia(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '13px', lineHeight: 1.6 }}>
              {/* Sección 1: Identificación */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Sparkles size={16} color="#0284C7" />
                  <strong style={{ fontSize: '14px', color: '#0F172A' }}>
                    1. Identificación automática de movimientos bancarios
                  </strong>
                </div>
                <p style={{ margin: '0 0 10px', color: '#475569' }}>
                  El sistema escanea la descripción de cada partida del resumen de tu Homebanking y le asigna una etiqueta visual:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ color: '#0369A1', fontWeight: '700', fontSize: '12px' }}>⇄ Transferencias</div>
                    <span style={{ fontSize: '11px', color: '#0284C7' }}>Inmediatas, CBU/CVU, Debin, pagos y cobros</span>
                  </div>
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ color: '#B45309', fontWeight: '700', fontSize: '12px' }}>💳 Gastos bancarios</div>
                    <span style={{ fontSize: '11px', color: '#D97706' }}>Comisiones, mantenimiento de cuenta y chequeras</span>
                  </div>
                  <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '8px 10px', borderRadius: '8px' }}>
                    <div style={{ color: '#6D28D9', fontWeight: '700', fontSize: '12px' }}>🏛️ Impuestos</div>
                    <span style={{ fontSize: '11px', color: '#7C3AED' }}>AFIP / ARCA, Déb/Créd Ley 25413, retenciones IIBB y SIRCREB</span>
                  </div>
                </div>
              </div>

              {/* Sección 2: Registro de Gastos e Impuestos */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Zap size={16} color="#7C3AED" />
                  <strong style={{ fontSize: '14px', color: '#0F172A' }}>
                    2. ¿Cómo registrar los gastos bancarios e impuestos?
                  </strong>
                </div>
                <p style={{ margin: '0 0 8px', color: '#475569' }}>
                  Cuando el extracto del banco tiene comisiones o débitos de impuestos que no habías cargado en Finanzas:
                </p>
                <ul style={{ margin: '0 0 10px', paddingLeft: '20px', color: '#475569' }}>
                  <li><strong>Registro individual (1 clic)</strong>: Hacé clic en <strong>"Registrar gasto"</strong> o <strong>"Registrar impuesto"</strong> en la fila correspondiente. Se abrirá la ventana con la categoría preseleccionada; confirmás y el sistema crea el egreso en Finanzas y lo deja conciliado al instante.</li>
                  <li><strong>Registro masivo en lote</strong>: Pulsá el botón morado <strong>"⚡ Auto-registrar gastos e impuestos"</strong> en la barra superior. Creará automáticamente todos los asientos contables pendientes de impuestos y comisiones y los conciliará sin tener que hacer uno por uno.</li>
                </ul>
              </div>

              {/* Sección 3: Vinculación con Facturas */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText size={16} color="#0F766E" />
                  <strong style={{ fontSize: '14px', color: '#0F172A' }}>
                    3. ¿Cómo vincular las facturas con los pagos y cobros?
                  </strong>
                </div>
                <p style={{ margin: '0 0 8px', color: '#475569' }}>
                  Tenés dos formas según si el pago ya fue asentado previamente o no:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <strong style={{ color: '#0F172A' }}>Opción A: El pago/cobro ya fue registrado en Finanzas previamente</strong>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '12px' }}>
                      Marcá la opción circular de la fila del extracto bancario (panel izquierdo) y la del movimiento contable (panel derecho). En la barra superior flotante aparecerá el botón <strong>"Confirmar vinculación"</strong>. También podés usar el botón <strong>"Auto-conciliar"</strong> para que el sistema busque coincidencias automáticas por importe y fecha.
                    </p>
                  </div>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <strong style={{ color: '#0F172A' }}>Opción B: El dinero salió/entró del banco pero la factura sigue pendiente en Finanzas</strong>
                    <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '12px' }}>
                      En la fila del extracto bancario hacé clic en <strong>"Factura"</strong>. Podrás seleccionar la factura de compra de proveedor o de venta de cliente. El sistema destaca las que coinciden con el importe exacto. Al confirmar, <strong>se registra el pago oficial, se descuenta o cancela el saldo de la factura</strong> y queda conciliada con el banco simultáneamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                style={s.btnPrimario(c.main)}
                onClick={() => setModalGuia(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConciliacionBancaria
