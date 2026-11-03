import type { Api } from './types';
import { config } from '../config';
import { supabaseApi } from './supabase';
import { demoApi } from './demo';

export const api: Api = config.demo ? demoApi : supabaseApi;
export * from './types';
export { ApiError, errorMessage, toApiError } from './errors';
