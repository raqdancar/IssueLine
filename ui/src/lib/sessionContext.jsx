import { createContext, useContext } from 'react'

export const SessionContext = createContext({
  session: null,
  isAuthenticated: false,
})

export const SessionProvider = ({ value, children }) => (
  <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
)

export const useSessionContext = () => useContext(SessionContext)
