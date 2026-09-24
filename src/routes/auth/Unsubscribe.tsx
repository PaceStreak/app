import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";

// Deliberately a button, not an automatic request on page load: mail
// scanners prefetch links, and a prefetch must not change anyone's settings.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    try {
      const res = await api<{ detail: string }>("/notifications/unsubscribe", {
        body: { u: params.get("u"), c: params.get("c"), s: params.get("s") },
        auth: false,
      });
      setResult(res.detail);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <AuthLayout
      title={result ? "Unsubscribed." : "Stop these emails?"}
      subtitle={result ?? error ?? "You can turn any category back on in Settings, Notifications."}
      footer={<Link to="/settings/notifications" className="font-semibold text-accent-text">Notification settings</Link>}
    >
      {!result && (
        <button type="button" className="btn btn-primary w-full" onClick={run}>
          Unsubscribe
        </button>
      )}
    </AuthLayout>
  );
}
