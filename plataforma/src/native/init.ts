import { isNative } from './platform';

/** Configuração das apps iOS/Android (barra de estado, ecrã inicial, links profundos). No browser não faz nada. */
export async function initNative(): Promise<void> {
  if (!isNative) return;
}
