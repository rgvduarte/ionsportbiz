import type { Api } from '../types';
import { todo } from '../todo';

export const guest: Api['guest'] = todo<Api['guest']>('guest');
