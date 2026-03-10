/**
 * Retorna 0 se o usuário preferir movimento reduzido, ou o valor original.
 * Usar em todas as durações de transição D3.
 */
export function animDuration(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}
