import type { Api, PassType } from '../types';
import { check, must, supabase } from './client';

export const passTypes: Api['passTypes'] = {
  async list(eventId) {
    return must(await supabase.from('pass_types').select('*').eq('event_id', eventId).order('sort').order('name')) as PassType[];
  },

  async save(input) {
    const { id, ...fields } = input;
    const row = {
      ...fields,
      name: fields.name.trim(),
      description: (fields.description ?? '').trim() || null,
      accesses: fields.accesses.map((a) => a.trim()).filter(Boolean),
      color: fields.color || null,
      capacity: fields.capacity ?? null,
    };
    const res = id
      ? await supabase.from('pass_types').update(row).eq('id', id).select('*').single()
      : await supabase.from('pass_types').insert(row).select('*').single();
    return must(res) as PassType;
  },

  async remove(id) {
    check(await supabase.from('pass_types').delete().eq('id', id));
  },
};
