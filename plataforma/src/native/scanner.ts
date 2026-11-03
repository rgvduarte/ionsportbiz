// Leitor de códigos QR nativo (apps iOS/Android), com o ML Kit da Google.
// O plugin só é carregado a pedido, para não pesar na versão web.
// No browser usa-se o qr-scanner (ver src/admin/checkin/QrScanner.tsx).

import { isNative, platform } from './platform';

export type ScanErrorCode = 'permission_denied' | 'module_unavailable' | 'unsupported';

const MESSAGES: Record<ScanErrorCode, string> = {
  permission_denied: 'Sem acesso à câmara. Autorize o acesso nas definições do dispositivo.',
  module_unavailable: 'Não foi possível preparar o leitor de códigos. Verifique a ligação à Internet e tente novamente.',
  unsupported: 'Este dispositivo não tem uma câmara compatível.',
};

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  constructor(code: ScanErrorCode) {
    super(MESSAGES[code]);
    this.name = 'ScanError';
    this.code = code;
  }
}

type Plugin = typeof import('@capacitor-mlkit/barcode-scanning');

let plugin: Promise<Plugin> | null = null;
const load = () => (plugin ??= import('@capacitor-mlkit/barcode-scanning'));

let supported: Promise<boolean> | null = null;

/** true dentro da app nativa, num dispositivo com câmara. */
export function canScanNatively(): Promise<boolean> {
  if (!isNative) return Promise.resolve(false);
  supported ??= load()
    .then(({ BarcodeScanner }) => BarcodeScanner.isSupported())
    .then((r) => r.supported)
    .catch(() => false);
  return supported;
}

/**
 * Android: o leitor da Google (Google Play Services) é um módulo descarregado à parte.
 * Normalmente já está instalado; se não estiver, instala-o e espera (até 90 s).
 */
async function ensureGoogleModule({ BarcodeScanner, GoogleBarcodeScannerModuleInstallState: State }: Plugin): Promise<void> {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;
  await new Promise<void>((resolve, reject) => {
    let done = false;
    let handle: { remove: () => Promise<void> } | null = null;
    const finish = (err?: ScanError) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void handle?.remove();
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(new ScanError('module_unavailable')), 90_000);
    BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (e) => {
      if (e.state === State.COMPLETED) finish();
      else if (e.state === State.FAILED || e.state === State.CANCELED) finish(new ScanError('module_unavailable'));
    })
      .then((h) => {
        handle = h;
        if (done) void h.remove();
        return BarcodeScanner.installGoogleBarcodeScannerModule();
      })
      .catch(() => finish(new ScanError('module_unavailable')));
  });
}

/**
 * Abre o leitor em ecrã inteiro e devolve o conteúdo do primeiro código QR lido,
 * ou null se a pessoa cancelar. Lança ScanError quando não é possível ler.
 */
export async function scanQr(): Promise<string | null> {
  if (!isNative) throw new ScanError('unsupported');
  const mod = await load();
  const { BarcodeScanner, BarcodeFormat } = mod;
  if (platform === 'android') {
    // O leitor da Google corre fora da app e não precisa da permissão da câmara.
    await ensureGoogleModule(mod);
  } else {
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted' && camera !== 'limited') throw new ScanError('permission_denied');
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    return barcodes[0]?.rawValue || null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) return null;
    throw err;
  }
}

/** Abre as definições da app (depois de a pessoa ter recusado o acesso à câmara). */
export async function openScannerSettings(): Promise<void> {
  if (!isNative) return;
  const { BarcodeScanner } = await load();
  await BarcodeScanner.openSettings();
}
