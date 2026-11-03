import { useEffect, useState } from 'react';

export function useCountdown(targetIso: string) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  return {
    done: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}
