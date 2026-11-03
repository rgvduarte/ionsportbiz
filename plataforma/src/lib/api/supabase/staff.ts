import type { Api } from '../types';
import { todo } from '../todo';

export const staff: Api['staff'] = todo<Api['staff']>('staff');
