import type { Api } from '../types';
import { todo } from '../todo';

export const contacts: Api['contacts'] = todo<Api['contacts']>('contacts');
