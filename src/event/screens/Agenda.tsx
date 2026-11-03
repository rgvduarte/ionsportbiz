import { useSearchParams } from 'react-router';
import { Star } from 'lucide-react';
import { DAYS, SESSIONS, STAGES } from '../data/event';
import type { DayId } from '../data/types';
import { SessionCard } from '../components/SessionCard';
import { Chip, DemoNote, Empty, TopBar } from '../components/ui';
import { fmtDay, fmtTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { asset } from '../lib/asset';

export default function Agenda() {
  const { t, locale } = useI18n();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const day = (DAYS.find((d) => d.id === params.get('day'))?.id ?? DAYS[1]!.id) as DayId;
  const stage = params.get('stage') ?? 'all';
  const mine = params.get('mine') === '1';

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };

  const daySessions = SESSIONS.filter((s) => s.day === day);
  const stagesToday = STAGES.filter((st) => daySessions.some((s) => s.stageId === st.id));
  const visible = daySessions
    .filter((s) => stage === 'all' || s.stageId === stage)
    .filter((s) => !mine || state.favorites.includes(s.id))
    .sort((a, b) => a.start.localeCompare(b.start) || STAGES.findIndex((x) => x.id === a.stageId) - STAGES.findIndex((x) => x.id === b.stageId));

  const byStart = new Map<string, typeof visible>();
  visible.forEach((s) => byStart.set(s.start, [...(byStart.get(s.start) ?? []), s]));
  const groups = [...byStart.entries()];

  return (
    <>
      <TopBar title={t('agenda.title')} />
      <main className="screen">
        <div className="day-tabs pad-x" role="tablist">
          {DAYS.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === day}
              className={`day-tab${d.id === day ? ' on' : ''}`}
              onClick={() => update({ day: d.id, stage: null })}
            >
              <img src={asset(d.image)} alt="" />
              <span>{fmtDay(`${d.id}T12:00:00Z`, locale)}</span>
            </button>
          ))}
        </div>

        <div className="chips pad-x">
          <Chip active={mine} onClick={() => update({ mine: mine ? null : '1' })}>
            <Star size={14} fill={mine ? 'currentColor' : 'none'} /> {t('agenda.favOnly')}
          </Chip>
          <Chip active={stage === 'all'} onClick={() => update({ stage: null })}>
            {t('common.all')}
          </Chip>
          {stagesToday.map((st) => (
            <Chip key={st.id} color={st.color} active={stage === st.id} onClick={() => update({ stage: st.id })}>
              {st.name}
            </Chip>
          ))}
        </div>

        <div className="pad-x">
          <DemoNote />
          {groups.length === 0 && <Empty>{t('agenda.empty')}</Empty>}
          {groups.map(([start, items]) => (
            <section key={start} className="time-group">
              <h2 className="time-label">{fmtTime(start, locale)}</h2>
              <div className="list">
                {items.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
