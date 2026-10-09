import { useEffect, useState, useMemo } from 'react'
import { supabase, emitirCambioDatos } from '../supabase.js'
import { s, colores } from '../estilos.js'
import { Pencil, Plus, Receipt, X, FileUp, Trash2, AlertTriangle, Loader2, Calculator, Info, Search } from 'lucide-react'
import ImportarARCA from './ImportarARCA.jsx'
import { calcularDesgloseFactura } from '../finanzasUtils.js'

const c = colores.facturacion

function formatearFecha(f) {
  if (!f) return '—'
  const str = String(f).split('T')[0]
  const partes = str.split('-')
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }
  return str
}

function Facturacion()  {
  const [facturas, setFacturas] = useState([])
  const [vista, setVista] = useState('facturas')
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarPagos, setMostrarPagos] = useState(null)
  const [mostrarGenerador, setMostrarGenerador] = useState(false)
  const [modalConfirmarBorrado, setModalConfirmarBorrado] = useState(false)
  const [borrandoTodas, setBorrandoTodas] = useState(false)
  const [editando, setEditando] = useState(null)
  const [pagos, setPagos] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [formPago, setFormPago] = useState({ monto: '', medio_pago: 'transferencia', referencia: '', cuenta_id: '' })
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [form, setForm] = useState({
    contrato_id: '',
    periodo_desde: '',
    periodo_hasta: '',
    fecha_vencimiento: '',
    total: '',
    subtotal: '',
    impuestos: '0',
    alicuota_iva: '21',
    observaciones: '',
    estado: 'emitida'
  })

  const [contratosHora, setContratosHora] = useState([])
  const [mesGenerador, setMesGenerador] = useState(new Date().toISOString().slice(0, 7))
  const [resumenHoras, setResumenHoras] = useState([])
  const [loadingResumen, setLoadingResumen] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const [{ data: facts }, { data: conts }, { data: cuentasData }] = await Promise.all([
      supabase.from('facturas').select(`*, clientes(razon_social,nombre_contacto), contratos(numero_contrato, tipo_facturacion, valor_hora)`).order('creado_en', { ascending: false }),
      supabase.from('contratos').select(`id, numero_contrato, precio_acordado, tipo_facturacion, valor_hora, clientes(id,razon_social,nombre_contacto)`).eq('estado', 'activo'),
      supabase.from('cuentas_bancarias').select('*').eq('activa', true)
    ])
    if (facts) setFacturas(facts)
    if (cuentasData) setCuentas(cuentasData)
    if (conts) {
      setContratos(conts)
      setContratosHora(conts.filter(ct => ct.tipo_facturacion === 'por_hora'))
    }
    setLoading(false)
  }

  // Sincronización bidireccional respetando la regla: Total incluye IVA -> Neto = Total / (1 + Alícuota)
  function manejarCambioTotal(nuevoTotal, alic = form.alicuota_iva) {
    const tot = parseFloat(nuevoTotal) || 0
    const d = calcularDesgloseFactura(tot, parseFloat(alic) || 21)
    setForm(prev => ({
      ...prev,
      total: nuevoTotal,
      subtotal: d.neto > 0 ? d.neto.toString() : '',
      impuestos: d.iva > 0 ? d.iva.toString() : '0',
      alicuota_iva: alic
    }))
  }

  function manejarCambioNeto(nuevoNeto, alic = form.alicuota_iva) {
    const net = parseFloat(nuevoNeto) || 0
    const factor = 1 + ((parseFloat(alic) || 21) / 100)
    const tot = Math.round(net * factor * 100) / 100
    const iva = Math.round((tot - net) * 100) / 100
    setForm(prev => ({
      ...prev,
      subtotal: nuevoNeto,
      impuestos: iva > 0 ? iva.toString() : '0',
      total: tot > 0 ? tot.toString() : '',
      alicuota_iva: alic
    }))
  }

  function manejarCambioAlicuota(nuevaAlic) {
    const tot = parseFloat(form.total) || 0
    const d = calcularDesgloseFactura(tot, parseFloat(nuevaAlic) || 0)
    setForm(prev => ({
      ...prev,
      alicuota_iva: nuevaAlic,
      subtotal: d.neto > 0 ? d.neto.toString() : '',
      impuestos: d.iva > 0 ? d.iva.toString() : '0'
    }))
  }

  function abrirEdicion(f) {
    setEditando(f)
    const d = calcularDesgloseFactura(f)
    setForm({
      contrato_id: f.contrato_id || '',
      periodo_desde: f.periodo_desde || '',
      periodo_hasta: f.periodo_hasta || '',
      fecha_vencimiento: f.fecha_vencimiento || '',
      total: d.total > 0 ? d.total.toString() : (f.total?.toString() || ''),
      subtotal: d.neto > 0 ? d.neto.toString() : (f.subtotal?.toString() || ''),
      impuestos: d.iva > 0 ? d.iva.toString() : (f.impuestos?.toString() || '0'),
      alicuota_iva: d.alicuota?.toString() || '21',
      observaciones: f.observaciones || '',
      estado: f.estado || 'emitida'
    })
    setMostrarForm(true)
    setMostrarGenerador(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setMostrarForm(false)
    setEditando(null)
    setForm({
      contrato_id: '',
      periodo_desde: '',
      periodo_hasta: '',
      fecha_vencimiento: '',
      total: '',
      subtotal: '',
      impuestos: '0',
      alicuota_iva: '21',
      observaciones: '',
      estado: 'emitida'
    })
  }

  async function calcularResumenHoras() {
    setLoadingResumen(true)
    const desde = mesGenerador + '-01'
    const hasta = mesGenerador+'-'+new Date(+mesGenerador.split('-')[0], +mesGenerador.split('-')[1], 0).getDate()
    const resultados = []
    for (const ct of contratosHora) {
      const { data: ordenes } = await supabase.from('ordenes_trabajo').select('id, numero_orden, fecha_programada').eq('contrato_id', ct.id).eq('estado', 'completada').gte('fecha_programada', desde).lte('fecha_programada', hasta)
      if (!ordenes || ordenes.length === 0) continue
      let totalHoras = 0
      const detalleOrdenes = []
      for (const orden of ordenes) {
        const { data: empOrdenes } = await supabase.from('orden_empleados').select('horas_trabajadas').eq('orden_id', orden.id)
        const horasOrden = (empOrdenes || []).reduce((a, eo) => a + Number(eo.horas_trabajadas || 0), 0)
        totalHoras += horasOrden
        detalleOrdenes.push({ ...orden, horas: horasOrden })
      }
      if (totalHoras > 0) {
        const valorHora = Number(ct.valor_hora)
        // El valor acordado ya incluye IVA
        const total = totalHoras * valorHora
        const desglose = calcularDesgloseFactura(total, 21)
        resultados.push({
          contrato: ct,
          ordenes: detalleOrdenes,
          totalHoras,
          valorHora,
          subtotal: desglose.neto,
          impuestos: desglose.iva,
          total,
          ivaPorc: 21,
          cliente: ct.clientes
        })
      }
    }
    setResumenHoras(resultados)
    setLoadingResumen(false)
  }

  async function generarFacturaDesdeHoras(resumen) {
    const desde = mesGenerador + '-01'
    const hasta = mesGenerador+'-'+new Date(+mesGenerador.split('-')[0], +mesGenerador.split('-')[1], 0).getDate()
    const detalle = resumen.ordenes.map(o => `${o.numero_orden} (${new Date(o.fecha_programada + 'T00:00:00').toLocaleDateString('es-AR')}): ${o.horas}hs`).join(' | ')
    const desglose = calcularDesgloseFactura(resumen.total, parseFloat(resumen.ivaPorc) || 21)
    const { error } = await supabase.from('facturas').insert([{
      numero_factura: 'FAC-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100),
      contrato_id: resumen.contrato.id,
      cliente_id: resumen.cliente.id,
      fecha_emision: new Date().toISOString().split('T')[0],
      periodo_desde: desde, periodo_hasta: hasta,
      fecha_vencimiento: null,
      subtotal: desglose.neto,
      impuestos: desglose.iva,
      total: desglose.total,
      observaciones: `Facturación por horas — ${resumen.totalHoras}hs × $${resumen.valorHora}/h (Total incluye IVA) | ${detalle}`
    }])
    if (error) { alert('Error: ' + error.message); return }
    alert(`Factura generada para ${resumen.cliente.razon_social || resumen.cliente.nombre_contacto}`)
    cargarDatos()
  }

  function actualizarIvaResumen(i, valor) {
    setResumenHoras(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const numAlic = parseFloat(valor) || 0
      const total = r.totalHoras * r.valorHora
      const d = calcularDesgloseFactura(total, numAlic)
      return {
        ...r,
        ivaPorc: valor,
        subtotal: d.neto,
        impuestos: d.iva,
        total
      }
    }))
  }

  async function guardarFactura(e) {
    e.preventDefault()
    const total = parseFloat(form.total) || ((parseFloat(form.subtotal) || 0) + (parseFloat(form.impuestos) || 0))
    const d = calcularDesgloseFactura(total, parseFloat(form.alicuota_iva) || 21)
    const subtotal = d.neto
    const impuestos = d.iva

    if (editando) {
      const { error } = await supabase.from('facturas').update({
        contrato_id: form.contrato_id || null,
        periodo_desde: form.periodo_desde || null,
        periodo_hasta: form.periodo_hasta || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        subtotal,
        impuestos,
        total,
        observaciones: form.observaciones || null,
        estado: form.estado || 'emitida'
      }).eq('id', editando.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const contrato = contratos.find(ct => ct.id === form.contrato_id)
      const { error } = await supabase.from('facturas').insert([{
        numero_factura: 'FAC-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100),
        fecha_emision: new Date().toISOString().split('T')[0],
        cliente_id: contrato?.clientes?.id,
        contrato_id: form.contrato_id || null,
        periodo_desde: form.periodo_desde || null,
        periodo_hasta: form.periodo_hasta || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        subtotal,
        impuestos,
        total,
        observaciones: form.observaciones || null,
        estado: form.estado || 'emitida'
      }])
      if (error) { alert('Error: ' + error.message); return }
    }
    cancelar()
    await cargarDatos()
    emitirCambioDatos('facturacion')
  }

  async function anularFactura(id) {
    if (!confirm('¿Anular esta factura?')) return
    await supabase.from('facturas').update({ estado: 'anulada' }).eq('id', id)
    await cargarDatos()
    emitirCambioDatos('facturacion')
  }

  async function eliminarFacturaIndividual(id, numero) {
    if (!confirm(`¿Eliminar definitivamente la factura ${numero || id}? Esta acción también eliminará sus cobranzas asociadas para que los Reportes y Finanzas se mantengan limpios.`)) return
    try {
      await supabase.from('pagos').delete().eq('factura_id', id)
      await supabase.from('movimientos_financieros').delete().eq('factura_id', id)
      if (numero) {
        await supabase.from('movimientos_financieros').delete().eq('tipo', 'ingreso').ilike('descripcion', `%${numero}%`)
      }
      const { error } = await supabase.from('facturas').delete().eq('id', id)
      if (error) throw error
      await cargarDatos()
      emitirCambioDatos('facturacion')
    } catch (err) {
      alert('Error al eliminar la factura: ' + (err.message || 'Error desconocido'))
    }
  }

  async function borrarTodasLasFacturas() {
    setBorrandoTodas(true)
    try {
      const { data: facts, error: errFetch } = await supabase.from('facturas').select('id')
      if (errFetch) throw errFetch

      if (!facts || facts.length === 0) {
        // Verificar si quedaron cobranzas huérfanas en movimientos_financieros
        const { data: cobranzasHuerfanas } = await supabase.from('movimientos_financieros')
          .select('id')
          .eq('tipo', 'ingreso')
          .eq('categoria', 'Cobranzas')

        if (cobranzasHuerfanas && cobranzasHuerfanas.length > 0) {
          if (confirm(`No quedan facturas de venta, pero existen ${cobranzasHuerfanas.length} cobranza(s) registrada(s) que aún figuran en Reportes. ¿Deseas eliminarlas ahora para dejar los reportes en cero?`)) {
            await supabase.from('movimientos_financieros').delete().in('id', cobranzasHuerfanas.map(c => c.id))
            alert(`Se eliminaron las ${cobranzasHuerfanas.length} cobranzas huérfanas. El módulo de Reportes y Finanzas quedó 100% limpio.`)
            await cargarDatos()
            emitirCambioDatos('facturacion')
          }
        } else {
          alert('No hay facturas ni cobranzas pendientes de eliminar.')
        }
        setBorrandoTodas(false)
        setModalConfirmarBorrado(false)
        return
      }

      const ids = facts.map(f => f.id)
      try {
        await supabase.from('pagos').delete().in('factura_id', ids)
      } catch (e) {
        console.warn('Pagos cleanup notice:', e)
      }

      try {
        // Eliminar movimientos financieros vinculados a las facturas
        await supabase.from('movimientos_financieros').delete().in('factura_id', ids)
        // Eliminar todas las cobranzas de ventas para que no queden reflejadas en reportes
        await supabase.from('movimientos_financieros').delete().eq('tipo', 'ingreso').eq('categoria', 'Cobranzas')
      } catch (e) {
        console.warn('Movimientos cleanup notice:', e)
      }

      const { error: errDel } = await supabase.from('facturas').delete().in('id', ids)
      if (errDel) throw errDel

      setModalConfirmarBorrado(false)
      await cargarDatos()
      emitirCambioDatos('facturacion')
      alert(`Se eliminaron correctamente las ${ids.length} facturas de venta y todas sus cobranzas asociadas. Los Reportes y Facturación quedaron 100% limpios para importar desde ARCA.`)
      setVista('importar-arca')
    } catch (err) {
      alert('Error al borrar las facturas: ' + (err.message || 'Error desconocido'))
    } finally {
      setBorrandoTodas(false)
    }
  }

  async function verPagos(factura) {
    setMostrarPagos(factura)
    const { data } = await supabase.from('pagos').select('*').eq('factura_id', factura.id).order('fecha_pago', { ascending: false })
    if (data) setPagos(data)
  }

  const FORMA_PAGO_LABEL = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', tarjeta: 'Tarjeta' }

  async function ajustarSaldo(cuenta_id, delta) {
    if (!cuenta_id) return
    const { data } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', cuenta_id).single()
    if (data) await supabase.from('cuentas_bancarias').update({ saldo: Number(data.saldo) + delta }).eq('id', cuenta_id)
  }

  async function registrarPago(e) {
    e.preventDefault()
    const monto = parseFloat(formPago.monto)
    await supabase.from('pagos').insert([{
      factura_id: mostrarPagos.id,
      fecha_pago: new Date().toISOString().split('T')[0],
      monto,
      medio_pago: formPago.medio_pago,
      referencia: formPago.referencia,
      cuenta_id: formPago.cuenta_id || null
    }])
    await supabase.from('movimientos_financieros').insert([{
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'ingreso',
      categoria: 'Cobranzas',
      descripcion: `Cobro factura ${mostrarPagos.numero_factura}`,
      monto,
      cuenta_id: formPago.cuenta_id || null,
      comprobante: formPago.referencia,
      forma_pago: FORMA_PAGO_LABEL[formPago.medio_pago] || formPago.medio_pago,
      factura_id: mostrarPagos.id
    }])
    await ajustarSaldo(formPago.cuenta_id, monto)
    const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0) + monto
    const nuevoEstado = totalPagado >= mostrarPagos.total ? 'pagada' : 'parcial'
    await supabase.from('facturas').update({ estado: nuevoEstado }).eq('id', mostrarPagos.id)
    setFormPago({ monto: '', medio_pago: 'transferencia', referencia: '', cuenta_id: '' })
    verPagos(mostrarPagos)
    await cargarDatos()
    emitirCambioDatos('facturacion')
  }

  const metricasFacturacion = useMemo(() => {
    let totalFacturado = 0
    let totalNeto = 0
    let totalIVA = 0
    let totalCobrado = 0
    let totalPendiente = 0
    let cantidadCobradas = 0
    let cantidadPendientes = 0

    facturas.forEach(f => {
      if (f.estado === 'anulada') return
      const d = calcularDesgloseFactura(f)
      totalFacturado += d.total
      totalNeto += d.neto
      totalIVA += d.iva

      if (['pagada', 'cobrada'].includes(f.estado)) {
        totalCobrado += d.total
        cantidadCobradas++
      } else {
        totalPendiente += d.total
        cantidadPendientes++
      }
    })

    return {
      totalFacturado: Math.round(totalFacturado * 100) / 100,
      totalNeto: Math.round(totalNeto * 100) / 100,
      totalIVA: Math.round(totalIVA * 100) / 100,
      totalCobrado: Math.round(totalCobrado * 100) / 100,
      totalPendiente: Math.round(totalPendiente * 100) / 100,
      cantidadCobradas,
      cantidadPendientes,
      totalFacturasActivas: facturas.filter(f => f.estado !== 'anulada').length
    }
  }, [facturas])

  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      // Filtro por estado
      if (filtroEstado === 'pendiente') {
        if (['pagada', 'cobrada', 'anulada'].includes(f.estado)) return false
      } else if (filtroEstado === 'cobrada') {
        if (!['pagada', 'cobrada'].includes(f.estado)) return false
      } else if (filtroEstado === 'anulada') {
        if (f.estado !== 'anulada') return false
      }

      // Filtro por texto
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase()
        const num = (f.numero_factura || '').toLowerCase()
        const cliente = (f.clientes?.razon_social || f.clientes?.nombre_contacto || '').toLowerCase()
        const obs = (f.observaciones || '').toLowerCase()
        if (!num.includes(q) && !cliente.includes(q) && !obs.includes(q)) return false
      }

      return true
    })
  }, [facturas, filtroEstado, busqueda])

  const conteos = useMemo(() => {
    const cobradas = facturas.filter(f => ['pagada', 'cobrada'].includes(f.estado))
    const pendientes = facturas.filter(f => !['pagada', 'cobrada', 'anulada'].includes(f.estado))
    const anuladas = facturas.filter(f => f.estado === 'anulada')
    return {
      todas: facturas.length,
      cobradas: cobradas.length,
      pendientes: pendientes.length,
      anuladas: anuladas.length
    }
  }, [facturas])

  const totalesFiltrados = useMemo(() => {
    let neto = 0
    let iva = 0
    let total = 0
    facturasFiltradas.forEach(f => {
      if (f.estado === 'anulada') return
      const d = calcularDesgloseFactura(f)
      neto += d.neto
      iva += d.iva
      total += d.total
    })
    return {
      neto: Math.round(neto * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(total * 100) / 100
    }
  }, [facturasFiltradas])

  const estadoColor = {
    emitida:  { bg: '#fef3c7', color: '#d97706' },
    pendiente:{ bg: '#fef3c7', color: '#d97706' },
    pagada:   { bg: '#d1fae5', color: '#059669' },
    cobrada:  { bg: '#d1fae5', color: '#059669' },
    parcial:  { bg: '#dbeafe', color: '#1d4ed8' },
    vencida:  { bg: '#fee2e2', color: '#dc2626' },
    anulada:  { bg: '#f1f5f9', color: '#64748b' },
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={s.cabecera(c.gradient)}>
        <div>
          <h3 style={{ ...s.cabeceraTexto, display:'flex', alignItems:'center', gap:'9px' }}><Receipt size={19} /> Facturación</h3>
          <p style={s.cabeceraSubtexto}>{facturas.length} facturas · {contratosHora.length} contratos por hora</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {contratosHora.length > 0 && (
            <button style={{ ...s.btnPrimario('rgba(255,255,255,0.2)'), border: '1px solid rgba(255,255,255,0.4)' }}
              onClick={() => { setMostrarGenerador(!mostrarGenerador); cancelar() }}>
              Facturar por horas
            </button>
          )}
          <button style={s.btnPrimario('rgba(255,255,255,0.25)')} onClick={() => { if (mostrarForm) { cancelar() } else { setMostrarForm(true); setMostrarGenerador(false) } }}>
            {mostrarForm ? <><X size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Cancelar</> : <><Plus size={14} style={{ marginRight: 5, verticalAlign: '-2px' }} />Factura manual</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setVista('facturas')} style={vista === 'facturas' ? s.btnPrimario(c.main) : s.btnSecundario}>Facturas</button>
          <button onClick={() => setVista('importar-arca')} style={vista === 'importar-arca' ? s.btnPrimario(c.main) : s.btnSecundario}>
            <FileUp size={13} style={{ marginRight: 5, verticalAlign: '-2px' }} />Importar desde ARCA
          </button>
        </div>

        {facturas.length > 0 && (
          <button
            type="button"
            onClick={() => setModalConfirmarBorrado(true)}
            style={{
              ...s.btnSecundario,
              color: '#DC2626',
              borderColor: '#FCA5A5',
              background: '#FEF2F2',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={14} color="#DC2626" />
            Borrar todas las facturas ({facturas.length})
          </button>
        )}
      </div>

      {vista === 'importar-arca' && <ImportarARCA tipoInicial="ventas" onImportado={cargarDatos} />}

      {vista === 'facturas' && (<>
      {/* KPIs DE FACTURACIÓN: TOTAL CON IVA, NETO GRAVADO E IVA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <div style={{ ...s.card, borderTop: `3px solid ${c.main}` }}>
          <p style={{ ...s.label, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Total Facturado</span>
            <span style={{ fontSize: '10px', background: '#FFF1F2', color: c.main, padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Con IVA</span>
          </p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: '4px 0 2px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metricasFacturacion.totalFacturado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
            {metricasFacturacion.totalFacturasActivas} facturas emitidas
          </span>
        </div>

        <div style={{ ...s.card, borderTop: '3px solid #0284C7' }}>
          <p style={{ ...s.label, color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Neto Gravado</span>
            <span style={{ fontSize: '10px', background: '#F0F9FF', color: '#0284C7', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Total / 1,21</span>
          </p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: '#0284C7', margin: '4px 0 2px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metricasFacturacion.totalNeto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
            Subtotal sin IVA
          </span>
        </div>

        <div style={{ ...s.card, borderTop: '3px solid #7C3AED' }}>
          <p style={{ ...s.label, color: '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>IVA Débito Fiscal</span>
            <span style={{ fontSize: '10px', background: '#F5F3FF', color: '#7C3AED', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Total - Neto</span>
          </p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: '#7C3AED', margin: '4px 0 2px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metricasFacturacion.totalIVA.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
            Impuesto liquidado
          </span>
        </div>

        <div style={{ ...s.card, borderTop: '3px solid #DC2626', background: '#FFF1F2' }}>
          <p style={{ ...s.label, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Pendiente de Cobro</span>
            <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Por cobrar</span>
          </p>
          <p style={{ fontSize: '22px', fontWeight: '800', color: '#DC2626', margin: '4px 0 2px', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {metricasFacturacion.totalPendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
          </p>
          <span style={{ fontSize: '11.5px', color: '#991B1B' }}>
            {metricasFacturacion.cantidadPendientes} facturas pendientes · {metricasFacturacion.cantidadCobradas} cobradas
          </span>
        </div>
      </div>

      {/* BANNER EXPLICATIVO DE REGLA FISCAL: NETO + IVA = TOTAL */}
      <div style={{
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: '10px',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        fontSize: '12.5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
          <Calculator size={16} color="#16A34A" />
          <span>
            <strong>Regla impositiva:</strong> El total que se muestra ya incluye el IVA. A ese valor se lo divide por la alícuota (ej. 1,21 al 21%) para determinar el Neto y el IVA: <strong>Neto + IVA = Total</strong>.
          </span>
        </div>
        <span style={{
          fontWeight: '800',
          color: '#15803D',
          background: '#DCFCE7',
          padding: '3px 10px',
          borderRadius: '6px',
          border: '1px solid #86EFAC',
          fontFamily: 'monospace'
        }}>
          NETO + IVA = TOTAL
        </span>
      </div>

      {/* GENERADOR POR HORAS */}
      {mostrarGenerador && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 6px', color: '#d97706', fontWeight: '800' }}>⏱ Generador de facturas por horas</h4>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>Suma las horas registradas en la Agenda y genera la factura automáticamente con el desglose exacto de Neto + IVA = Total.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={s.label}>Período a facturar</label>
              <input type="month" style={{ ...s.input, maxWidth: '200px' }} value={mesGenerador} onChange={e => { setMesGenerador(e.target.value); setResumenHoras([]) }} />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button style={s.btnPrimario('#d97706')} onClick={calcularResumenHoras} disabled={loadingResumen}>
                {loadingResumen ? 'Calculando...' : 'Calcular horas'}
              </button>
            </div>
          </div>
          {resumenHoras.length === 0 && !loadingResumen && (
            <div style={{ background: '#fef9c3', borderRadius: '12px', padding: '16px', textAlign: 'center', color: '#854d0e', fontSize: '13px' }}>
              Presioná "Calcular horas" para ver las órdenes completadas del período.
            </div>
          )}
          {resumenHoras.map((r, i) => (
            <div key={i} style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '14px', padding: '20px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{r.cliente.razon_social || r.cliente.nombre_contacto}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{r.contrato.numero_contrato}</p>
                </div>
                <button style={s.btnPrimario('#d97706')} onClick={() => generarFacturaDesdeHoras(r)}>Generar factura</button>
              </div>
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <p style={{ ...s.label, marginBottom: '8px', color: '#d97706' }}>Detalle de servicios</p>
                {r.ordenes.map((o, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                    <span>{new Date(o.fecha_programada + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                    <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>{o.numero_orden}</span>
                    <span style={{ fontWeight: '700', color: '#d97706' }}>{o.horas} hs</span>
                    <span style={{ fontWeight: '700', color: '#059669' }}>{(o.horas * r.valorHora).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#d97706', fontWeight: '700', textTransform: 'uppercase' }}>Total horas</p>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#d97706' }}>{r.totalHoras} hs</p>
                </div>
                <div style={{ background: '#dbeafe', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#1d4ed8', fontWeight: '700', textTransform: 'uppercase' }}>Neto Gravado (Total / {(1 + (Number(r.ivaPorc)||0)/100).toFixed(2)})</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1d4ed8', fontFamily: 'monospace' }}>{r.subtotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
                <div style={{ background: '#ede9fe', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase' }}>IVA discriminado</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <input type="number" step="0.5" value={r.ivaPorc} onChange={e => actualizarIvaResumen(i, e.target.value)}
                      style={{ width: '56px', textAlign: 'center', fontWeight: '800', fontSize: '15px', color: '#7c3aed', border: '1.5px solid #ddd6fe', borderRadius: '6px', padding: '3px' }} />
                    <span style={{ fontSize: '13px', color: '#7c3aed', fontWeight: '700' }}>%</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7c3aed', fontFamily: 'monospace' }}>{r.impuestos.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
                <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '2px solid #6ee7b7' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Total a facturar (con IVA)</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#059669', fontFamily: 'monospace' }}>{r.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORMULARIO DE FACTURA MANUAL CON DESGLOSE AUTOMÁTICO */}
      {mostrarForm && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 6px', color: c.main, fontWeight: '800' }}>
            {editando ? <><Pencil size={15} style={{ marginRight: 6, verticalAlign: '-2px' }} />Editando — {editando.numero_factura}</> : 'Nueva factura manual'}
          </h4>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
            El importe total ingresado ya incluye el IVA. El sistema divide automáticamente por la alícuota para determinar el Neto y el IVA (Neto + IVA = Total).
          </p>

          <form onSubmit={guardarFactura}>
            <div style={s.grid2}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Contrato</label>
                <select style={s.input} value={form.contrato_id}
                  onChange={e => {
                    const ct = contratos.find(c => c.id === e.target.value)
                    const precioContrato = ct?.precio_acordado ? ct.precio_acordado.toString() : ''
                    const d = calcularDesgloseFactura(parseFloat(precioContrato) || 0, parseFloat(form.alicuota_iva) || 21)
                    setForm(prev => ({
                      ...prev,
                      contrato_id: e.target.value,
                      total: precioContrato,
                      subtotal: d.neto > 0 ? d.neto.toString() : '',
                      impuestos: d.iva > 0 ? d.iva.toString() : '0'
                    }))
                  }} required={!editando}>
                  <option value="">Seleccionar contrato</option>
                  {contratos.map(ct => (
                    <option key={ct.id} value={ct.id}>
                      {ct.numero_contrato} — {ct.clientes?.razon_social || ct.clientes?.nombre_contacto} {ct.precio_acordado ? `($${Number(ct.precio_acordado).toLocaleString('es-AR')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {[['Período desde','periodo_desde','date'],['Período hasta','periodo_hasta','date'],['Fecha vencimiento','fecha_vencimiento','date']].map(([lbl,key,type]) => (
                <div key={key}>
                  <label style={s.label}>{lbl}</label>
                  <input type={type} style={s.input} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                    onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              ))}

              {editando && (
                <div>
                  <label style={s.label}>Estado</label>
                  <select style={s.input} value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="emitida">Emitida</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Pago parcial</option>
                    <option value="pagada">Pagada</option>
                    <option value="cobrada">Cobrada</option>
                    <option value="vencida">Vencida</option>
                    <option value="anulada">Anulada</option>
                  </select>
                </div>
              )}

              {/* CAMPO PRINCIPAL: TOTAL CON IVA INCLUIDO */}
              <div>
                <label style={{ ...s.label, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Total con IVA ($) · Importe final</span>
                  <span style={{ fontSize: '10.5px', color: c.main, fontWeight: '700' }}>Ya incluye IVA</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  style={{ ...s.input, borderColor: c.main, fontWeight: '700', fontSize: '15px' }}
                  value={form.total}
                  onChange={e => manejarCambioTotal(e.target.value)}
                  placeholder="Ej: 121000"
                  required
                />
              </div>

              {/* SELECTOR DE ALÍCUOTA DE IVA */}
              <div>
                <label style={s.label}>Alícuota IVA (%)</label>
                <select
                  style={s.input}
                  value={form.alicuota_iva}
                  onChange={e => manejarCambioAlicuota(e.target.value)}
                >
                  <option value="21">21% — Estándar (General)</option>
                  <option value="10.5">10.5% — Reducida</option>
                  <option value="27">27% — Incrementada (Servicios públicos)</option>
                  <option value="0">0% — Exento / No gravado</option>
                </select>
              </div>

              {/* CAMPO SECUNDARIO: NETO GRAVADO (Sincronizado) */}
              <div>
                <label style={{ ...s.label, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Neto Gravado ($)</span>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>Total / {(1 + (parseFloat(form.alicuota_iva) || 21) / 100).toFixed(2)}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  style={s.input}
                  value={form.subtotal}
                  onChange={e => manejarCambioNeto(e.target.value)}
                  placeholder="Auto-calculado al escribir el total"
                />
              </div>

              {/* CAMPO SECUNDARIO: IVA CALCULADO (Informativo) */}
              <div>
                <label style={{ ...s.label, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>IVA discriminado ($)</span>
                  <span style={{ fontSize: '10.5px', color: '#7C3AED' }}>Total - Neto</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  readOnly
                  style={{ ...s.input, background: '#FAF5FF', color: '#7C3AED', fontWeight: '700' }}
                  value={form.impuestos}
                />
              </div>

              {/* RECUADRO DINÁMICO DE DESGLOSE CONTABLE */}
              <div style={{
                gridColumn: '1 / -1',
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                textAlign: 'center'
              }}>
                <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Neto Gravado</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace' }}>
                    {(parseFloat(form.subtotal) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                  <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>Total / {(1 + (parseFloat(form.alicuota_iva) || 21) / 100).toFixed(2)}</span>
                </div>

                <div style={{ background: '#FAF5FF', padding: '12px', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#7C3AED', fontWeight: '700', textTransform: 'uppercase' }}>IVA ({form.alicuota_iva}%)</p>
                  <p style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#7C3AED', fontFamily: 'monospace' }}>
                    {(parseFloat(form.impuestos) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                  <span style={{ fontSize: '10.5px', color: '#A78BFA' }}>Total - Neto</span>
                </div>

                <div style={{ background: '#FFF1F2', padding: '12px', borderRadius: '8px', border: '2px solid #FDA4AF' }}>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: c.main, fontWeight: '800', textTransform: 'uppercase' }}>Total Facturado</p>
                  <p style={{ margin: 0, fontSize: '21px', fontWeight: '900', color: c.main, fontFamily: 'monospace' }}>
                    {(parseFloat(form.total) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                  <span style={{ fontSize: '10.5px', color: '#BE123C', fontWeight: '700' }}>Neto + IVA = Total</span>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Observaciones</label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={form.observaciones}
                  onChange={e => setForm({...form, observaciones: e.target.value})}
                  onFocus={e => e.target.style.borderColor = c.main} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button type="button" style={s.btnSecundario} onClick={cancelar}>Cancelar</button>
              <button type="submit" style={s.btnPrimario(c.main)}>{editando ? 'Guardar cambios' : 'Emitir factura'}</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PAGOS CON DESGLOSE COMPLETO */}
      {mostrarPagos && (() => {
        const d = calcularDesgloseFactura(mostrarPagos)
        const totalCobrado = pagos.reduce((a, p) => a + Number(p.monto), 0)
        const saldoPendiente = Math.max(0, d.total - totalCobrado)

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#0f172a', fontWeight: '800' }}>Pagos y Cobranzas</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748B' }}>Factura {mostrarPagos.numero_factura} · {mostrarPagos.clientes?.razon_social || mostrarPagos.clientes?.nombre_contacto}</p>
                </div>
                <button onClick={() => setMostrarPagos(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '16px', fontSize: '13px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>
                  <div style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Neto Gravado</span>
                    <strong style={{ fontSize: '13.5px', color: '#0F172A', fontFamily: 'monospace' }}>{d.neto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                  </div>
                  <div style={{ background: '#FAF5FF', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE' }}>
                    <span style={{ fontSize: '10.5px', color: '#7C3AED', display: 'block', textTransform: 'uppercase' }}>IVA ({d.alicuota}%)</span>
                    <strong style={{ fontSize: '13.5px', color: '#7C3AED', fontFamily: 'monospace' }}>{d.iva.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                  </div>
                  <div style={{ background: '#FFF1F2', padding: '8px', borderRadius: '6px', border: '1px solid #FDA4AF' }}>
                    <span style={{ fontSize: '10.5px', color: c.main, display: 'block', textTransform: 'uppercase' }}>Total con IVA</span>
                    <strong style={{ fontSize: '13.5px', color: c.main, fontFamily: 'monospace' }}>{d.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Total Facturado:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{d.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748B' }}>Cobrado acumulado:</span>
                  <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{totalCobrado.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #CBD5E1', paddingTop: '6px', marginTop: '6px' }}>
                  <span style={{ color: '#64748B', fontWeight: '700' }}>Saldo pendiente:</span>
                  <strong style={{ color: saldoPendiente > 0 ? '#DC2626' : '#059669', fontSize: '14px', fontFamily: 'monospace' }}>
                    {saldoPendiente.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </strong>
                </div>
              </div>

              {pagos.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>{formatearFecha(p.fecha_pago)}</span>
                  <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{p.medio_pago}{p.cuenta_id ? ` · ${cuentas.find(ct => ct.id === p.cuenta_id)?.banco || ''}` : ''}</span>
                  <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{Number(p.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</strong>
                </div>
              ))}

              <form onSubmit={registrarPago} style={{ marginTop: '16px' }}>
                <div style={s.grid2}>
                  <div>
                    <label style={s.label}>Monto ($)</label>
                    <input type="number" step="0.01" style={s.input} value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} required />
                  </div>
                  <div>
                    <label style={s.label}>Medio de pago</label>
                    <select style={s.input} value={formPago.medio_pago} onChange={e => setFormPago({...formPago, medio_pago: e.target.value})}>
                      <option value="transferencia">Transferencia</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="cheque">Cheque</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Cuenta / caja que recibe el pago</label>
                    <select style={s.input} value={formPago.cuenta_id} onChange={e => setFormPago({...formPago, cuenta_id: e.target.value})} required>
                      <option value="">Seleccionar cuenta</option>
                      {cuentas.map(ct => <option key={ct.id} value={ct.id}>{ct.banco} — {ct.tipo}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Referencia</label>
                    <input style={s.input} value={formPago.referencia} onChange={e => setFormPago({...formPago, referencia: e.target.value})} placeholder="Nro. transferencia, cheque..." />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                  <button type="button" style={s.btnSecundario} onClick={() => setMostrarPagos(null)}>Cerrar</button>
                  <button type="submit" style={s.btnPrimario('#059669')}>Registrar pago</button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', maxWidth: '420px', position: 'relative' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '10px' }} />
          <input
            type="text"
            placeholder="Buscar por Nº factura, cliente u observaciones..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              ...s.input,
              paddingLeft: '34px',
              paddingRight: busqueda ? '30px' : '12px',
              fontSize: '13px'
            }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
              title="Borrar búsqueda"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltroEstado('todos')}
            style={{
              ...s.btnSecundario,
              padding: '6px 12px',
              fontSize: '12px',
              background: filtroEstado === 'todos' ? '#0F172A' : '#FFFFFF',
              color: filtroEstado === 'todos' ? '#FFFFFF' : '#475569',
              borderColor: filtroEstado === 'todos' ? '#0F172A' : '#CBD5E1'
            }}
          >
            Todas ({conteos.todas})
          </button>
          <button
            onClick={() => setFiltroEstado('pendiente')}
            style={{
              ...s.btnSecundario,
              padding: '6px 12px',
              fontSize: '12px',
              background: filtroEstado === 'pendiente' ? '#DC2626' : '#FFFFFF',
              color: filtroEstado === 'pendiente' ? '#FFFFFF' : '#DC2626',
              borderColor: filtroEstado === 'pendiente' ? '#DC2626' : '#FECDD3'
            }}
          >
            Por cobrar ({conteos.pendientes})
          </button>
          <button
            onClick={() => setFiltroEstado('cobrada')}
            style={{
              ...s.btnSecundario,
              padding: '6px 12px',
              fontSize: '12px',
              background: filtroEstado === 'cobrada' ? '#059669' : '#FFFFFF',
              color: filtroEstado === 'cobrada' ? '#FFFFFF' : '#059669',
              borderColor: filtroEstado === 'cobrada' ? '#059669' : '#A7F3D0'
            }}
          >
            Cobradas ({conteos.cobradas})
          </button>
          <button
            onClick={() => setFiltroEstado('anulada')}
            style={{
              ...s.btnSecundario,
              padding: '6px 12px',
              fontSize: '12px',
              background: filtroEstado === 'anulada' ? '#64748B' : '#FFFFFF',
              color: filtroEstado === 'anulada' ? '#FFFFFF' : '#64748B',
              borderColor: filtroEstado === 'anulada' ? '#64748B' : '#E2E8F0'
            }}
          >
            Anuladas ({conteos.anuladas})
          </button>
        </div>
      </div>

      {/* TABLA DE FACTURAS CON DESGLOSE: NETO, IVA Y TOTAL */}
      <div style={{ ...s.card, padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
        {loading ? <div style={s.empty}>Cargando...</div>
        : facturas.length === 0 ? <div style={s.empty}>No hay facturas registradas</div>
        : facturasFiltradas.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
            No se encontraron facturas que coincidan con la búsqueda o filtro seleccionado.
            {(busqueda || filtroEstado !== 'todos') && (
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => { setBusqueda(''); setFiltroEstado('todos') }}
                  style={{ ...s.btnSecundario, fontSize: '12px', padding: '6px 14px' }}
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        ) : (
          <table style={{ ...s.tabla, minWidth: '1080px', width: '100%' }}>
            <thead>
              <tr>
                <th style={s.tablaCabecera('#0F172A')}>Número</th>
                <th style={s.tablaCabecera('#0F172A')}>Cliente</th>
                <th style={s.tablaCabecera('#0F172A')}>Tipo</th>
                <th style={s.tablaCabecera('#0F172A')}>Emisión</th>
                <th style={s.tablaCabecera('#0F172A')}>Vencimiento</th>
                <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Neto Gravado</th>
                <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>IVA</th>
                <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'right' }}>Total (con IVA)</th>
                <th style={{ ...s.tablaCabecera('#0F172A'), textAlign: 'center' }}>Estado</th>
                <th style={{
                  ...s.tablaCabecera('#0F172A'),
                  position: 'sticky',
                  right: 0,
                  zIndex: 3,
                  textAlign: 'center',
                  minWidth: '175px',
                  boxShadow: '-4px 0 8px rgba(0,0,0,0.12)'
                }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.map((f, i) => {
                const ec = estadoColor[f.estado] || { bg: '#f1f5f9', color: '#64748b' }
                const esPorHora = f.contratos?.tipo_facturacion === 'por_hora'
                const bgColor = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                const d = calcularDesgloseFactura(f)

                return (
                  <tr key={f.id} style={s.tablaFila(i)}>
                    <td style={{ ...s.tablaCell, fontFamily: 'monospace', fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {f.numero_factura}
                    </td>
                    <td style={s.tablaCellBold}>
                      {f.clientes?.razon_social || f.clientes?.nombre_contacto || 'Cliente s/n'}
                    </td>
                    <td style={s.tablaCell}>
                      <span style={s.badge(esPorHora ? '#fef3c7' : '#dbeafe', esPorHora ? '#d97706' : '#1d4ed8')}>
                        {esPorHora ? '⏱ Por hora' : 'Fijo'}
                      </span>
                    </td>
                    <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>
                      {formatearFecha(f.fecha_emision)}
                    </td>
                    <td style={{ ...s.tablaCell, whiteSpace: 'nowrap' }}>
                      {formatearFecha(f.fecha_vencimiento)}
                    </td>
                    {/* NETO GRAVADO (DIVIDIDO POR ALÍCUOTA) */}
                    <td style={{ ...s.tablaCell, textAlign: 'right', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#334155' }}>
                      {d.neto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </td>
                    {/* IVA DISCRIMINADO */}
                    <td style={{ ...s.tablaCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'monospace', color: '#7C3AED', fontWeight: '700' }}>
                        {d.iva.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                      </div>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{d.alicuota}%</span>
                    </td>
                    {/* TOTAL FINAL CON IVA INCLUIDO */}
                    <td style={{ ...s.tablaCellBold, textAlign: 'right', color: '#0f172a', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '13.5px' }}>
                      {d.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                    </td>
                    <td style={{ ...s.tablaCell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={s.badge(ec.bg, ec.color)}>{f.estado}</span>
                    </td>
                    <td style={{
                      ...s.tablaCell,
                      position: 'sticky',
                      right: 0,
                      background: bgColor,
                      zIndex: 2,
                      textAlign: 'center',
                      minWidth: '175px',
                      boxShadow: '-4px 0 8px rgba(0,0,0,0.05)',
                      whiteSpace: 'nowrap'
                    }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => verPagos(f)} style={{ ...s.btnPrimario('#059669'), padding: '5px 10px', fontSize: '12px' }}>Pagos</button>
                        <button onClick={() => abrirEdicion(f)} style={{ ...s.btnPrimario(c.main), padding: '5px 10px', fontSize: '12px' }} title="Editar"><Pencil size={14} /></button>
                        {f.estado !== 'anulada' && (
                          <button onClick={() => anularFactura(f.id)} style={{ ...s.btnPeligro, padding: '5px 10px', fontSize: '12px' }}>Anular</button>
                        )}
                        <button
                          title="Eliminar factura"
                          onClick={() => eliminarFacturaIndividual(f.id, f.numero_factura)}
                          style={{ ...s.btnPeligro, padding: '5px 8px', fontSize: '12px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* PIE DE TABLA CON TOTALES ACUMULADOS: NETO + IVA = TOTAL */}
            <tfoot>
              <tr style={{ background: '#F8FAFC', borderTop: '2px solid #CBD5E1', fontWeight: '800' }}>
                <td colSpan={5} style={{ ...s.tablaCell, fontWeight: '800', color: '#0F172A', textAlign: 'right', fontSize: '12px' }}>
                  Totales facturados ({busqueda || filtroEstado !== 'todos' ? `${facturasFiltradas.length} de ${facturas.length}` : 'Neto + IVA = Total'}):
                </td>
                <td style={{ ...s.tablaCell, textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: '#0284C7', fontSize: '13px' }}>
                  {totalesFiltrados.neto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
                <td style={{ ...s.tablaCell, textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: '#7C3AED', fontSize: '13px' }}>
                  {totalesFiltrados.iva.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
                <td style={{ ...s.tablaCellBold, textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: c.main, fontSize: '14px' }}>
                  {totalesFiltrados.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
                <td style={{ ...s.tablaCell, textAlign: 'center', fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                  ✓ Cuadrado
                </td>
                <td style={{
                  ...s.tablaCell,
                  position: 'sticky',
                  right: 0,
                  background: '#F8FAFC',
                  zIndex: 2,
                  textAlign: 'center',
                  minWidth: '175px',
                  boxShadow: '-4px 0 8px rgba(0,0,0,0.05)',
                  fontSize: '11px',
                  color: '#94A3B8'
                }}>
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      </>)}

      {/* MODAL CONFIRMAR BORRADO TOTAL */}
      {modalConfirmarBorrado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #FCA5A5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#DC2626" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#991B1B' }}>
                  ¿Borrar todas las facturas de venta?
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  Limpieza total para reimportar desde ARCA
                </p>
              </div>
            </div>

            <div style={{ background: '#FEF2F2', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', color: '#991B1B', lineHeight: '1.5', marginBottom: '20px' }}>
              Esta acción eliminará de forma irreversible las <strong>{facturas.length} facturas de venta</strong> actualmente cargadas en el sistema.
              <br /><br />
              Esto te permitirá tener el módulo 100% en blanco para importar de manera limpia el archivo CSV oficial descargado de ARCA sin generar duplicados.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                style={s.btnSecundario}
                onClick={() => setModalConfirmarBorrado(false)}
                disabled={borrandoTodas}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{ ...s.btnPeligro, display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontWeight: '700' }}
                onClick={borrarTodasLasFacturas}
                disabled={borrandoTodas}
              >
                {borrandoTodas ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    Borrando facturas…
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Confirmar y vaciar todo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Facturacion


