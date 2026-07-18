import { apiClient, eliminarToken, guardarToken } from './client';

interface LoginResponse {
  token: string;
  expira_en: number;
}

export const authApi = {
  async login(usuario: string, contraseña: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { usuario, contraseña });
    guardarToken(data.token);
    return data;
  },

  logout(): void {
    eliminarToken();
  },

  renovarToken(): void {
    // La renovacion automatica no esta implementada en el backend actual;
    // el usuario debe volver a iniciar sesion cuando el token expire.
  },
};
