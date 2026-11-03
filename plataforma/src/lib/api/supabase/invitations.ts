import type { Api } from '../types';
import { todo } from '../todo';

export const invitations: Api['invitations'] = todo<Api['invitations']>('invitations');
