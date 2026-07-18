import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/atomos/Card';
import Input from '../components/atomos/Input';
import Button from '../components/atomos/Button';
import AlertBanner from '../components/moleculas/AlertBanner';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await login(usuario, contraseña);
      navigate('/dashboard');
    } catch {
      // el error ya se refleja en el contexto
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold text-gray-900">KPI ETL Dashboard</h1>
        <p className="mb-6 text-sm text-gray-500">Inversiones Catelli</p>

        {error && <div className="mb-4"><AlertBanner tipo="error" mensaje={error} /></div>}

        <form className="flex flex-col gap-4" onSubmit={manejarSubmit}>
          <Input
            label="Usuario"
            name="usuario"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            name="contraseña"
            type="password"
            autoComplete="current-password"
            value={contraseña}
            onChange={(e) => setContraseña(e.target.value)}
            required
          />
          <Button type="submit" disabled={isLoading} className="mt-2 w-full">
            {isLoading ? 'Ingresando...' : 'Iniciar sesion'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
