import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LogSheet } from "../routes/log/LogSheet";

export interface LogRequest {
  discipline?: string;
  /** "yesterday" etc. pre-selects when it happened. */
  when?: string;
}

const Ctx = createContext<{ openLog: (req?: LogRequest) => void } | null>(null);

/** One log sheet for the whole app, openable from the tab bar, any coach
 * card, a keyboard shortcut or the /log route. */
export function LogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<LogRequest | null>(null);
  const openLog = useCallback((req: LogRequest = {}) => setRequest(req), []);
  const value = useMemo(() => ({ openLog }), [openLog]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <LogSheet request={request} onClose={() => setRequest(null)} />
    </Ctx.Provider>
  );
}

export function useLog() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useLog outside LogProvider");
  return value;
}
