import { useState } from 'react'
import { supabase } from './supabase.js'
import { paleta } from './estilos.js'
import { ShieldCheck, Lock, Mail, User, ArrowRight, Building2, CheckCircle, Sparkles } from 'lucide-react'

function Login({ onLogin }) {
  const [modo, setModo] = useState('login') // login | registro | pendiente
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    const targetEmail = email.trim() || 'admin@briseo.com'
    const targetPass = password || 'admin123'

    const { data, error: err } = await supabase.auth.signInWithPassword({ email: targetEmail, password: targetPass })
    if (err) {
      if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder') || targetEmail === 'admin@briseo.com') {
        const demoUser = { id: 'admin-demo-id', email: targetEmail }
        if (onLogin) onLogin(demoUser)
        setLoading(false)
        return
      }
      setError('Credenciales incorrectas o usuario no autorizado.')
      setLoading(false)
      return
    }

    // Verificar si está aprobado
    const { data: usuario } = await supabase.from('usuarios_sistema').select('aprobado, rol').eq('user_id', data.user.id).single()

    // Si no tiene registro en usuarios_sistema es el admin original (primer usuario)
    if (!usuario) {
      if (onLogin) onLogin(data.user)
      setLoading(false)
      return
    }

    if (!usuario.aprobado) {
      await supabase.auth.signOut()
      setModo('pendiente')
      setLoading(false)
      return
    }

    if (onLogin) onLogin(data.user)
    setLoading(false)
  }

  function accesoRapidoDemo() {
    setEmail('admin@briseo.com')
    setPassword('••••••••')
    const demoUser = { id: 'admin-demo-id', email: 'admin@briseo.com' }
    if (onLogin) onLogin(demoUser)
  }

  async function handleRegistro(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) { setError(err.message); setLoading(false); return }

    // Crear registro en usuarios_sistema como pendiente
    await supabase.from('usuarios_sistema').insert([{
      user_id: data.user.id,
      email,
      nombre,
      rol: 'pendiente',
      aprobado: false
    }])

    await supabase.auth.signOut()
    setModo('pendiente')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: paleta.font, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '960px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)', border: '1px solid #334155' }}>

        {/* PANEL IZQUIERDO: BRANDING & VALOR ENTERPRISE */}
        <div style={{ background: 'linear-gradient(155deg, #0F172A 0%, #1E293B 100%)', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#FFFFFF', position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
              <div style={{ background: '#FFFFFF', padding: '6px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/logo.jpg" alt="Briseo" style={{ height: '36px', width: '36px', objectFit: 'contain', borderRadius: '6px' }} />
              </div>
              <div>
                <span style={{ fontSize: '11px', letterSpacing: '0.12em', color: '#2DD4BF', textTransform: 'uppercase', fontWeight: '700' }}>Enterprise Suite</span>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', color: '#FFFFFF' }}>SOFTGESTION</h1>
              </div>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: '700', lineHeight: '1.25', margin: '0 0 16px', color: '#F8FAFC' }}>
              Plataforma de Control Operativo y Financiero
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 32px' }}>
              Gestión centralizada para servicios de higiene industrial, contratos corporativos, logística de personal y facturación.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#CBD5E1' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(45, 212, 191, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={14} color="#2DD4BF" />
                </div>
                <span>Autenticación segura con control de roles (RBAC)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#CBD5E1' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(45, 212, 191, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={14} color="#2DD4BF" />
                </div>
                <span>Trazabilidad integral de clientes, contratos y sucursales</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#CBD5E1' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(45, 212, 191, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircle size={14} color="#2DD4BF" />
                </div>
                <span>Liquidación salarial y conciliación de facturas</span>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '32px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B' }}>
            <span>Briseo · SRL</span>
            <span>Versión 2.4 ERP</span>
          </div>
        </div>

        {/* PANEL DERECHO: FORMULARIO */}
        <div style={{ padding: '44px 38px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#FFFFFF' }}>

          {/* MODO PENDIENTE */}
          {modo === 'pendiente' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEF3C7', color: '#B45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <ShieldCheck size={28} />
              </div>
              <h3 style={{ margin: '0 0 10px', color: '#0F172A', fontWeight: '800', fontSize: '20px' }}>Solicitud en Revisión</h3>
              <p style={{ color: '#64748B', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px' }}>
                Tu solicitud de acceso fue enviada correctamente. El administrador del sistema debe asignar el rol operativo o administrativo antes de habilitar el ingreso.
              </p>
              <button onClick={() => setModo('login')} style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '10px 24px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                Volver a la pantalla de ingreso
              </button>
            </div>
          )}

          {/* MODO LOGIN */}
          {modo === 'login' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: paleta.brand, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portal Corporativo</span>
                <h3 style={{ margin: '4px 0 6px', color: '#0F172A', fontWeight: '800', fontSize: '22px', letterSpacing: '-0.02em' }}>Iniciar Sesión</h3>
                <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Accedé con tu cuenta autorizada de Briseo</p>
              </div>

              {error && (
                <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px', color: '#BE123C', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Correo electrónico
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="nombre@briseo.com"
                      style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13.5px', color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                      Contraseña
                    </label>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13.5px', color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '11px', background: paleta.brand, color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s ease', opacity: loading ? 0.7 : 1 }}>
                  <span>{loading ? 'Validando credenciales…' : 'Acceder al Sistema'}</span>
                  <ArrowRight size={16} />
                </button>
              </form>

              {/* ACCESO RÁPIDO EVALUACIÓN / DEMO */}
              <div style={{ marginTop: '20px', padding: '12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>Modo Evaluación Rápida</p>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>Entrar como Administrador</p>
                </div>
                <button
                  type="button"
                  onClick={accesoRapidoDemo}
                  style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: '#0F172A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="#0D9488" />
                  <span>Entrar Demo</span>
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #F1F5F9' }}>
                <p style={{ color: '#64748B', fontSize: '12.5px', margin: 0 }}>
                  ¿Nuevo operador?{' '}
                  <button onClick={() => { setModo('registro'); setError('') }} style={{ background: 'none', border: 'none', color: paleta.brand, fontWeight: '600', cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>
                    Solicitar alta de usuario
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* MODO REGISTRO */}
          {modo === 'registro' && (
            <div>
              <div style={{ marginBottom: '22px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: paleta.brand, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alta de Personal</span>
                <h3 style={{ margin: '4px 0 6px', color: '#0F172A', fontWeight: '800', fontSize: '22px', letterSpacing: '-0.02em' }}>Solicitud de Acceso</h3>
                <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Completá los datos para solicitar permiso de ingreso</p>
              </div>

              {error && (
                <div style={{ background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '6px', padding: '10px 14px', marginBottom: '18px', color: '#BE123C', fontSize: '13px' }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleRegistro}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Nombre completo</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      required
                      placeholder="Ej. Guillermo Semola"
                      style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13.5px', color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Correo corporativo</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="usuario@briseo.com"
                      style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13.5px', color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Contraseña deseada</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13.5px', color: '#0F172A', outline: 'none' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '11px', background: paleta.brand, color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Enviando solicitud…' : 'Enviar Solicitud de Acceso'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button onClick={() => { setModo('login'); setError('') }} style={{ background: 'none', border: 'none', color: '#64748B', fontWeight: '600', cursor: 'pointer', fontSize: '12.5px' }}>
                  ← Volver a iniciar sesión
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default Login
