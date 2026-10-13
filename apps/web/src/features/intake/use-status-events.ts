import { STATUS_EVENT_NAME, statusEventSchema, type StatusEvent } from '@image-intake/shared';
import { useEffect, useRef } from 'react';

interface StatusEventHandlers {
  onStatus: (event: StatusEvent) => void;
  /** Events sent while disconnected are gone for good, so the caller should refetch. */
  onReconnect: () => void;
}

export function useStatusEvents(enabled: boolean, handlers: StatusEventHandlers): void {
  // kept in a ref so new handler identities don't tear down the connection
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource('/api/images/events');
    let disconnected = false;

    source.addEventListener(STATUS_EVENT_NAME, (message) => {
      const parsed = statusEventSchema.safeParse(JSON.parse(String(message.data)));
      if (parsed.success) handlersRef.current.onStatus(parsed.data);
    });
    source.addEventListener('error', () => {
      disconnected = true;
    });
    source.addEventListener('open', () => {
      if (disconnected) handlersRef.current.onReconnect();
      disconnected = false;
    });

    return () => {
      source.close();
    };
  }, [enabled]);
}
