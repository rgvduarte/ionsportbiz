import type { Api } from '../types';
import { todo } from '../todo';

export const events: Api['events'] = todo<Api['events']>('events');
