// ============================================================
// Sistema de diseño — SOFTGESTION ENTERPRISE ERP (Briseo)
// Estética: Enterprise ERP de alta densidad (SAP / Stripe / Linear).
// Tipografía suiza/monospaciada, bordes quirúrgicos de 1px,
// paleta Slate neutral con acentos cromáticos por dominio operativo.
// ============================================================

export const paleta = {
  ink: '#0F172A',          // Slate 900 - texto principal y contrastes altos
  inkSoft: '#334155',      // Slate 700 - texto de datos y etiquetas
  muted: '#64748B',        // Slate 500 - metadatos, timestamps y placeholders
  paper: '#F8FAFC',        // Slate 50 - fondo general del ERP
  surface: '#FFFFFF',      // Blanco puro - tarjetas, tablas y modales
  surfaceMuted: '#F1F5F9', // Slate 100 - fondos de inputs, hover y zebra
  line: '#E2E8F0',         // Slate 200 - divisores y bordes sutiles
  lineStrong: '#CBD5E1',   // Slate 300 - bordes de inputs y botones
  brand: '#0F766E',        // Teal 700 - color institucional primario
  brandDark: '#115E59',    // Teal 800 - estado activo / hover
  brandSoft: '#F0FDFA',    // Teal 50 - fondos tenues de marca
  warn: '#B45309',         // Amber 700
  warnSoft: '#FEF3C7',     // Amber 100
  danger: '#BE123C',       // Rose 700
  dangerSoft: '#FFE4E6',   // Rose 100
  info: '#0369A1',         // Sky 700
  infoSoft: '#E0F2FE',     // Sky 100
  success: '#15803D',      // Emerald 700
  successSoft: '#DCFCE7',  // Emerald 100
  font: "'IBM Plex Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono: "'IBM Plex Mono', 'Geist Mono', ui-monospace, SFMono-Regular, monospace",
}

// Acento por módulo funcional: mantiene consistencia con la arquitectura de permisos
export const colores = {
  clientes:     { main: '#0F766E', light: '#0F766E15', gradient: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)' },
  crm:          { main: '#2563EB', light: '#2563EB15', gradient: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' },
  contratos:    { main: '#475569', light: '#47556915', gradient: 'linear-gradient(135deg, #334155 0%, #1E293B 100%)' },
  personal:     { main: '#15803D', light: '#15803D15', gradient: 'linear-gradient(135deg, #15803D 0%, #166534 100%)' },
  agenda:       { main: '#D97706', light: '#D9770615', gradient: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)' },
  presupuestos: { main: '#0284C7', light: '#0284C715', gradient: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)' },
  facturacion:  { main: '#E11D48', light: '#E11D4815', gradient: 'linear-gradient(135deg, #BE123C 0%, #9F1239 100%)' },
  insumos:      { main: '#6366F1', light: '#6366F115', gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' },
  finanzas:     { main: '#059669', light: '#05966915', gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
  costos:       { main: '#0D9488', light: '#0D948815', gradient: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)' },
  sueldos:      { main: '#7C3AED', light: '#7C3AED15', gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' },
  proveedores:  { main: '#C2410C', light: '#C2410C15', gradient: 'linear-gradient(135deg, #C2410C 0%, #9A3412 100%)' },
  reportes:     { main: '#1E293B', light: '#1E293B15', gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' },
  usuarios:     { main: '#4B5563', light: '#4B556315', gradient: 'linear-gradient(135deg, #4B5563 0%, #374151 100%)' },
  danger:       { main: '#BE123C', light: '#FFE4E6', gradient: '#BE123C' },
  warning:      { main: '#B45309', light: '#FEF3C7', gradient: '#B45309' },
  info:         { main: '#0369A1', light: '#E0F2FE', gradient: '#0369A1' },
}

export const s = {
  cabecera: (fondo) => ({
    background: fondo,
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)'
  }),
  cabeceraTexto: {
    color: '#FFFFFF',
    margin: 0,
    fontSize: '17px',
    fontWeight: '700',
    letterSpacing: '-0.015em',
    lineHeight: '1.2'
  },
  cabeceraSubtexto: {
    color: 'rgba(255, 255, 255, 0.82)',
    margin: '4px 0 0',
    fontSize: '12.5px',
    fontWeight: '400'
  },

  btnPrimario: (color) => ({
    background: color || paleta.brand,
    color: '#FFFFFF',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '6px',
    padding: '8px 16px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
  }),
  btnSecundario: {
    background: '#FFFFFF',
    color: paleta.inkSoft,
    border: `1px solid ${paleta.lineStrong}`,
    borderRadius: '6px',
    padding: '8px 15px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)'
  },
  btnPeligro: {
    background: '#FFF1F2',
    color: paleta.danger,
    border: '1px solid #FECDD3',
    borderRadius: '6px',
    padding: '5px 11px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },

  card: {
    background: paleta.surface,
    borderRadius: '10px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
    border: `1px solid ${paleta.line}`
  },
  label: {
    display: 'block',
    color: paleta.inkSoft,
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '5px',
    letterSpacing: '-0.01em'
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    boxSizing: 'border-box',
    background: paleta.surface,
    border: `1px solid ${paleta.lineStrong}`,
    borderRadius: '6px',
    color: paleta.ink,
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: paleta.font
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px'
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px'
  },

  tabla: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums'
  },
  tablaCabecera: (color) => ({
    background: color || '#1E293B',
    color: '#FFFFFF',
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '11.5px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${paleta.line}`
  }),
  tablaFila: (i) => ({
    background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
    transition: 'background 0.12s ease'
  }),
  tablaCell: {
    padding: '11px 14px',
    color: paleta.inkSoft,
    borderBottom: `1px solid ${paleta.line}`,
    fontSize: '13px'
  },
  tablaCellBold: {
    padding: '11px 14px',
    color: paleta.ink,
    fontWeight: '600',
    borderBottom: `1px solid ${paleta.line}`,
    fontSize: '13px'
  },

  badge: (bg, color) => ({
    background: bg || paleta.surfaceMuted,
    color: color || paleta.inkSoft,
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    letterSpacing: '0.01em'
  }),

  buscador: {
    width: '100%',
    maxWidth: '340px',
    padding: '8px 13px',
    background: paleta.surface,
    border: `1px solid ${paleta.lineStrong}`,
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    color: paleta.ink,
    fontFamily: paleta.font,
    transition: 'border-color 0.15s, box-shadow 0.15s'
  },

  empty: {
    padding: '56px 20px',
    textAlign: 'center',
    color: paleta.muted,
    fontSize: '13.5px'
  }
}

