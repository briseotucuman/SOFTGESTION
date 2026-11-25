import { paleta } from './estilos.js'

// Módulo con solapas: barra de pestañas en píldora estilo Bento/Glass
export default function ModuloTabs({ titulo, tabs, activa, onCambiar, children }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
          position: 'sticky',
          top: -8,
          zIndex: 5,
          padding: '8px 0',
          background: 'linear-gradient(rgba(243,245,250,0.92) 70%, rgba(243,245,250,0))',
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: paleta.muted,
          }}
        >
          {titulo}
        </span>
        <div
          className="sg-scroll-x"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 999,
            overflowX: 'auto',
            maxWidth: '100%',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid #E5E7EB',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 8px 24px -12px rgba(24,25,28,0.12)',
          }}
        >
          {tabs.map(([id, label, Icon]) => {
            const on = id === activa
            return (
              <button
                key={id}
                onClick={() => onCambiar(id)}
                style={{
                  border: 0,
                  cursor: 'pointer',
                  borderRadius: 999,
                  padding: '8px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: on ? '#18191C' : 'transparent',
                  color: on ? '#fff' : paleta.inkSoft,
                }}
              >
                {Icon && <Icon size={14} />}
                {label}
              </button>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
