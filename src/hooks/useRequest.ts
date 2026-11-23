import { useEffect, useState } from 'react';

type Result<T> = { status: 'ready'; data: T } | { status: 'error' };
export type RequestState<T> = Result<T> | { status: 'loading' };

export function useRequest<T>(load: ((signal: AbortSignal) => Promise<T>) | null): RequestState<T> {
  const [result, setResult] = useState<{ load: typeof load; state: Result<T> }>();

  useEffect(() => {
    if (!load) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ load, state: { status: 'ready', data } });
      },
      () => {
        if (!controller.signal.aborted) setResult({ load, state: { status: 'error' } });
      },
    );
    return () => controller.abort();
  }, [load]);

  return result?.load === load ? result.state : { status: 'loading' };
}
