import { useEffect, useState } from 'react';

/** Current timestamp that refreshes every `intervalMs`, so relative times ("2 minutes ago") stay accurate. */
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
};
