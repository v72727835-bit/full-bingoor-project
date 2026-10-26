import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `fn` every `ms`, but only while the app is in the foreground (rider
 * audit Issue 3). Background polling drained the battery and kept the cellular
 * radio awake for nothing; when the rider reopens the app we fetch immediately
 * and resume. Live GPS during an active delivery is handled separately.
 */
export function useForegroundPoll(fn: () => void, ms: number): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      fnRef.current();
      timer = setInterval(() => fnRef.current(), ms);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [ms]);
}
