import type { Api } from '../types';
import { todo } from '../todo';

export const templates: Api['templates'] = todo<Api['templates']>('templates');
