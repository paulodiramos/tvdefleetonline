/**
 * Utilitários para cálculo de IVA (Portugal)
 * Taxa padrão: 23% (configurável)
 */

export const IVA_RATE_DEFAULT = 0.23; // 23% IVA em Portugal

/**
 * Calcular valor sem IVA a partir do valor com IVA
 * @param {number} valorComIva - Valor com IVA incluído
 * @param {number} taxaIva - Taxa de IVA (default: 23%)
 * @returns {number} - Valor sem IVA
 */
export const calcularSemIva = (valorComIva, taxaIva = 23) => {
  if (!valorComIva || valorComIva <= 0) return 0;
  const taxa = taxaIva / 100;
  return valorComIva / (1 + taxa);
};

/**
 * Calcular valor com IVA a partir do valor sem IVA
 * @param {number} valorSemIva - Valor sem IVA
 * @param {number} taxaIva - Taxa de IVA (default: 23%)
 * @returns {number} - Valor com IVA incluído
 */
export const calcularComIva = (valorSemIva, taxaIva = 23) => {
  if (!valorSemIva || valorSemIva <= 0) return 0;
  const taxa = taxaIva / 100;
  return valorSemIva * (1 + taxa);
};

/**
 * Calcular apenas o valor do IVA
 * @param {number} valorSemIva - Valor sem IVA
 * @param {number} taxaIva - Taxa de IVA (default: 23%)
 * @returns {number} - Valor do IVA
 */
export const calcularValorIva = (valorSemIva, taxaIva = 23) => {
  if (!valorSemIva || valorSemIva <= 0) return 0;
  const taxa = taxaIva / 100;
  return valorSemIva * taxa;
};

/**
 * Formatar valor em euros
 * @param {number} valor - Valor a formatar
 * @param {number} decimais - Número de casas decimais (default: 2)
 * @returns {string} - Valor formatado
 */
export const formatarEuros = (valor, decimais = 2) => {
  if (!valor && valor !== 0) return '0.00';
  return valor.toFixed(decimais);
};

/**
 * Componente para exibir preço com e sem IVA
 * @param {number} valorComIva - Valor com IVA incluído
 * @param {number} taxaIva - Taxa de IVA (default: 23%)
 */
export const formatarPrecoCompleto = (valorComIva, taxaIva = 23) => {
  const semIva = calcularSemIva(valorComIva, taxaIva);
  const iva = valorComIva - semIva;
  
  return {
    comIva: valorComIva,
    semIva: semIva,
    valorIva: iva,
    taxaIva: taxaIva,
    comIvaFormatado: formatarEuros(valorComIva),
    semIvaFormatado: formatarEuros(semIva),
    valorIvaFormatado: formatarEuros(iva)
  };
};

/**
 * Calcular preço sem IVA e retornar ambos os valores
 * @param {number} valorComIva - Valor com IVA
 * @param {number} taxaIva - Taxa de IVA
 * @returns {object} - {comIva, semIva}
 */
export const calcularAmbosPrecos = (valorComIva, taxaIva = 23) => {
  const semIva = calcularSemIva(valorComIva, taxaIva);
  return {
    comIva: Math.round(valorComIva * 100) / 100,
    semIva: Math.round(semIva * 100) / 100
  };
};
