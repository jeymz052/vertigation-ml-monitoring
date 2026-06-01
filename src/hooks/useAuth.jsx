import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const VALID_USER = import.meta.env.VITE_LOGIN_USER || 'admin'
const VALID_PASS = import.meta.env.VITE_LOGIN_PASS || 'vertigation2024'

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('vml_auth') === 'true')
  const [error, setError]   = useState('')

  const login = (user, pass) => {
    if (user === VALID_USER && pass === VALID_PASS) {
      sessionStorage.setItem('vml_auth', 'true')
      setAuthed(true)
      setError('')
      return true
    }
    setError('Invalid username or password.')
    return false
  }

  const logout = () => {
    sessionStorage.removeItem('vml_auth')
    setAuthed(false)
  }

  return (
    <AuthContext.Provider value={{ authed, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
