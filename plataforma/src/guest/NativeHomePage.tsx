import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, KeyRound, Mail, Plus, ScanLine, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import type { GuestView, Language } from '../lib/api/types';
import { formatTime } from '../lib/format';
import { isNative } from '../native/platform';
import { savedInvitations, type SavedInvitation } from '../native/savedInvitations';
import { Alert, Badge, Button, Dialog, Field, Input, useConfirm, useToast, type Tone } from '../ui';
import {
  deviceLanguage, errorText, GuestI18n, guestStatusKey, guestStrings, useGuestStrings, type GuestStatusKey, type GuestStrings,
} from './i18n';
import { LanguageToggle } from './LanguageToggle';
import { accentStyle } from './parts';
import { capitalize, eventIsPast, parseInvitationInput } from './utils';
import './guest.css';
import { useLightTheme } from './useLightTheme';
import ionLogo from '../assets/brand/ion-logo.png';

interface Scanner {
  scanQr(): Promise<string | null>;
  canScanNatively(): Promise<boolean>;
}

// O leitor de QR é opcional: se o módulo não existir, a lista fica vazia e o botão não aparece.
const scannerModules = import.meta.glob<Scanner>('../native/scanner.{ts,tsx}');
const loadScanner = Object.values(scannerModules)[0] as (() => Promise<Scanner>) | undefined;

type RowState = 'loading' | 'ok' | 'unavailable' | 'offline';
interface Row extends SavedInvitation {
  state: RowState;
  view?: GuestView;
}

const STATUS_TONE: Record<GuestStatusKey, Tone> = {
  pending: 'gold',
  accepted: 'success',
  declined: 'neutral',
  closed: 'neutral',
  checkedIn: 'success',
  unavailable: 'neutral',
};

/** "Os meus convites" (/app): os convites guardados na app, com o estado atual de cada um. */
export function NativeHomePage() {
  // A app tem a identidade da ion: tema escuro.
  useLightTheme(false);
  const [lang, setLang] = useState<Language>(deviceLanguage);
  const t = guestStrings(lang);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = t.htmlLang;
    const title = document.title;
    document.title = t.appTitle;
    return () => { document.documentElement.lang = previous; document.title = title; };
  }, [t]);

  const load = useCallback(async () => {
    const saved = await savedInvitations.list();
    setRows(saved.map((s) => ({ ...s, state: 'loading' })));
    const update = (token: string, patch: Partial<Row>) =>
      setRows((all) => all?.map((r) => (r.token === token ? { ...r, ...patch } : r)) ?? null);
    await Promise.all(saved.map(async (s) => {
      try {
        const v = await api.guest.view(s.token, { track: false });
        if (!v) {
          update(s.token, { state: 'unavailable', view: undefined });
          return;
        }
        update(s.token, { state: 'ok', view: v, eventName: v.event.name, startsAt: v.event.starts_at, timezone: v.event.timezone });
        await savedInvitations.add({ token: s.token, eventName: v.event.name, startsAt: v.event.starts_at, timezone: v.event.timezone });
      } catch {
        update(s.token, { state: 'offline' });
      }
    }));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (row: Row) => {
    const ok = await confirm({
      title: t.appRemoveConfirmTitle,
      message: t.appRemoveConfirmBody,
      confirmLabel: t.appRemoveConfirm,
      cancelLabel: t.cancel,
      danger: true,
    });
    if (!ok) return;
    await savedInvitations.remove(row.token);
    setRows((all) => all?.filter((r) => r.token !== row.token) ?? null);
    toast.success(t.appRemoved);
  };

  const { upcoming, past } = useMemo(() => {
    const list = rows ?? [];
    const isPast = (r: Row) => eventIsPast({ starts_at: r.startsAt, ends_at: r.view?.event.ends_at ?? null });
    return {
      upcoming: list.filter((r) => !isPast(r)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: list.filter(isPast).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }, [rows]);
  const offline = rows?.some((r) => r.state === 'offline') ?? false;

  return (
    <GuestI18n.Provider value={t}>
      <div className="gn" data-theme="dark" style={accentStyle(null, 'dark')} lang={t.htmlLang}>
        <header className="gn-head">
          <div className="gn-head__inner">
            <div className="gn-head__bar">
              <span className="gn-brand">
                <img className="gn-brand__logo" src={ionLogo} alt="ion — International Business & Sports Conference" width={72} height={44} />
              </span>
              <LanguageToggle value={lang} onChange={setLang} />
            </div>
            <h1 className="gn-head__title">{t.appTitle}</h1>
            <p className="gn-head__intro">{t.appIntro}</p>
          </div>
        </header>

        <main className="gn-main">
          <div className="gn-toolbar">
            <Button size="lg" icon={<Plus />} onClick={() => setAdding(true)}>{t.appAdd}</Button>
          </div>

          {!isNative && <Alert tone="info">{t.appBrowserNote}</Alert>}
          {offline && <Alert tone="warning">{t.appOffline}</Alert>}

          {rows === null ? (
            <div className="gn-list" aria-busy>
              <span className="ui-skeleton gn-skel" />
              <span className="ui-skeleton gn-skel" />
            </div>
          ) : rows.length === 0 ? (
            <div className="gn-empty">
              <div className="ui-empty">
                <div className="ui-empty__icon"><Mail aria-hidden /></div>
                <div className="ui-empty__title">{t.appEmptyTitle}</div>
                <div>{t.appEmptyBody}</div>
                <div className="ui-empty__actions">
                  <Button icon={<Plus />} onClick={() => setAdding(true)}>{t.appAdd}</Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && <Group title={t.appUpcoming} rows={upcoming} onRemove={remove} />}
              {past.length > 0 && <Group title={t.appPast} rows={past} onRemove={remove} isPast />}
            </>
          )}

          <nav className="gn-foot" aria-label={t.appStaff}>
            <Link to="/entrar"><KeyRound aria-hidden />{t.appStaff}</Link>
          </nav>
        </main>

        {adding && (
          <AddInvitationDialog
            t={t}
            onClose={() => setAdding(false)}
            onOpen={(token) => navigate(`/c/${token}`)}
          />
        )}
      </div>
    </GuestI18n.Provider>
  );
}

function Group({ title, rows, onRemove, isPast }: { title: string; rows: Row[]; onRemove: (r: Row) => void; isPast?: boolean }) {
  return (
    <section aria-label={title}>
      <h2 className="gi-eyebrow gn-group__title">{title}</h2>
      <ul className="gn-list">
        {rows.map((r) => <Item key={r.token} row={r} onRemove={onRemove} isPast={isPast} />)}
      </ul>
    </section>
  );
}

function Item({ row, onRemove, isPast }: { row: Row; onRemove: (r: Row) => void; isPast?: boolean }) {
  const t = useGuestStrings();
  const tz = row.timezone ?? 'Europe/Lisbon';
  const date = new Date(row.startsAt);
  const valid = !Number.isNaN(date.getTime());
  const part = (opts: Intl.DateTimeFormatOptions) => (valid ? new Intl.DateTimeFormat(t.locale, { timeZone: tz, ...opts }).format(date) : '');
  const when = valid ? `${capitalize(part({ weekday: 'long' }))} · ${formatTime(row.startsAt, tz, t.locale)}` : '';
  const v = row.view;
  const status: GuestStatusKey | null = row.state === 'unavailable'
    ? 'unavailable'
    : v ? guestStatusKey({ status: v.invitation.status, checked_in_at: v.invitation.checked_in_at }, v.event.rsvp_open) : null;

  return (
    <li className={['gn-item', isPast && 'gn-item--past'].filter(Boolean).join(' ')}>
      <Link to={`/c/${row.token}`} className="gn-item__link">
        <span className="gn-date" aria-hidden>
          <span className="gn-date__day">{part({ day: 'numeric' })}</span>
          <span className="gn-date__month">{part({ month: 'short' }).replace('.', '')}</span>
          <span className="gn-date__year">{part({ year: 'numeric' })}</span>
        </span>
        <span className="gn-item__body">
          <span className="gn-item__name">{row.eventName}</span>
          <span className="gn-item__when">{when}</span>
          <span className="gn-item__status">
            {status ? (
              <Badge tone={STATUS_TONE[status]} dot>{t.guestStatus[status]}</Badge>
            ) : row.state === 'loading' ? (
              <span className="ui-skeleton" style={{ display: 'inline-block', width: 120, height: 20, borderRadius: 999 }} />
            ) : null}
          </span>
        </span>
        <ChevronRight className="gn-item__chev" aria-hidden />
      </Link>
      <Button
        variant="ghost"
        iconOnly
        className="gn-item__remove"
        aria-label={`${t.appRemove}: ${row.eventName}`}
        icon={<Trash2 />}
        onClick={() => onRemove(row)}
      />
    </li>
  );
}

function AddInvitationDialog({ t, onClose, onOpen }: { t: GuestStrings; onClose: () => void; onOpen: (token: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'open' | 'scan' | null>(null);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!loadScanner) return;
    loadScanner()
      .then((m) => m.canScanNatively())
      .then((ok) => { if (alive) setCanScan(ok); })
      .catch(() => { if (alive) setCanScan(false); });
    return () => { alive = false; };
  }, []);

  const open = async (raw: string) => {
    const token = parseInvitationInput(raw);
    if (!token) {
      setError(t.appAddInvalid);
      return;
    }
    setBusy('open');
    setError(null);
    try {
      const v = await api.guest.view(token, { track: false });
      if (!v) {
        setError(t.appAddNotFound);
        return;
      }
      await savedInvitations.add({ token, eventName: v.event.name, startsAt: v.event.starts_at, timezone: v.event.timezone });
      onOpen(token);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void open(value);
  };

  const scan = async () => {
    if (!loadScanner) return;
    setBusy('scan');
    setError(null);
    try {
      const raw = await (await loadScanner()).scanQr();
      setBusy(null);
      if (raw) {
        setValue(raw);
        await open(raw);
      }
    } catch {
      setBusy(null);
      setError(t.appScanError);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.appAddTitle}
      description={t.appAddIntro}
      footer={
        <>
          <Button onClick={onClose} disabled={!!busy}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form="gn-add-form" loading={busy === 'open'}>{t.appAddOpen}</Button>
        </>
      }
    >
      <form id="gn-add-form" className="gn-add" onSubmit={onSubmit} noValidate>
        <Field label={t.appAddLabel} error={error}>
          <Input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={t.appAddPlaceholder}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </Field>
        {canScan && (
          <>
            <div className="gn-add__or" aria-hidden>{t.or}</div>
            <Button size="lg" icon={<ScanLine />} onClick={scan} loading={busy === 'scan'} disabled={busy === 'open'}>{t.appScan}</Button>
          </>
        )}
      </form>
    </Dialog>
  );
}
