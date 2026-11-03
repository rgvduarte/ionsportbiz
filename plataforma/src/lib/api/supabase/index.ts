import type { Api } from '../types';
import { auth } from './auth';
import { staff } from './staff';
import { events } from './events';
import { contacts } from './contacts';
import { invitations } from './invitations';
import { templates } from './templates';
import { checkin } from './checkin';
import { guest } from './guest';

export const supabaseApi: Api = { mode: 'supabase', auth, staff, events, contacts, invitations, templates, checkin, guest };
