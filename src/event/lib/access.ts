import { useI18n, type I18nKey } from './i18n';
import { credentialState, type CredentialState } from './invite';
import { useStore } from './store';

const STATUS_KEY: Record<Exclude<CredentialState, 'approved'>, I18nKey> = {
  unconfirmed: 'status.unconfirmed',
  pending: 'status.pending',
  rejected: 'status.rejected',
  declined: 'status.declined',
};

/** O que a equipa decidiu sobre o acesso: o tipo atribuído ou, até lá, o estado do convite. */
export function useAccessLabel(): { label: string; approved: boolean } | null {
  const { t } = useI18n();
  const { state, sync } = useStore();
  const v = state.view;
  if (!v) return sync === 'unavailable' ? { label: t('status.unavailable'), approved: false } : null;
  const cs = credentialState(v.invitation);
  if (cs === 'approved') return { label: v.invitation.pass_type?.name ?? t('cred.guest'), approved: true };
  return { label: t(STATUS_KEY[cs]), approved: false };
}
