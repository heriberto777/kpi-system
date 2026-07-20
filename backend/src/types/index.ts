export * from './cliente.types';
export * from './etl.types';
export * from './kpi.types';
export * from './config.types';
export * from './surtidoMandatorio.types';

export interface JwtPayload {
  sub: string;
  usuario: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequestUser {
  usuario: string;
}
