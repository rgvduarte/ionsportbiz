import { useCallback, useEffect, useRef, useState } from 'react';
import type QrScannerLib from 'qr-scanner';
import { CameraOff, Flashlight, FlashlightOff, Keyboard, Loader2, RefreshCw, ScanLine, Search, Settings, ShieldAlert } from 'lucide-react';
import { Alert, Button, Select } from '../../ui';
import { canScanNatively, openScannerSettings, scanQr, ScanError } from '../../native/scanner';
import { createDedupe } from './code';

type WebState = 'starting' | 'running' | 'denied' | 'nocamera' | 'insecure' | 'error';
type Mode = 'detecting' | 'web' | 'native';

const CAMERA_KEY = 'convites.checkin.camera';

function readCamera(): string | null {
  try { return localStorage.getItem(CAMERA_KEY); } catch { return null; }
}
function storeCamera(id: string): void {
  try { localStorage.setItem(CAMERA_KEY, id); } catch { /* sem armazenamento: fica só nesta sessão */ }
}

/** A biblioteca devolve sempre "Camera not found."; a API de permissões distingue o acesso recusado. */
async function cameraDenied(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return status?.state === 'denied';
  } catch {
    return false;
  }
}

function classify(err: unknown): WebState {
  const name = (err as { name?: string } | null)?.name ?? '';
  const message = err instanceof Error ? err.message : String(err);
  if (name === 'NotAllowedError' || name === 'SecurityError' || /denied|permission|not allowed/i.test(message)) return 'denied';
  if (/https/i.test(message)) return 'insecure';
  if (['NotFoundError', 'NotReadableError', 'OverconstrainedError', 'AbortError'].includes(name)
    || /not found|no camera|requested device|could not start/i.test(message)) return 'nocamera';
  return 'error';
}

const PROBLEM: Record<Exclude<WebState, 'starting' | 'running'>, { icon: React.ReactNode; title: string; text: string }> = {
  denied: {
    icon: <ShieldAlert aria-hidden />,
    title: 'Sem acesso à câmara',
    text: 'Autorize o acesso à câmara nas definições do browser (ícone junto ao endereço da página) e tente novamente.',
  },
  nocamera: {
    icon: <CameraOff aria-hidden />,
    title: 'Câmara indisponível',
    text: 'Não foi possível usar a câmara: pode não existir, estar ocupada por outra aplicação ou o acesso não ter sido autorizado.',
  },
  insecure: {
    icon: <ShieldAlert aria-hidden />,
    title: 'Ligação não segura',
    text: 'A câmara só pode ser usada em páginas abertas com https.',
  },
  error: {
    icon: <CameraOff aria-hidden />,
    title: 'Não foi possível ligar a câmara',
    text: 'Feche outras aplicações que estejam a usar a câmara e tente novamente.',
  },
};

interface Props {
  /** Conteúdo lido (código de check-in ou link pessoal). */
  onScan: (value: string) => void;
  /** true enquanto se mostra um resultado: as leituras são ignoradas, mas a câmara continua ligada. */
  paused?: boolean;
  onManualEntry?: () => void;
  onSearchInstead?: () => void;
}

/**
 * Leitor de códigos QR. Na app nativa usa o leitor do sistema (ML Kit, em ecrã inteiro);
 * no browser, a câmara com a biblioteca qr-scanner.
 */
export function QrScanner(props: Props) {
  const [mode, setMode] = useState<Mode>('detecting');
  useEffect(() => {
    let alive = true;
    canScanNatively().then((ok) => alive && setMode(ok ? 'native' : 'web'), () => alive && setMode('web'));
    return () => { alive = false; };
  }, []);
  if (mode === 'detecting') {
    return <div className="ck-scan ck-scan--frame" aria-busy="true"><div className="ck-scan__state"><Loader2 className="ui-spin" aria-hidden /></div></div>;
  }
  return mode === 'native' ? <NativeScanner {...props} /> : <WebScanner {...props} />;
}

function NativeScanner({ onScan, paused, onManualEntry }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ScanError | null>(null);
  const scan = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const value = await scanQr();
      if (value) onScan(value);
    } catch (err) {
      setProblem(err instanceof ScanError ? err : new ScanError('module_unavailable'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ck-scan ck-scan--native">
      <div className="ck-scan__native-icon" aria-hidden><ScanLine /></div>
      <Button variant="primary" size="lg" block className="ck-scan__native-btn" icon={<ScanLine />} loading={busy} disabled={paused} onClick={() => void scan()}>
        Ler código QR
      </Button>
      <p className="ck-scan__hint">Abre a câmara em ecrã inteiro. Aponte ao código do bilhete ou do convite.</p>
      {problem && (
        <Alert tone="warning">
          {problem.message}
          <div className="ui-row" style={{ marginTop: 8 }}>
            {problem.code === 'permission_denied' && (
              <Button size="sm" icon={<Settings />} onClick={() => void openScannerSettings()}>Abrir definições</Button>
            )}
            {onManualEntry && <Button size="sm" icon={<Keyboard />} onClick={onManualEntry}>Introduzir código</Button>}
          </div>
        </Alert>
      )}
    </div>
  );
}

function WebScanner({ onScan, paused = false, onManualEntry, onSearchInstead }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const scanner = useRef<QrScannerLib | null>(null);
  const [state, setState] = useState<WebState>('starting');
  const [attempt, setAttempt] = useState(0);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(readCamera);
  const [flash, setFlash] = useState<{ available: boolean; on: boolean }>({ available: false, on: false });

  // As leituras chegam por callback da biblioteca: usar refs para ter sempre os valores atuais.
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const dedupe = useRef(createDedupe(3000));
  const handle = useCallback((value: string) => {
    const v = value.trim();
    if (!v || !dedupe.current(v) || pausedRef.current) return;
    onScanRef.current(v);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let instance: QrScannerLib | null = null;
    setState('starting');
    (async () => {
      if (!window.isSecureContext) { setState('insecure'); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setState('nocamera'); return; }
      const { default: Lib } = await import('qr-scanner');
      if (cancelled || !video.current) return;
      instance = new Lib(video.current, (r) => handle(r.data), {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        maxScansPerSecond: 8,
        preferredCamera: readCamera() ?? 'environment',
        overlay: region.current ?? undefined,
        onDecodeError: () => undefined,
      });
      scanner.current = instance;
      try {
        await instance.start();
      } catch (err) {
        const denied = await cameraDenied();
        if (!cancelled) setState(denied ? 'denied' : classify(err));
        return;
      }
      if (cancelled) return;
      setState('running');
      const [hasFlash, list] = await Promise.all([
        instance.hasFlash().catch(() => false),
        Lib.listCameras(true).catch(() => []),
      ]);
      if (cancelled) return;
      setFlash({ available: hasFlash, on: false });
      setCameras(list.map((c, i) => ({ id: c.id, label: c.label || `Câmara ${i + 1}` })));
    })().catch((err) => !cancelled && setState(classify(err)));
    return () => {
      cancelled = true;
      instance?.destroy();
      scanner.current = null;
    };
  }, [attempt, handle]);

  const changeCamera = async (id: string) => {
    setCameraId(id);
    storeCamera(id);
    const s = scanner.current;
    if (!s) return;
    try {
      await s.setCamera(id);
      setFlash({ available: await s.hasFlash().catch(() => false), on: false });
    } catch (err) {
      setState(classify(err));
    }
  };

  const toggleFlash = async () => {
    const s = scanner.current;
    if (!s) return;
    try {
      await s.toggleFlash();
      setFlash((f) => ({ ...f, on: s.isFlashOn() }));
    } catch {
      setFlash({ available: false, on: false });
    }
  };

  const problem = state !== 'starting' && state !== 'running' ? PROBLEM[state] : null;

  return (
    <div className="ck-scan">
      <div className={['ck-scan__frame', paused && 'is-paused', problem && 'has-problem'].filter(Boolean).join(' ')}>
        <video ref={video} className="ck-scan__video" muted playsInline aria-label="Imagem da câmara" hidden={!!problem} />
        {/* A biblioteca posiciona e mostra esta moldura sobre a zona de leitura. */}
        <div ref={region} className="ck-scan__region" aria-hidden>
          <span /><span /><span /><span />
        </div>
        {state === 'starting' && (
          <div className="ck-scan__state" role="status">
            <Loader2 className="ui-spin" aria-hidden />
            <span>A ligar a câmara…</span>
          </div>
        )}
        {problem && (
          <div className="ck-scan__state ck-scan__state--problem" role="status">
            <div className="ck-scan__problem-icon">{problem.icon}</div>
            <strong>{problem.title}</strong>
            <p>{problem.text}</p>
            <div className="ck-scan__actions">
              <Button icon={<RefreshCw />} onClick={() => setAttempt((a) => a + 1)}>Tentar novamente</Button>
              {onManualEntry && <Button icon={<Keyboard />} onClick={onManualEntry}>Introduzir código</Button>}
              {onSearchInstead && <Button icon={<Search />} onClick={onSearchInstead}>Pesquisar por nome</Button>}
            </div>
          </div>
        )}
        {state === 'running' && paused && <div className="ck-scan__paused">Leitura em pausa</div>}
        {state === 'running' && (flash.available || cameras.length > 1) && (
          <div className="ck-scan__tools">
            {cameras.length > 1 && (
              <Select
                aria-label="Câmara"
                className="ck-scan__camera"
                value={cameraId && cameras.some((c) => c.id === cameraId) ? cameraId : ''}
                placeholder="Câmara predefinida"
                options={cameras.map((c) => ({ value: c.id, label: c.label }))}
                onChange={(e) => e.target.value && void changeCamera(e.target.value)}
              />
            )}
            {flash.available && (
              <Button
                variant="secondary"
                iconOnly
                aria-label={flash.on ? 'Desligar lanterna' : 'Ligar lanterna'}
                aria-pressed={flash.on}
                title={flash.on ? 'Desligar lanterna' : 'Ligar lanterna'}
                icon={flash.on ? <FlashlightOff /> : <Flashlight />}
                onClick={() => void toggleFlash()}
              />
            )}
          </div>
        )}
      </div>
      {state === 'running' && (
        <p className="ck-scan__hint" aria-live="polite">
          <span className="ck-scan__live" aria-hidden />
          {paused ? 'Conclua o registo atual para continuar a ler.' : 'Aponte a câmara ao código QR do bilhete ou do convite.'}
        </p>
      )}
    </div>
  );
}
