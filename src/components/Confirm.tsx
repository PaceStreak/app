import { useCallback, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./Sheet";

interface Ask {
  title: string;
  body?: ReactNode;
  confirm: string;
  danger?: boolean;
}

/** const [confirmSheet, ask] = useConfirm(); if (await ask({...})) ... */
export function useConfirm(): [ReactNode, (a: Ask) => Promise<boolean>] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const open = useCallback(
    (a: Ask) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setAsk(a);
      }),
    [],
  );
  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = undefined;
    setAsk(null);
  };
  const element = (
    <Sheet
      open={ask !== null}
      onClose={() => close(false)}
      title={ask?.title}
      footer={
        <>
          <button type="button" className="btn btn-secondary flex-1" onClick={() => close(false)}>
            Cancel
          </button>
          <button type="button" className={`btn flex-1 ${ask?.danger ? "btn-danger" : "btn-primary"}`} onClick={() => close(true)} autoFocus>
            {ask?.confirm}
          </button>
        </>
      }
    >
      {ask?.body && <div className="text-muted">{ask.body}</div>}
    </Sheet>
  );
  return [element, open];
}
