import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import SolicitudInsumos from './SolicitudInsumos.jsx'

function AppPrivada() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then((res) => {
        setSession(res?.data?.session || null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      authListener?.subscription?.unsubscribe?.()
    }
  }, [])

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#16211D',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', fontWeight: 500 }}>Cargando…</p>
    </div>
  )

  if (!session) return <Login onLogin={(user) => setSession({ user })} />

  return <Dashboard user={session.user} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/solicitud-insumos" element={<SolicitudInsumos />} />
        <Route path="*" element={<AppPrivada />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

