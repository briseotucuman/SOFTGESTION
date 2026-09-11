import { useState } from 'react'
import { supabase } from './supabase.js'

function Login({ onLogin }) {
  const [modo, setModo] = useState('login') // login | registro | pendiente
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email o contraseña incorrectos'); setLoading(false); return }

    // Verificar si está aprobado
    const { data: usuario } = await supabase.from('usuarios_sistema').select('aprobado, rol').eq('user_id', data.user.id).single()

    // Si no tiene registro en usuarios_sistema es el admin original (primer usuario)
    if (!usuario) { onLogin(data.user); setLoading(false); return }

    if (!usuario.aprobado) {
      await supabase.auth.signOut()
      setModo('pendiente')
      setLoading(false)
      return
    }

    onLogin(data.user)
    setLoading(false)
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
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #e0f2fe, #f0f8ff, #e0f2fe)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI', sans-serif", padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'420px' }}>

        {/* LOGO */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <img src="/logo.jpg" alt="Briseo" style={{ height:'80px', width:'auto', objectFit:'contain' }} />
          <p style={{ color:'#64748b', fontSize:'14px', margin:'8px 0 0' }}>Sistema de Gestión</p>
        </div>

        {/* CARD */}
        <div style={{ background:'#ffffff', borderRadius:'24px', padding:'36px', boxShadow:'0 20px 60px rgba(30,144,255,0.12)', border:'1px solid #bfdbfe' }}>

          {/* PENDIENTE */}
          {modo === 'pendiente' && (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'48px', margin:'0 0 16px' }}>⏳</p>
              <h2 style={{ margin:'0 0 12px', color:'#0f172a', fontWeight:'800' }}>Registro recibido</h2>
              <p style={{ color:'#64748b', fontSize:'14px', lineHeight:'1.6', margin:'0 0 24px' }}>
                Tu cuenta está <strong style={{ color:'#d97706' }}>pendiente de aprobación</strong>. El administrador del sistema revisará tu solicitud y te avisará cuando puedas acceder.
              </p>
              <button onClick={() => setModo('login')} style={{ background:'linear-gradient(135deg, #1e90ff, #0ea5e9)', color:'white', border:'none', borderRadius:'12px', padding:'12px 28px', fontWeight:'700', fontSize:'14px', cursor:'pointer' }}>
                Volver al inicio
              </button>
            </div>
          )}

          {/* LOGIN */}
          {modo === 'login' && (
            <>
              <h2 style={{ margin:'0 0 8px', color:'#0f172a', fontWeight:'800', fontSize:'22px' }}>Bienvenido</h2>
              <p style={{ color:'#64748b', fontSize:'13px', margin:'0 0 28px' }}>Ingresá con tu email y contraseña</p>

              {error && (
                <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', color:'#dc2626', fontSize:'13px', fontWeight:'500' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    style={{ width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #e2e8f0', fontSize:'14px', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor='#1e90ff'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    placeholder="tu@email.com" />
                </div>
                <div style={{ marginBottom:'24px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    style={{ width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #e2e8f0', fontSize:'14px', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor='#1e90ff'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg, #1e90ff, #0ea5e9)', color:'white', border:'none', borderRadius:'12px', fontWeight:'700', fontSize:'15px', cursor:'pointer', boxShadow:'0 4px 14px rgba(30,144,255,0.35)', transition:'opacity 0.2s', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>

              <div style={{ textAlign:'center', marginTop:'20px' }}>
                <p style={{ color:'#64748b', fontSize:'13px', margin:0 }}>
                  ¿No tenés cuenta?{' '}
                  <button onClick={() => { setModo('registro'); setError('') }} style={{ background:'none', border:'none', color:'#1e90ff', fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
                    Registrate
                  </button>
                </p>
              </div>
            </>
          )}

          {/* REGISTRO */}
          {modo === 'registro' && (
            <>
              <h2 style={{ margin:'0 0 8px', color:'#0f172a', fontWeight:'800', fontSize:'22px' }}>Crear cuenta</h2>
              <p style={{ color:'#64748b', fontSize:'13px', margin:'0 0 28px' }}>Tu cuenta será aprobada por el administrador</p>

              {error && (
                <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', color:'#dc2626', fontSize:'13px', fontWeight:'500' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegistro}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Nombre completo</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} required
                    style={{ width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #e2e8f0', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#1e90ff'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    placeholder="Guillermo Semola" />
                </div>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    style={{ width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #e2e8f0', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#1e90ff'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    placeholder="tu@email.com" />
                </div>
                <div style={{ marginBottom:'24px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Contraseña</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    style={{ width:'100%', padding:'12px 14px', borderRadius:'12px', border:'1.5px solid #e2e8f0', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#1e90ff'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                    placeholder="Mínimo 6 caracteres" />
                </div>
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg, #1e90ff, #0ea5e9)', color:'white', border:'none', borderRadius:'12px', fontWeight:'700', fontSize:'15px', cursor:'pointer', boxShadow:'0 4px 14px rgba(30,144,255,0.35)', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Registrando...' : 'Solicitar acceso'}
                </button>
              </form>

              <div style={{ textAlign:'center', marginTop:'20px' }}>
                <button onClick={() => { setModo('login'); setError('') }} style={{ background:'none', border:'none', color:'#1e90ff', fontWeight:'700', cursor:'pointer', fontSize:'13px' }}>
                  Volver al login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
