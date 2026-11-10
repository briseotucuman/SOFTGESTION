import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const hoy = new Date().toLocaleDateString('en-CA')
const fmt = f => (f ? String(f).split('-').reverse().join('/') : '—')
const nombrePeriodo = p => { const [a, m] = String(p).split('-'); return `${['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][Number(m)]} ${a}` }

function Fila({ etiqueta, valor, fuerte, color }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 13, fontWeight: fuerte ? 700 : 400, color: color || paleta.ink }}><span>{etiqueta}</span><span style={{ fontFamily: paleta.fontMono }}>{valor}</span></div>
}

// Declaración jurada F.931 (SUSS): liquidación de cargas sociales, pago y conciliación con los recibos
export default function Formulario931() {
  const [decls, setDecls] = useState([])
  const [sel, setSel] = useState('')
  const [liqs, setLiqs] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [pago, setPago] = useState({ fecha: hoy, cuenta_id: '' })
  const [venc, setVenc] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from('declaraciones_931').select('*').order('periodo', { ascending: false })
    if (e) return setError('Falta crear las tablas: ejecutá sueldos_f931_softgestion.sql en Supabase (SQL Editor).')
    setError(''); setDecls(data || [])
    setSel(p => p || data?.[0]?.id || '')
    const { data: c } = await supabase.from('cuentas_bancarias').select('id, banco, tipo').eq('activa', true)
    setCuentas(c || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const d = decls.find(x => x.id === sel)
  useEffect(() => {
    if (!d) return setLiqs([])
    setVenc(d.fecha_vencimiento || '')
    supabase.from('liquidaciones_sueldo').select('*, empleados(apellido, nombre)').eq('periodo', d.periodo).then(({ data }) => setLiqs(data || []))
  }, [d?.id, d?.periodo, d?.fecha_vencimiento])

  const concil = useMemo(() => {
    if (!d) return null
    const suma = k => liqs.reduce((a, l) => a + Number(l[k] || 0), 0)
    return { bruto: suma('total_bruto'), remun: suma('remunerativo'), contrib: suma('contribuciones_empleador'), costo: suma('costo_empleador'), n: liqs.length }
  }, [d, liqs])

  const guardarVenc = async () => { await supabase.from('declaraciones_931').update({ fecha_vencimiento: venc || null }).eq('id', d.id); cargar() }

  const registrarPago = async () => {
    if (!pago.cuenta_id) return setError('Elegí la cuenta desde la que se paga.')
    if (!confirm(`Registrar el pago del F.931 ${nombrePeriodo(d.periodo)} por ${ars(d.total_a_pagar)}? Se descuenta de la cuenta elegida.`)) return
    setError('')
    const { error: e1 } = await supabase.from('movimientos_financieros').insert([{ fecha: pago.fecha, tipo: 'egreso', categoria: 'Cargas sociales', descripcion: `F.931 ${d.periodo} — Seguridad social, obra social, ART y seguro de vida`, monto: d.total_a_pagar, cuenta_id: pago.cuenta_id, comprobante: `F931 ${d.periodo}`, forma_pago: 'Transferencia' }])
    if (e1) return setError(e1.message)
    const { data: cta } = await supabase.from('cuentas_bancarias').select('saldo').eq('id', pago.cuenta_id).single()
    if (cta) await supabase.from('cuentas_bancarias').update({ saldo: Number(cta.saldo) - Number(d.total_a_pagar) }).eq('id', pago.cuenta_id)
    await supabase.from('declaraciones_931').update({ estado: 'pagada', fecha_pago: pago.fecha, cuenta_id: pago.cuenta_id }).eq('id', d.id)
    setAviso('Pago registrado.'); cargar()
  }

  const card = { ...s.card, flex: '1 1 320px' }
  return (
    <div>
      {error && <div style={{ ...s.card, padding: 12, color: paleta.danger, background: paleta.dangerSoft }}>{error}</div>}
      {aviso && <div style={{ ...s.card, padding: 12, color: paleta.success, background: paleta.successSoft }}>{aviso}</div>}
      {decls.length === 0 && !error && <div style={s.card}>Todavía no hay declaraciones juradas cargadas.</div>}
      {d && (<>
        <div style={{ ...s.card, padding: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...s.input, width: 'auto' }} value={sel} onChange={e => setSel(e.target.value)}>
            {decls.map(x => <option key={x.id} value={x.id}>F.931 {nombrePeriodo(x.periodo)}{x.rectificativa ? ` (rect. ${x.rectificativa})` : ''}</option>)}
          </select>
          <span style={{ fontSize: 12, color: paleta.muted }}>CUIT {d.cuit} · Verificador {d.nro_verificador} · {d.empleados} empleados</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: d.estado === 'pagada' ? paleta.success : paleta.warn }}>{d.estado === 'pagada' ? `Pagado el ${fmt(d.fecha_pago)}` : 'Pendiente de pago'}</span>
        </div>

        <div style={{ ...s.card, background: d.estado === 'pagada' ? paleta.successSoft : paleta.warnSoft, padding: 16 }}>
          <div style={{ fontSize: 12, color: paleta.muted }}>Total a ingresar a ARCA (VIII - Montos que se ingresan)</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{ars(d.total_a_pagar)}</div>
          {d.estado !== 'pagada' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
              <div><label style={s.label}>Vencimiento</label><input type="date" style={s.input} value={venc} onChange={e => setVenc(e.target.value)} onBlur={guardarVenc} /></div>
              <div><label style={s.label}>Fecha de pago</label><input type="date" style={s.input} value={pago.fecha} onChange={e => setPago({ ...pago, fecha: e.target.value })} /></div>
              <div><label style={s.label}>Pagado desde</label><select style={s.input} value={pago.cuenta_id} onChange={e => setPago({ ...pago, cuenta_id: e.target.value })}><option value="">Elegir cuenta…</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.banco}</option>)}</select></div>
              <button style={s.btnPrimario('#15803D')} onClick={registrarPago}>Registrar pago</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>Detalle de la liquidación</h3>
            <div style={{ fontWeight: 700, color: paleta.info, marginTop: 4 }}>Seguridad social</div>
            <Fila etiqueta="301 · Aportes de seguridad social" valor={ars(d.aportes_ss)} />
            <Fila etiqueta="351 · Contribuciones de seguridad social" valor={ars(d.contribuciones_ss)} />
            {Number(d.detraccion) > 0 && <Fila etiqueta="Detracción art. 23 Ley 27.541 (ya descontada)" valor={ars(d.detraccion)} color={paleta.muted} />}
            <div style={{ fontWeight: 700, color: paleta.info, marginTop: 8 }}>Obra social</div>
            <Fila etiqueta="302 · Aportes de obra social" valor={ars(d.aportes_os)} />
            <Fila etiqueta="352 · Contribuciones de obra social" valor={ars(d.contribuciones_os)} />
            <div style={{ fontWeight: 700, color: paleta.info, marginTop: 8 }}>Riesgos y seguros</div>
            <Fila etiqueta="312 · L.R.T. (ART)" valor={ars(d.lrt)} />
            <Fila etiqueta="028 · Seguro colectivo de vida obligatorio" valor={ars(d.scvo)} />
            <div style={{ borderTop: `1px solid ${paleta.lineStrong}`, marginTop: 8, paddingTop: 6 }}><Fila etiqueta="TOTAL A PAGAR" valor={ars(d.total_a_pagar)} fuerte /></div>
            <div style={{ fontSize: 12, color: paleta.muted, marginTop: 6 }}>De este total, {ars(Number(d.aportes_ss) + Number(d.aportes_os))} son aportes retenidos a los empleados y {ars(Number(d.contribuciones_ss) + Number(d.contribuciones_os) + Number(d.lrt) + Number(d.scvo))} son costo a cargo de la empresa.</div>
          </div>
          <div style={card}>
            <h3 style={{ margin: '0 0 8px' }}>Remuneraciones declaradas</h3>
            {[['Rem. 1 (seguridad social)', d.rem1], ['Rem. 2 (asignaciones familiares)', d.rem2], ['Rem. 3 (FNE)', d.rem3], ['Rem. 4 (obra social, topeada)', d.rem4], ['Rem. 5 (INSSJP)', d.rem5], ['Rem. 8 (obra social)', d.rem8], ['Rem. 9 (ART)', d.rem9], ['Rem. 10 (sin topes)', d.rem10]].map(([e, v]) => <Fila key={e} etiqueta={e} valor={ars(v)} />)}
          </div>
        </div>

        {concil && (
          <div style={s.card}>
            <h3 style={{ margin: '0 0 8px' }}>Conciliación con los recibos de {nombrePeriodo(d.periodo)}</h3>
            {concil.n === 0 ? <div style={{ color: paleta.muted }}>No hay recibos cargados para este período.</div> : (<>
              <Fila etiqueta={`Recibos cargados (${concil.n})`} valor={`Remunerativo ${ars(concil.remun)}`} />
              <Fila etiqueta="Remuneración 1 declarada en el F.931" valor={ars(d.rem1)} />
              <Fila etiqueta="Diferencia (licencias pagadas por ANSES u otros no declarados)" valor={ars(concil.remun - Number(d.rem1))} color={Math.abs(concil.remun - Number(d.rem1)) < 1 ? paleta.success : paleta.warn} />
              <Fila etiqueta="Costo del empleador según recibos (contribuciones + ART + seguro)" valor={ars(concil.contrib)} />
              <Fila etiqueta="Costo del empleador según F.931" valor={ars(Number(d.contribuciones_ss) + Number(d.contribuciones_os) + Number(d.lrt) + Number(d.scvo))} />
              <Fila etiqueta="Diferencia" valor={ars(concil.contrib - (Number(d.contribuciones_ss) + Number(d.contribuciones_os) + Number(d.lrt) + Number(d.scvo)))} color={paleta.warn} />
              <div style={{ fontSize: 12, color: paleta.muted, marginTop: 6 }}>Las diferencias son normales: el F.931 aplica bases mínimas y topes, la detracción y excluye los conceptos que paga ANSES (por ejemplo licencia por maternidad). El gasto contable se toma de los recibos y la diferencia final queda visible en la cuenta "Cargas sociales y SUSS a pagar".</div>
            </>)}
          </div>
        )}
      </>)}
    </div>
  )
}
