import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLog } from "../../shell/LogContext";

/** /log exists for the home-screen shortcut and deep links: it opens the
 * log sheet over Today rather than being a screen of its own. */
export default function LogPage() {
  const { openLog } = useLog();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    navigate("/", { replace: true });
    openLog({ discipline: params.get("discipline") ?? undefined });
  }, [navigate, openLog, params]);
  return null;
}
