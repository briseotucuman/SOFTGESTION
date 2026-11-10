import { paleta } from './estilos.js'

// Módulo con solapas (Comercial, Operaciones, Administración): una barra de pestañas y el contenido de la activa
export default function ModuloTabs({ titulo, tabs, activa, onCambiar, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16, position: 'sticky', top: -12, zIndex: 5, padding: '8px 0', background: 'linear-gradient(#EEF4FFF2 70%, #EEF4FF00)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: paleta.muted }}>{titulo}</span>
        <div className="sg-scroll-x" style={{
          display: 'flex', gap: 4, padding: 4, borderRadius: 999, overflowX: 'auto', maxWidth: '100%',
          background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 8px 20px -12px rgba(37,99,235,0.35)'
        }}>
          {tabs.map(([id, label, Icon]) => {
            const on = id === activa
            return (
              <button key={id} onClick={() => onCambiar(id)} style={{
                border: 0, cursor: 'pointer', borderRadius: 999, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', background: on ? '#0F172A' : 'transparent', color: on ? '#fff' : paleta.inkSoft
              }}>
                {Icon && <Icon size={14} />}{label}
              </button>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
