import { categoriaClienteARetail, limpiarStgCliente, limpiarStgVendedor, normalizarCluster } from './transformers';

describe('categoriaClienteARetail', () => {
  it('mapea categorias de colmado, incluyendo A3 (MINIMARKET, igual que el cubo oficial de ventas)', () => {
    expect(categoriaClienteARetail('A1')).toBe('COLMADO');
    expect(categoriaClienteARetail('A2')).toBe('COLMADO');
    expect(categoriaClienteARetail('A3')).toBe('COLMADO');
  });

  it('mapea categorias de autoservicio, incluyendo SM (Supermercados Especiales)', () => {
    expect(categoriaClienteARetail('C1')).toBe('AUTOSERVICIO');
    expect(categoriaClienteARetail('SM')).toBe('AUTOSERVICIO');
  });

  it('mapea categorias de mayorista', () => {
    expect(categoriaClienteARetail('SUR')).toBe('MAYORISTA');
    expect(categoriaClienteARetail('Q1')).toBe('MAYORISTA');
  });

  it('devuelve OTROS para categorias no mapeadas', () => {
    expect(categoriaClienteARetail('B1')).toBe('OTROS'); // FARMACIA
    expect(categoriaClienteARetail('')).toBe('OTROS');
  });
});

describe('normalizarCluster', () => {
  it('acepta clusters validos', () => {
    expect(normalizarCluster('GOLD')).toBe('GOLD');
    expect(normalizarCluster('silver')).toBe('SILVER');
  });

  it('usa BRONZE por defecto si es invalido o vacio', () => {
    expect(normalizarCluster(undefined)).toBe('BRONZE');
    expect(normalizarCluster('DIAMOND')).toBe('BRONZE');
  });
});

describe('limpiarStgCliente', () => {
  it('normaliza campos vacios con valores por defecto', () => {
    const result = limpiarStgCliente({ codigo_cliente: '  123  ' });
    expect(result.codigo_cliente).toBe('123');
    expect(result.nombre_cliente).toBe('SIN NOMBRE');
    expect(result.estado).toBe('Activo');
    expect(result.u_cluster).toBe('BRONZE');
    expect(result.cat_cliente_esp).toBeNull();
  });
});

describe('limpiarStgVendedor', () => {
  it('normaliza cantidad_cliente y retail_asignado', () => {
    const result = limpiarStgVendedor({
      codigo_vendedor: ' 17 ',
      cantidad_cliente: 25,
      retail_asignado: 'autoservicio',
    });
    expect(result.codigo_vendedor).toBe('17');
    expect(result.cantidad_cliente).toBe(25);
    expect(result.retail_asignado).toBe('AUTOSERVICIO');
  });

  it('usa null para campos opcionales vacios y 0 para cantidad_cliente faltante', () => {
    const result = limpiarStgVendedor({ codigo_vendedor: 'V1' });
    expect(result.nombre_vendedor).toBeNull();
    expect(result.retail_asignado).toBeNull();
    expect(result.cantidad_cliente).toBe(0);
  });
});
