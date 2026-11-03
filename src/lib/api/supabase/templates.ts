import type { Api, MessageTemplate, MessageTemplateInput } from '../types';
import { ApiError } from '../errors';
import { supabase, must } from './client';

function fields(input: MessageTemplateInput) {
  return {
    event_id: input.event_id,
    channel: input.channel,
    name: input.name.trim(),
    // O assunto só faz sentido no email.
    subject: input.channel === 'email' ? input.subject?.trim() || null : null,
    body: input.body,
  };
}

export const templates: Api['templates'] = {
  async list(eventId) {
    // channel é um enum: a ordem é a da declaração (email, whatsapp, sms).
    return must(
      await supabase.from('message_templates').select('*').eq('event_id', eventId).order('channel').order('name').order('id'),
    ) as MessageTemplate[];
  },

  async save(input) {
    const res = input.id
      ? await supabase.from('message_templates').update(fields(input)).eq('id', input.id).select().maybeSingle()
      : await supabase.from('message_templates').insert(fields(input)).select().single();
    return must(res) as MessageTemplate;
  },

  async remove(id) {
    const rows = must(await supabase.from('message_templates').delete().eq('id', id).select('id'));
    if (!rows.length) throw new ApiError('not_found');
  },
};
