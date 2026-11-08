import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, colores, paleta } from '../estilos.js'
import { calcular, CONFIG_DEFAULT, INPUT_DEFAULT, ESCALAS } from '../presupuestoDotacion.js'

const c = colores.presupuestos
const ars = (v) => Number(v || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const ars2 = (v) => Number(v || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const num = (v, d = 2) => Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: d })

function Campo({ label, children }) {
  return <div><label style={{ ...s.label, fontSize: 11 }}>{label}</label>{children}</div>
}

function Fila({ label, valor, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, fontWeight: bold ? 800 : 500, color: color || paleta.ink, borderTop: bold ? '1px solid #e2e8f0' : 'none' }}>
      <span>{label}</span><span>{valor}</span>
    </div>
  )
}

export default function PresupuestadorDotacion({ clientes, tiposServicio, onGuardado }) {
  const [cfg, setCfg] = useState(CONFIG_DEFAULT)
  const [cfgGuardada, setCfgGuardada] = useState(false)
  const [entrada, setEntrada] = useState(INPUT_DEFAULT)
  const [cliente, setCliente] = useState('')
  const [tipoServicio, setTipoServicio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [verConfig, setVerConfig] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('presupuestador_dotacion_config').select('config').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data?.config) { setCfg({ ...CONFIG_DEFAULT, ...data.config }); setCfgGuardada(true) }
    })
  }, [])

  const r = useMemo(() => calcular(entrada, cfg), [entrada, cfg])
  const setE = (k, v) => setEntrada((e) => ({ ...e, [k]: v }))
  const setC = (k, v) => setCfg((x) => ({ ...x, [k]: v }))
  const setLista = (lista, i, k, v) => setCfg((x) => ({ ...x, [lista]: x[lista].map((it, j) => (j === i ? { ...it, [k]: v } : it)) }))

  async function guardarConfig() {
    const { error } = await supabase.from('presupuestador_dotacion_config').upsert({ id: 1, config: cfg, actualizado_en: new Date().toISOString() })
    if (error) { setMsg('Error: ' + error.message); return }
    setCfgGuardada(true); setMsg('Parámetros guardados.')
  }

  async function guardarPresupuesto() {
    if (!cliente) { setMsg('Elegí un cliente.'); return }
    const horasMes = r.horasPuestoMes * r.entrada.plazo
    const { error } = await supabase.from('presupuestos').insert([{
      cliente_id: cliente,
      tipo_servicio_id: tipoServicio || null,
      descripcion: descripcion || `Servicio por dotación: ${r.entrada.P} emp./turno × ${r.entrada.H} h × ${r.entrada.D} días/sem (${r.dotacion.total} personas)`,
      fecha_vencimiento: vencimiento || null,
      horas_estimadas: Math.round(horasMes),
      observaciones: `Precio mensual neto. Plazo ${r.entrada.plazo} meses. Total con IVA del plazo: ${ars(r.totalPlazoConIva)}.`,
      numero_presupuesto: 'PRES-' + new Date().getFullYear() + '-' + (Math.floor(Math.random() * 900) + 100),
      fecha_emision: new Date().toISOString().split('T')[0],
      costo_mano_obra: +r.laboral.total.toFixed(2),
      costo_insumos: +r.totalInsumos.toFixed(2),
      costo_traslado: 0,
      otros_costos: +(r.totalEquipos + r.ga + r.imprevistos).toFixed(2),
      subtotal: +(r.costoOperativo).toFixed(2),
      porcentaje_ganancia: +(r.margenSobreCosto * 100).toFixed(2),
      precio_final: +r.precioNeto.toFixed(2),
      detalle_dotacion: { tipo: 'dotacion', entrada, config: cfg, resultado: r }
    }])
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Presupuesto guardado.')
    onGuardado?.()
  }

  const inp = { ...s.input, padding: '7px 9px' }
  const d = r.dotacion

  return (
    <div>
      <div style={s.card}>
        <h4 style={{ margin: '0 0 14px', color: c.main, fontWeight: 700 }}>Variables del servicio</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
          <Campo label="Empleados por turno (incl. jefe)"><input type="number" min="0" style={inp} value={entrada.empleadosTurno} onChange={(e) => setE('empleadosTurno', e.target.value)} /></Campo>
          <Campo label="Jefes por turno"><input type="number" min="0" style={inp} value={entrada.jefesTurno} onChange={(e) => setE('jefesTurno', e.target.value)} /></Campo>
          <Campo label="Horas por día (0–24)"><input type="number" min="0" max="24" style={inp} value={entrada.horasDia} onChange={(e) => setE('horasDia', e.target.value)} /></Campo>
          <Campo label="Días por semana (0–7)"><input type="number" min="0" max="7" style={inp} value={entrada.diasSemana} onChange={(e) => setE('diasSemana', e.target.value)} /></Campo>
          <Campo label="Dotación manual (opcional)"><input type="number" min="0" style={inp} placeholder={`Auto: ${d.base + d.reserva}`} value={entrada.dotacionManual} onChange={(e) => setE('dotacionManual', e.target.value)} /></Campo>
          <Campo label="Plazo (meses)"><input type="number" min="1" style={inp} value={entrada.plazoMeses} onChange={(e) => setE('plazoMeses', e.target.value)} /></Campo>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px', color: c.main, fontWeight: 700 }}>Dotación</h4>
          <Fila label="Horas-puesto por semana" valor={num(d.horasPuestoSemana, 0)} />
          <Fila label="Días trabajados por empleado" valor={num(d.diasTrabajados, 0)} />
          <Fila label="Dotación base" valor={d.base} />
          <Fila label="Reserva (retén/reemplazos)" valor={d.reserva} />
          <Fila label="Total de personas" valor={d.total} bold />
          <Fila label="Jefes / titulares / retén" valor={`${d.jefes} / ${d.titulares} / ${d.reten}`} />
          <Fila label="Cobertura de horas" valor={`${num(d.cobertura * 100, 1)}%`} color={d.cobertura < 1 ? '#dc2626' : undefined} />
          {d.cobertura < 1 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>La dotación manual no cubre todas las horas-puesto.</p>}
          {d.factorContratacion < 1 && <p style={{ margin: '6px 0 0', fontSize: 12, color: paleta.muted }}>Contratación proporcional: {num(d.factorContratacion * 100, 1)}% de la jornada de {cfg.horasContratoSemana} h.</p>}
        </div>

        <div style={s.card}>
          <h4 style={{ margin: '0 0 8px', color: c.main, fontWeight: 700 }}>Costos mensuales</h4>
          <Fila label="Mano de obra" valor={ars(r.laboral.total)} />
          <Fila label="Insumos" valor={ars(r.totalInsumos)} />
          <Fila label="Maquinaria y equipos" valor={ars(r.totalEquipos)} />
          <Fila label={`Gastos generales (${cfg.gaPct}%)`} valor={ars(r.ga)} />
          <Fila label={`Imprevistos (${cfg.imprevistosPct}%)`} valor={ars(r.imprevistos)} />
          <Fila label="Costo operativo" valor={ars(r.costoOperativo)} bold />
          <Fila label={`Utilidad (${cfg.margenPct}% s/precio)`} valor={ars(r.utilidad)} color="#059669" />
          {cfg.incluirImpuestosEnPrecio && <Fila label="IIBB + cheque" valor={ars(r.impuestos)} />}
        </div>

        <div style={{ ...s.card, background: c.main, color: '#fff' }}>
          <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Precio</h4>
          <Fila label="Precio mensual neto" valor={ars(r.precioNeto)} bold />
          <Fila label={`IVA ${cfg.ivaPct}%`} valor={ars(r.iva)} />
          <Fila label="Total mensual con IVA" valor={ars(r.precioConIva)} bold />
          <Fila label={`Total ${r.entrada.plazo} meses con IVA`} valor={ars(r.totalPlazoConIva)} />
          <Fila label="Neto por hora-puesto" valor={ars2(r.netoPorHora)} />
          <Fila label="Neto por persona" valor={ars(r.netoPorPersona)} />
        </div>
      </div>

      <div style={s.card}>
        <h4 style={{ margin: '0 0 14px', color: c.main, fontWeight: 700 }}>Guardar como presupuesto</h4>
        <div style={s.grid2}>
          <Campo label="Cliente">
            <select style={s.input} value={cliente} onChange={(e) => setCliente(e.target.value)}>
              <option value="">Seleccionar cliente</option>
              {clientes.map((cl) => <option key={cl.id} value={cl.id}>{cl.razon_social || cl.nombre_contacto}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo de servicio">
            <select style={s.input} value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)}>
              <option value="">Seleccionar servicio</option>
              {tiposServicio.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Descripción (opcional)"><input style={s.input} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Campo>
          <Campo label="Vencimiento"><input type="date" style={s.input} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} /></Campo>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 14 }}>
          {msg && <span style={{ fontSize: 12.5, color: paleta.muted }}>{msg}</span>}
          <button style={s.btnPrimario(c.main)} onClick={guardarPresupuesto}>Guardar presupuesto</button>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h4 style={{ margin: 0, color: c.main, fontWeight: 700 }}>Parámetros, insumos y equipos {cfgGuardada ? '' : '(valores por defecto, sin guardar)'}</h4>
          <button style={s.btnSecundario} onClick={() => setVerConfig(!verConfig)}>{verConfig ? 'Ocultar' : 'Editar'}</button>
        </div>
        {verConfig && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
              {[
                ['Costo mensual jefe ($)', 'costoJefe'], ['Costo mensual operario ($)', 'costoOperario'],
                ['Horas por turno', 'horasTurno'], ['Días máx. por empleado', 'maxDiasEmpleado'],
                ['Horas contrato semanal', 'horasContratoSemana'], ['Reserva retén (%)', 'reservaPct'],
                ['G&A (%)', 'gaPct'], ['Imprevistos (%)', 'imprevistosPct'], ['Margen s/precio (%)', 'margenPct'],
                ['IIBB (%)', 'iibbPct'], ['Cheque (%)', 'chequePct'], ['IVA (%)', 'ivaPct'],
                ['Ref.: empleados por turno', 'refEmpleadosTurno'], ['Ref.: horas por día', 'refHorasDia'], ['Ref.: días por semana', 'refDiasSemana']
              ].map(([l, k]) => (
                <Campo key={k} label={l}><input type="number" step="any" style={inp} value={cfg[k]} onChange={(e) => setC(k, e.target.value)} /></Campo>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 18, margin: '14px 0', fontSize: 13 }}>
              <label><input type="checkbox" checked={cfg.prorrateo} onChange={(e) => setC('prorrateo', e.target.checked)} /> Contratar proporcional si la jornada es menor a {cfg.horasContratoSemana} h</label>
              <label><input type="checkbox" checked={cfg.incluirImpuestosEnPrecio} onChange={(e) => setC('incluirImpuestosEnPrecio', e.target.checked)} /> Incluir IIBB y cheque en el precio</label>
            </div>

            <p style={{ ...s.label, margin: '8px 0' }}>Insumos (cantidad mensual de referencia)</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.tabla}>
                <thead><tr>{['Código', 'Descripción', 'Cantidad', 'Precio unit.', 'Escala con'].map((h) => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {cfg.insumos.map((i, idx) => (
                    <tr key={idx} style={s.tablaFila(idx)}>
                      <td style={s.tablaCell}>{i.cod}</td>
                      <td style={s.tablaCell}>{i.nombre}</td>
                      <td style={s.tablaCell}><input type="number" step="any" style={{ ...inp, width: 90 }} value={i.cantidad} onChange={(e) => setLista('insumos', idx, 'cantidad', e.target.value)} /></td>
                      <td style={s.tablaCell}><input type="number" step="any" style={{ ...inp, width: 110 }} value={i.precio} onChange={(e) => setLista('insumos', idx, 'precio', e.target.value)} /></td>
                      <td style={s.tablaCell}>
                        <select style={inp} value={i.escala} onChange={(e) => setLista('insumos', idx, 'escala', e.target.value)}>
                          {ESCALAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ ...s.label, margin: '16px 0 8px' }}>Maquinaria y equipos (costo mensual unitario = depreciación + mantenimiento)</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.tabla}>
                <thead><tr>{['Equipo', 'Cantidad ref.', 'Costo unit.', 'Crece con empleados'].map((h) => <th key={h} style={s.tablaCabecera(c.main)}>{h}</th>)}</tr></thead>
                <tbody>
                  {cfg.equipos.map((e, idx) => (
                    <tr key={idx} style={s.tablaFila(idx)}>
                      <td style={s.tablaCell}>{e.nombre}</td>
                      <td style={s.tablaCell}><input type="number" step="any" style={{ ...inp, width: 80 }} value={e.cantidad} onChange={(ev) => setLista('equipos', idx, 'cantidad', ev.target.value)} /></td>
                      <td style={s.tablaCell}><input type="number" step="any" style={{ ...inp, width: 110 }} value={e.costoUnit} onChange={(ev) => setLista('equipos', idx, 'costoUnit', ev.target.value)} /></td>
                      <td style={s.tablaCell}><input type="checkbox" checked={!!e.porEmpleado} onChange={(ev) => setLista('equipos', idx, 'porEmpleado', ev.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button style={s.btnSecundario} onClick={() => setCfg(CONFIG_DEFAULT)}>Restaurar valores del Excel</button>
              <button style={s.btnPrimario(c.main)} onClick={guardarConfig}>Guardar parámetros</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
