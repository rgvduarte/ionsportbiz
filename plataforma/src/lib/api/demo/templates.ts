import type { Api, MessageTemplate } from '../types';
import { ApiError } from '../errors';
import { CAN_EDIT, CAN_READ_CRM, delay, getDb, nowIso, requireRole, save, uid } from './store';

// Imita a tabela message_templates (checks, chave estrangeira do evento, enum channel).

const CHANNEL_ORDER: Record<MessageTemplate['channel'], number> = { email: 0, whatsapp: 1, sms: 2 };
const collator = new Intl.Collator('pt-PT', { sensitivity: 'base' });

function validate(t: MessageTemplate): void {
  if (!(t.channel in CHANNEL_ORDER)) throw new ApiError('validation', 'message_templates_channel_check');
  if (!t.name || t.name.length > 120) throw new ApiError('validation', 'message_templates_name_check', 'Indique o nome do modelo (até 120 caracteres).');
  if (typeof t.body !== 'string') throw new ApiError('validation', 'message_templates_body');
  if (!getDb().events.some((e) => e.id === t.event_id)) throw new ApiError('validation', 'message_templates_event_id_fkey');
}

export const templates: Api['templates'] = {
  async list(eventId) {
    requireRole(...CAN_READ_CRM);
    const rows = getDb().templates
      .filter((t) => t.event_id === eventId)
      .sort((a, b) => CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel] || collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
    return delay(rows);
  },

  async save(input) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    const now = nowIso();
    const fields = {
      event_id: input.event_id,
      channel: input.channel,
      name: (input.name ?? '').trim(),
      subject: input.channel === 'email' ? input.subject?.trim() || null : null,
      body: input.body,
    };
    let template: MessageTemplate;
    if (input.id) {
      const index = d.templates.findIndex((t) => t.id === input.id);
      if (index < 0) throw new ApiError('not_found');
      template = { ...d.templates[index], ...fields, updated_at: now };
      validate(template);
      d.templates[index] = template;
    } else {
      template = { id: uid(), ...fields, created_at: now, updated_at: now };
      validate(template);
      d.templates.push(template);
    }
    save();
    return delay(template);
  },

  async remove(id) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    if (!d.templates.some((t) => t.id === id)) throw new ApiError('not_found');
    d.templates = d.templates.filter((t) => t.id !== id);
    save();
    await delay(null);
  },
};
