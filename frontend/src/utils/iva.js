/**
 * Utilitários para cálculo de IVA (Portugal)
 * Taxa padrão: 23%
 */

export const IVA_RATE = 0.23; // 23% IVA em Portugal

/**
 * Calcular valor sem IVA a partir do valor com IVA
 * @param {number} valorComIva - Valor com IVA incluído
 * @returns {number} - Valor sem IVA
 */
export const calcularSemIva = (valorComIva) => {
  if (!valorComIva || valorComIva <= 0) return 0;
  return valorComIva / (1 + IVA_RATE);
};

/**
 * Calcular valor com IVA a partir do valor sem IVA
 * @param {number} valorSemIva - Valor sem IVA
 * @returns {number} - Valor com IVA incluído
 */
export const calcularComIva = (valorSemIva) => {
  if (!valorSemIva || valorSemIva <= 0) return 0;
  return valorSemIva * (1 + IVA_RATE);
};

/**
 * Calcular apenas o valor do IVA
 * @param {number} valorSemIva - Valor sem IVA
 * @returns {number} - Valor do IVA
 */
export const calcularValorIva = (valorSemIva) => {
  if (!valorSemIva || valorSemIva <= 0) return 0;
  return valorSemIva * IVA_RATE;
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
 * Uso: <PrecoComIva valor={100} showBoth={true} />
 */
export const formatarPrecoCompleto = (valorComIva) => {
  const semIva = calcularSemIva(valorComIva);
  const iva = valorComIva - semIva;
  
  return {
    comIva: valorComIva,
    semIva: semIva,
    valorIva: iva,
    comIvaFormatado: formatarEuros(valorComIva),
    semIvaFormatado: formatarEuros(semIva),
    valorIvaFormatado: formatarEuros(iva)
  };
};
