import type { Api, PassType } from '../types';
import { ApiError } from '../errors';
import { ALL_STAFF, CAN_EDIT, delay, getDb, nowIso, requireRole, save, uid } from './store';

// Imita a tabela pass_types: único por (evento, nome), cor #rrggbb, on delete set null nos convites.

function validate(input: Partial<PassType>): void {
  const name = (input.name ?? '').trim();
  if (!name || name.length > 80) throw new ApiError('validation', 'pass_types_name_check', 'Indique um nome com até 80 caracteres.');
  if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new ApiError('validation', 'pass_types_color_check', 'Use uma cor no formato #RRGGBB.');
  if ((input.description ?? '').length > 500) throw new ApiError('validation', 'pass_types_description_check', 'A descrição tem mais de 500 caracteres.');
  const cap = input.capacity;
  if (cap != null && (!Number.isInteger(cap) || cap < 1 || cap > 100000)) throw new ApiError('validation', 'pass_types_capacity_check', 'A quota tem de ser um número inteiro a partir de 1.');
}

export const passTypes: Api['passTypes'] = {
  async list(eventId) {
    requireRole(...ALL_STAFF);
    const rows = getDb().passTypes.filter((p) => p.event_id === eventId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'pt-PT'));
    return delay(rows);
  },

  async save(input) {
    requireRole(...CAN_EDIT);
    validate(input);
    const d = getDb();
    if (!d.events.some((e) => e.id === input.event_id)) throw new ApiError('validation', 'pass_types_event_id_fkey');
    const name = input.name.trim();
    if (d.passTypes.some((p) => p.event_id === input.event_id && p.name === name && p.id !== input.id)) {
      throw new ApiError('duplicate', 'pass_types_event_id_name_key', 'Já existe um tipo de acesso com este nome.');
    }
    const clean = {
      event_id: input.event_id,
      name,
      description: (input.description ?? '').trim() || null,
      accesses: input.accesses.map((a) => a.trim()).filter(Boolean),
      color: input.color || null,
      sort: input.sort,
      capacity: input.capacity ?? null,
    };
    let row: PassType;
    if (input.id) {
      const existing = d.passTypes.find((p) => p.id === input.id);
      if (!existing) throw new ApiError('not_found');
      Object.assign(existing, clean);
      row = existing;
    } else {
      row = { id: uid(), created_at: nowIso(), ...clean };
      d.passTypes.push(row);
    }
    save();
    return delay(row);
  },

  async remove(id) {
    requireRole(...CAN_EDIT);
    const d = getDb();
    if (!d.passTypes.some((p) => p.id === id)) throw new ApiError('not_found');
    d.passTypes = d.passTypes.filter((p) => p.id !== id);
    // on delete set null
    for (const inv of d.invitations) if (inv.pass_type_id === id) inv.pass_type_id = null;
    save();
    await delay(null);
  },
};
