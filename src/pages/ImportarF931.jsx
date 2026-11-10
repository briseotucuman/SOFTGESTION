import { useState } from 'react'
import { supabase } from '../supabase.js'
import { s, paleta } from '../estilos.js'
import { extraerPaginas } from '../importarPdf.js'
import { parsearF931 } from '../parsersPdf.js'
import { Upload, X } from 'lucide-react'

const ars = n => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

// Sube el PDF de la declaración jurada F.931, lo lee, muestra una vista previa y la guarda
export default function ImportarF931({ onListo, onCerrar }) {
  const [d, setD] = useState(null)
  const [existente, setExistente] = useState(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')

  const leer = async e => {
    const f = e.target.files?.[0]; if (!f) return
    setError(''); setD(null); setEstado('Leyendo el PDF…')
    try {
      const x = parsearF931(await extraerPaginas(f))
      if (!x.periodo || !x.total_a_pagar) throw new Error('No parece un formulario F.931: ' + x.avisos.join(' '))
      const { data } = await supabase.from('declaraciones_931').select('id, estado').eq('periodo', x.periodo).eq('rectificativa', x.rectificativa).maybeSingle()
      setExistente(data || null); setD(x); setEstado('')
    } catch (err) { setError(err.message || String(err)); setEstado('') }
  }

  const guardar = async () => {
    setError('')
    const { avisos, ...fila } = d
    delete fila.renatre; delete fila.vales; delete fila.sepelio
    fila.observaciones = 'Importado desde PDF'
    const { error: e } = existente
      ? await supabase.from('declaraciones_931').update(fila).eq('id', existente.id)
      : await supabase.from('declaraciones_931').insert([fila])
    if (e) return setError(e.message + (/schema cache|declaraciones_931/i.test(e.message) ? ' — ¿Ejecutaste sueldos_f931_softgestion.sql en Supabase?' : ''))
    onListo()
  }

  const Fila = ({ a, b }) => <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span>{a}</span><span style={{ fontFamily: paleta.fontMono }}>{b}</span></div>
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ ...s.card, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Importar F.931 (PDF)</h3>
          <button style={s.btnSecundario} onClick={onCerrar}><X size={14} /></button>
        </div>
        <label style={{ ...s.btnPrimario('#1e40af'), display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <Upload size={14} /> Elegir PDF del F.931
          <input type="file" accept="application/pdf" onChange={leer} style={{ display: 'none' }} />
        </label>
        {estado && <p style={{ color: paleta.muted }}>{estado}</p>}
        {error && <p style={{ color: paleta.danger }}>{error}</p>}
        {d && (<div style={{ marginTop: 12 }}>
          <Fila a="Período" b={d.periodo} /><Fila a="CUIT" b={d.cuit} /><Fila a="Empleados" b={d.empleados} />
          <Fila a="301 Aportes seg. social" b={ars(d.aportes_ss)} /><Fila a="302 Aportes obra social" b={ars(d.aportes_os)} />
          <Fila a="351 Contribuciones seg. social" b={ars(d.contribuciones_ss)} /><Fila a="352 Contribuciones obra social" b={ars(d.contribuciones_os)} />
          <Fila a="312 L.R.T." b={ars(d.lrt)} /><Fila a="028 Seguro de vida" b={ars(d.scvo)} />
          <div style={{ borderTop: `1px solid ${paleta.lineStrong}`, marginTop: 6, paddingTop: 6, fontWeight: 800 }}><Fila a="TOTAL A PAGAR" b={ars(d.total_a_pagar)} /></div>
          {existente && <p style={{ color: paleta.warn, fontSize: 13 }}>{existente.estado === 'pagada' ? 'Este período ya figura PAGADO: no se puede reemplazar.' : 'Este período ya está cargado: se va a reemplazar.'}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button style={s.btnSecundario} onClick={onCerrar}>Cancelar</button>
            <button style={s.btnPrimario('#15803D')} disabled={existente?.estado === 'pagada'} onClick={guardar}>{existente ? 'Reemplazar' : 'Guardar F.931'}</button>
          </div>
        </div>)}
      </div>
    </div>
  )
}
