// ============================================================
// Sistema de diseño — SOFTGESTION (Briseo)
// Identidad: herramienta operativa de precisión. Sin gradientes
// candy, sin mayúsculas por defecto, un color de marca sólido
// (verde profundo) y acentos por módulo para orientación rápida.
// ============================================================

export const paleta = {
  ink: '#16211D',       // texto principal / superficies oscuras
  inkSoft: '#3C4A44',   // texto secundario oscuro
  muted: '#5B685F',     // texto terciario / placeholders
  paper: '#F3F5F1',     // fondo de la app
  surface: '#FFFFFF',   // tarjetas
  line: '#E1E4DE',      // bordes
  lineStrong: '#C7CCC4',
  brand: '#1F6F5C',     // marca / acciones primarias
  brandDark: '#164F42', // hover / variante oscura
  brandSoft: '#E3EFEA', // fondo tintado de marca
  warn: '#A8631E',
  warnSoft: '#F7EADA',
  danger: '#AC3B2A',
  dangerSoft: '#FBEAE7',
  info: '#3D5A73',
  infoSoft: '#E7EEF3',
  font: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
}

// Acento por módulo: usado en encabezados, headers de tabla,
// bordes activos y badges — nunca como fondo de página completa.
export const colores = {
  clientes:     { main: '#1F6F5C', light: '#1F6F5C1A', gradient: 'linear-gradient(155deg, #1F6F5C, #164F42)' },
  contratos:    { main: '#3D5A80', light: '#3D5A801A', gradient: 'linear-gradient(155deg, #3D5A80, #2C4260)' },
  personal:     { main: '#4C7A3F', light: '#4C7A3F1A', gradient: 'linear-gradient(155deg, #4C7A3F, #395C2E)' },
  agenda:       { main: '#B5701D', light: '#B5701D1A', gradient: 'linear-gradient(155deg, #B5701D, #8C5716)' },
  presupuestos: { main: '#2E7C8C', light: '#2E7C8C1A', gradient: 'linear-gradient(155deg, #2E7C8C, #235F6B)' },
  facturacion:  { main: '#A8412E', light: '#A8412E1A', gradient: 'linear-gradient(155deg, #A8412E, #7E3022)' },
  insumos:      { main: '#5C6BB0', light: '#5C6BB01A', gradient: 'linear-gradient(155deg, #5C6BB0, #454F87)' },
  finanzas:     { main: '#2F8F6B', light: '#2F8F6B1A', gradient: 'linear-gradient(155deg, #2F8F6B, #226B4F)' },
  costos:       { main: '#146B5E', light: '#146B5E1A', gradient: 'linear-gradient(155deg, #146B5E, #0E4E44)' },
  sueldos:      { main: '#7A5AA6', light: '#7A5AA61A', gradient: 'linear-gradient(155deg, #7A5AA6, #5C4380)' },
  proveedores:  { main: '#9C6B1D', light: '#9C6B1D1A', gradient: 'linear-gradient(155deg, #9C6B1D, #785316)' },
  reportes:     { main: '#8C4B5E', light: '#8C4B5E1A', gradient: 'linear-gradient(155deg, #8C4B5E, #6B3948)' },
  usuarios:     { main: '#46707D', light: '#46707D1A', gradient: 'linear-gradient(155deg, #46707D, #35555F)' },
  danger: { main: '#AC3B2A', light: '#FBEAE7', gradient: '#AC3B2A' },
  warning:{ main: '#A8631E', light: '#F7EADA', gradient: '#A8631E' },
  info:   { main: '#3D5A73', light: '#E7EEF3', gradient: '#3D5A73' },
}

export const s = {
  cabecera: (fondo) => ({
    background: fondo,
    borderRadius: '12px',
    padding: '18px 22px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 2px rgba(22,33,29,0.08)'
  }),
  cabeceraTexto: {
    color: '#ffffff',
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.01em'
  },
  cabeceraSubtexto: {
    color: 'rgba(255,255,255,0.78)',
    margin: '3px 0 0',
    fontSize: '13px'
  },

  btnPrimario: (color) => ({
    background: color,
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'filter 0.15s',
    whiteSpace: 'nowrap'
  }),
  btnSecundario: {
    background: '#ffffff',
    color: '#3C4A44',
    border: '1.5px solid #E1E4DE',
    borderRadius: '8px',
    padding: '10px 18px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.15s'
  },
  btnPeligro: {
    background: '#FBEAE7',
    color: '#AC3B2A',
    border: '1px solid #AC3B2A33',
    borderRadius: '8px',
    padding: '6px 12px',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer'
  },

  card: {
    background: '#FFFFFF',
    borderRadius: '12px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow: '0 1px 2px rgba(22,33,29,0.06)',
    border: '1px solid #E1E4DE'
  },
  label: {
    display: 'block',
    color: '#3C4A44',
    fontSize: '12.5px',
    fontWeight: '600',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 13px',
    boxSizing: 'border-box',
    background: '#F3F5F1',
    border: '1.5px solid #E1E4DE',
    borderRadius: '8px',
    color: '#16211D',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif"
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px'
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '14px'
  },

  tabla: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0',
    fontSize: '13px'
  },
  tablaCabecera: (color) => ({
    background: color,
    color: '#ffffff',
    padding: '11px 15px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '12px'
  }),
  tablaFila: (i) => ({
    background: i % 2 === 0 ? '#FFFFFF' : '#F3F5F1',
    transition: 'background 0.15s'
  }),
  tablaCell: {
    padding: '12px 15px',
    color: '#3C4A44',
    borderBottom: '1px solid #E1E4DE'
  },
  tablaCellBold: {
    padding: '12px 15px',
    color: '#16211D',
    fontWeight: '600',
    borderBottom: '1px solid #E1E4DE'
  },

  badge: (bg, color) => ({
    background: bg,
    color: color,
    padding: '3px 10px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: '600',
    display: 'inline-block'
  }),

  buscador: {
    width: '100%',
    maxWidth: '320px',
    padding: '9px 14px',
    background: '#FFFFFF',
    border: '1.5px solid #E1E4DE',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    color: '#16211D',
    fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif"
  },

  empty: {
    padding: '48px',
    textAlign: 'center',
    color: '#5B685F',
    fontSize: '14px'
  }
}
