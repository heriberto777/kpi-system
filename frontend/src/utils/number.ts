/**
 * Convierte de forma segura valores numericos que pueden llegar como string desde la API
 * (p.ej. columnas NUMERIC/BIGINT de PostgreSQL) o como null/undefined.
 */
export function numero(value: number | string | null | undefined, porDefecto = 0): number {
  if (value === null || value === undefined) return porDefecto;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : porDefecto;
}

const FORMATO_MONEDA = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
  maximumFractionDigits: 0,
});

export function formatearMoneda(value: number | string | null | undefined): string {
  return FORMATO_MONEDA.format(numero(value));
}
