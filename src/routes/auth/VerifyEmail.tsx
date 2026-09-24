import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, errorText } from "../../lib/api";
import { useSession } from "../../lib/session";
import { AuthLayout } from "./AuthLayout";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { status, reloadMe } = useSession();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) {
      setState("error");
      setError("This link has no token in it.");
      return;
    }
    api("/auth/verify-email", { body: { token }, auth: false })
      .then(() => {
        setState("done");
        if (status === "ready") void reloadMe();
      })
      .catch((err) => {
        setState("error");
        setError(errorText(err));
      });
  }, [params, status, reloadMe]);
  return (
    <AuthLayout
      title={state === "working" ? "Confirming…" : state === "done" ? "Email confirmed." : "That link didn't work."}
      subtitle={state === "done" ? "Social features are unlocked." : state === "error" ? `${error} Links expire after a day; you can send a new one from Settings.` : undefined}
      footer={<Link to="/" className="font-semibold text-accent-text">Open PaceStreak</Link>}
    />
  );
}
