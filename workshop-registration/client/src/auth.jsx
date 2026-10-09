import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions([]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me')
      .then((r) => { setUser(r.user); setPermissions(r.permissions); })
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', r.token);
    setUser(r.user);
    setPermissions(r.permissions);
    return r.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, can: (p) => permissions.includes(p) }),
    [user, loading, login, logout, permissions]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
