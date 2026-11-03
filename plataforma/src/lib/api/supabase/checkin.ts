import type { Api } from '../types';
import { todo } from '../todo';

export const checkin: Api['checkin'] = todo<Api['checkin']>('checkin');
