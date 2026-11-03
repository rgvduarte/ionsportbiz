import type { ReactNode } from 'react';
import { Hand, Link2, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import type { Channel, InvitationStatus } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { CHANNEL, INVITATION_STATUS } from '../../lib/status';
import { Badge } from '../../ui';

const CHANNEL_ICON: Record<Channel, typeof Mail> = { email: Mail, whatsapp: MessageCircle, sms: MessageSquare, manual: Hand, link: Link2 };

export function ChannelIcon({ channel, size = 14 }: { channel: Channel; size?: number }) {
  const Icon = CHANNEL_ICON[channel] ?? Mail;
  return <Icon size={size} aria-hidden />;
}

export function StatusBadge({ status }: { status: InvitationStatus }) {
  const s = INVITATION_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

/** "há 3 dias", com a data completa no title e para leitores de ecrã. */
export function When({ iso, tz, children }: { iso: string | null | undefined; tz?: string; children?: ReactNode }) {
  if (!iso) return <span className="muted">—</span>;
  const full = formatDateTime(iso, tz);
  return (
    <time dateTime={iso} title={full}>
      {children}
      {formatRelative(iso)}
    </time>
  );
}

export function channelLabel(channel: Channel | null | undefined): string {
  return channel ? CHANNEL[channel] : '';
}

/** Descarrega um ficheiro gerado no browser. */
export function downloadBlob(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copia texto; usa o método antigo quando a Clipboard API não está disponível (http, webviews antigas). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Não foi possível copiar. Selecione o texto e copie manualmente.');
  }
}

/** "1 convidado" / "3 convidados" */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`;
}
