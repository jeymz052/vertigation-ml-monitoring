import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const CREDENTIALS = {
  admin: {
    user: import.meta.env.VITE_ADMIN_USER || 'admin',
    pass: import.meta.env.VITE_ADMIN_PASS || 'vertigation2026',
  },
  farmer: {
    user: import.meta.env.VITE_FARMER_USER || 'farmer',
    pass: import.meta.env.VITE_FARMER_PASS || 'farmer2026',
  },
}

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('vml_auth') === 'true')
  const [role, setRole] = useState(() => sessionStorage.getItem('vml_role') || 'admin')
  const [error, setError]   = useState('')

  const login = (user, pass) => {
    for (const [roleKey, creds] of Object.entries(CREDENTIALS)) {
      if (user === creds.user && pass === creds.pass) {
        sessionStorage.setItem('vml_auth', 'true')
        sessionStorage.setItem('vml_role', roleKey)
        setAuthed(true)
        setRole(roleKey)
        setError('')
        return { ok: true, role: roleKey }
      }
    }

    setError('Invalid username or password.')
    return { ok: false, role: null }
  }

  const logout = () => {
    sessionStorage.removeItem('vml_auth')
    sessionStorage.removeItem('vml_role')
    setAuthed(false)
    setRole('admin')
  }

  return <AuthContext.Provider value={{ authed, role, login, logout, error }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
