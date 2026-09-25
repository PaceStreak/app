/**
 * Passkeys (WebAuthn) in the browser.
 *
 * The API speaks the standard JSON shape (base64url everywhere). Browsers
 * that have PublicKeyCredential.parse*OptionsFromJSON and credential.toJSON()
 * could do the conversion themselves, but support is still uneven, so this
 * does it by hand - a few lines, and identical on every browser.
 */

import { ApiError, api } from "./api";

type Json = Record<string, unknown>;
type Ceremony = { challenge_id: string; options: Json };
type Tokens = { access_token: string; expires_in: number; csrf_token?: string };

export interface Passkey {
  id: string;
  name: string;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

/** Autofill-style sign-in: passkeys offered in the email field's dropdown. */
export async function conditionalSupported(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    return (await PublicKeyCredential.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    return false;
  }
}

export function fromB64url(value: string): ArrayBuffer {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function toB64url(buf: ArrayBuffer | ArrayBufferView | null | undefined): string {
  if (!buf) return "";
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type Descriptor = { id: string; type: string; transports?: string[] };

function descriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return (list as Descriptor[]).map((d) => ({
    id: fromB64url(d.id),
    type: "public-key",
    transports: d.transports as AuthenticatorTransport[] | undefined,
  }));
}

export function creationOptions(o: Json): PublicKeyCredentialCreationOptions {
  const user = o.user as { id: string; name: string; displayName: string };
  return {
    ...(o as unknown as PublicKeyCredentialCreationOptions),
    challenge: fromB64url(o.challenge as string),
    user: { ...user, id: fromB64url(user.id) },
    excludeCredentials: descriptors(o.excludeCredentials),
  };
}

export function requestOptions(o: Json): PublicKeyCredentialRequestOptions {
  return {
    ...(o as unknown as PublicKeyCredentialRequestOptions),
    challenge: fromB64url(o.challenge as string),
    allowCredentials: descriptors(o.allowCredentials),
  };
}

export function registrationJson(cred: PublicKeyCredential): Json {
  const r = cred.response as AuthenticatorAttestationResponse;
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      attestationObject: toB64url(r.attestationObject),
      transports: r.getTransports?.() ?? [],
    },
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
  };
}

export function assertionJson(cred: PublicKeyCredential): Json {
  const r = cred.response as AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: toB64url(r.clientDataJSON),
      authenticatorData: toB64url(r.authenticatorData),
      signature: toB64url(r.signature),
      userHandle: r.userHandle ? toB64url(r.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
  };
}

/** A person closing the browser's passkey sheet is not an error worth showing. */
export function wasCancelled(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError");
}

export async function addPasskey(password: string, name?: string): Promise<Passkey> {
  const start = await api<Ceremony>("/auth/passkeys/register/options", { body: { password } });
  const cred = (await navigator.credentials.create({ publicKey: creationOptions(start.options) })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("No passkey was created", "NotAllowedError");
  return api<Passkey>("/auth/passkeys/register", {
    body: { challenge_id: start.challenge_id, credential: registrationJson(cred), name: name || undefined },
  });
}

/**
 * Sign in with a passkey. With `conditional`, the request waits quietly for
 * the person to pick a passkey from the email field's autofill list; abort it
 * through `signal` when the page changes.
 */
export async function signInWithPasskey(opts: { conditional?: boolean; signal?: AbortSignal } = {}): Promise<Tokens> {
  const start = await api<Ceremony>("/auth/passkeys/sign-in/options", { method: "POST", auth: false, signal: opts.signal });
  const cred = (await navigator.credentials.get({
    publicKey: requestOptions(start.options),
    mediation: opts.conditional ? "conditional" : "optional",
    signal: opts.signal,
  })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException("No passkey was chosen", "NotAllowedError");
  try {
    return await api<Tokens>("/auth/passkeys/sign-in", {
      body: { challenge_id: start.challenge_id, credential: assertionJson(cred) },
      auth: false,
    });
  } catch (err) {
    // A passkey the server no longer knows (removed on another device) should
    // be removed from this one too, where the browser supports saying so.
    if (err instanceof ApiError && err.status === 401) {
      const pkc = PublicKeyCredential as unknown as { signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void> };
      const rpId = (start.options.rpId as string) ?? location.hostname;
      void pkc.signalUnknownCredential?.({ rpId, credentialId: cred.id }).catch(() => {});
    }
    throw err;
  }
}
