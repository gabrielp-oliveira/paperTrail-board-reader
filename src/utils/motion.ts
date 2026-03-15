/**
 * Retorna 0 se o usuário preferir movimento reduzido, ou o valor original.
 * Usar em todas as durações de transição D3.
 */
// M7: cacheia resultado — evita criar MediaQueryList a cada chamada de animação
const _reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

export function animDuration(ms: number): number {
  return _reducedMotionMQ.matches ? 0 : ms;
}
