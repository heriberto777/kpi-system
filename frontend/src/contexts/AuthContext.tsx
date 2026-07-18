import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { authApi } from '../api/auth.api';
import { obtenerToken } from '../api/client';

interface AuthContextType {
  isAuthenticated: boolean;
  usuario: string | null;
  isLoading: boolean;
  error: string | null;
  login: (usuario: string, contraseña: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(obtenerToken()));
  const [usuario, setUsuario] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (usuarioInput: string, contraseña: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.login(usuarioInput, contraseña);
      setUsuario(usuarioInput);
      setIsAuthenticated(true);
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'No se pudo iniciar sesion';
      setError(mensaje);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setIsAuthenticated(false);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, usuario, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
}
