import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage, type EventRecord } from '../../lib/api';
import { formatDate, formatNumber } from '../../lib/format';
import { EVENT_STATUS } from '../../lib/status';
import { useAsync } from '../../lib/useAsync';
import { Alert, Button, Dialog, Field, Input, Select, Skeleton, useToast } from '../../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  contactIds: string[];
  /** Depois de criar os convites (quantos novos e para que evento). */
  onDone?: (created: number, event: EventRecord) => void;
}

export function InviteToEventDialog(props: Props) {
  if (!props.open) return null;
  return <InviteForm {...props} />;
}

/** Eventos onde ainda faz sentido convidar: primeiro os próximos, depois os passados. */
export function invitableEvents(events: EventRecord[], now = Date.now()): EventRecord[] {
  const list = events.filter((e) => e.status !== 'archived');
  const upcoming = list.filter((e) => new Date(e.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = list.filter((e) => new Date(e.starts_at).getTime() < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return [...upcoming, ...past];
}

export function eventOptionLabel(e: EventRecord): string {
  const status = e.status === 'open' ? '' : ` · ${EVENT_STATUS[e.status].label}`;
  return `${e.name} — ${formatDate(e.starts_at, e.timezone)}${status}`;
}

function InviteForm({ onClose, contactIds, onDone }: Props) {
  const toast = useToast();
  const formId = useId();
  const events = useAsync(() => api.events.list().then((l) => invitableEvents(l)), []);
  const [eventId, setEventId] = useState('');
  const [wave, setWave] = useState('');
  const [plusOnes, setPlusOnes] = useState('0');
  const [waves, setWaves] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const event = useMemo(() => events.data?.find((e) => e.id === eventId) ?? null, [events.data, eventId]);

  // Escolhe o primeiro evento da lista por omissão.
  useEffect(() => {
    if (!eventId && events.data?.length) setEventId(events.data[0].id);
  }, [events.data, eventId]);

  useEffect(() => {
    if (!event) return;
    setPlusOnes(String(event.default_plus_ones));
    setWaves([]);
    let alive = true;
    api.invitations.waves(event.id).then((w) => alive && setWaves(w), () => undefined);
    return () => { alive = false; };
  }, [event]);

  const count = contactIds.length;
  const plus = Number(plusOnes);
  const plusInvalid = !Number.isInteger(plus) || plus < 0 || plus > 10;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!event || plusInvalid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.invitations.create(event.id, contactIds, { wave: wave.trim() || null, plusOnes: plus });
      const skipped = count - created;
      if (created === 0) {
        toast.info(count === 1 ? `Este contacto já estava convidado para ${event.name}.` : `Os ${formatNumber(count)} contactos já estavam convidados para ${event.name}.`);
      } else {
        toast.success(
          `${created === 1 ? '1 convite criado' : `${formatNumber(created)} convites criados`} para ${event.name}.`
          + (skipped > 0 ? ` ${skipped === 1 ? '1 já estava convidado' : `${formatNumber(skipped)} já estavam convidados`}.` : ''),
        );
      }
      onDone?.(created, event);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const waveListId = `${formId}-waves`;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Convidar para evento"
      description={count === 1 ? '1 contacto selecionado.' : `${formatNumber(count)} contactos selecionados.`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving} disabled={!event || plusInvalid}>
            {count === 1 ? 'Criar convite' : 'Criar convites'}
          </Button>
        </>
      }
    >
      <form id={formId} className="ui-stack" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        {events.loading && !events.data ? (
          <div className="ui-stack" aria-busy="true">
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        ) : events.error ? (
          <Alert tone="danger">
            Não foi possível carregar os eventos. {errorMessage(events.error)}{' '}
            <button type="button" className="ct-link-btn" onClick={events.reload}>Tentar novamente</button>
          </Alert>
        ) : !events.data?.length ? (
          <Alert tone="info">Ainda não há eventos ativos. Crie um evento antes de convidar contactos.</Alert>
        ) : (
          <>
            <Field label="Evento" required>
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)} options={events.data.map((e) => ({ value: e.id, label: eventOptionLabel(e) }))} />
            </Field>
            {event?.status === 'closed' && (
              <Alert tone="warning">Este evento está fechado: os convidados veem o convite, mas já não podem responder.</Alert>
            )}
            {event?.status === 'draft' && (
              <Alert tone="info">O evento está em rascunho: os links pessoais só abrem depois de o evento ser aberto.</Alert>
            )}
            <div className="ui-form-grid">
              <Field label="Vaga" hint="Opcional. Ex.: Convidados de honra, 1.ª vaga.">
                <Input value={wave} list={waves.length ? waveListId : undefined} maxLength={80} autoComplete="off" onChange={(e) => setWave(e.target.value)} />
              </Field>
              <Field label="Acompanhantes por convite" error={plusInvalid ? 'Entre 0 e 10.' : null}
                hint={event ? `Por omissão do evento: ${event.default_plus_ones}.` : undefined}>
                <Input type="number" min={0} max={10} step={1} inputMode="numeric" value={plusOnes} onChange={(e) => setPlusOnes(e.target.value)} />
              </Field>
            </div>
            {waves.length > 0 && (
              <datalist id={waveListId}>
                {waves.map((w) => <option key={w} value={w} />)}
              </datalist>
            )}
            <p className="ct-help">
              Os convites ficam no estado «Por enviar». Quem já estiver convidado para este evento é ignorado.
              O envio faz-se depois, na lista de convidados do evento.
            </p>
          </>
        )}
      </form>
    </Dialog>
  );
}
