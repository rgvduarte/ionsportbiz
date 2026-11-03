import type { Api, Staff } from '../types';
import { config } from '../../config';
import { supabase, check } from './client';
import { toApiError } from '../errors';

export const auth: Api['auth'] = {
  async session() {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const res = await supabase.from('staff').select('*').eq('user_id', user.id).eq('active', true).maybeSingle();
    if (res.error) throw toApiError(res.error);
    return { user: { id: user.id, email: user.email ?? '' }, staff: (res.data as Staff | null) ?? null };
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toApiError({ name: 'AuthApiError', message: error.message });
  },
  async sendMagicLink(email) {
    check(await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${config.publicUrl}/admin` },
    }));
  },
  async signOut() {
    check(await supabase.auth.signOut());
  },
  onChange(cb) {
    const { data } = supabase.auth.onAuthStateChange(() => cb());
    return () => data.subscription.unsubscribe();
  },
};
