import { useEffect, useState } from 'react';

type Result<T> = { status: 'ready'; data: T } | { status: 'error' };

/** Асинхронная загрузка с отменой запроса, та же модель состояний, что и в каталоге. */
export function useCommunityRequest<T>(load: (signal: AbortSignal) => Promise<T>): Result<T> | { status: 'loading' } {
  const [result, setResult] = useState<{ load: typeof load; state: Result<T> }>();

  useEffect(() => {
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
