"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { auth } from "@/lib/firebase";
import type { CloudinaryStatus } from "@/lib/cloudinary-integration";

type Reply = { status?: CloudinaryStatus; receipt?: string; expiresAt?: number; message?: string; error?: string };
type Verification = { receipt: string; expiresAt: number };
const labels = { setup_required: "Setup required", disconnected: "Disconnected", connected: "Connected", error: "Connection issue" };

async function requestConnection(data?: Record<string, unknown>): Promise<Reply> {
  const user = auth.currentUser;
  if (!user) throw new Error("অ্যাডমিন অ্যাকাউন্টে আবার sign in করুন।");
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch("/api/admin/cloudinary", { method: data ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
      headers: { Authorization: `Bearer ${token}`, ...(data ? { "Content-Type": "application/json" } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(45_000),
    });
  } catch { throw new Error("সংযোগ যাচাই হচ্ছে না। ইন্টারনেট দেখে আবার চেষ্টা করুন।"); }
  let reply: Reply;
  try { reply = await response.json() as Reply; }
  catch { throw new Error("সার্ভারের উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।"); }
  if (!response.ok) throw new Error(reply.message || "সংযোগ যাচাই করা যায়নি।");
  return reply;
}

export default function CloudinarySettings() {
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState<CloudinaryStatus | null>(null);
  const [cloudName, setCloudName] = useState("pcprovqw");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [busy, setBusy] = useState<string | null>("loading");
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [copied, setCopied] = useState(false);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const working = useRef(false);
  const edited = useRef(false);

  const refresh = useCallback(async () => {
    if (working.current || document.hidden) return;
    const ticket = ++sequence.current;
    try {
      const reply = await requestConnection();
      if (!mounted.current || ticket !== sequence.current || !reply.status) return;
      setStatus(reply.status);
      if (!edited.current && reply.status.cloudName) setCloudName(reply.status.cloudName);
    } catch (error) {
      if (!mounted.current || ticket !== sequence.current) return;
      setStatus((current) => ({ ...current, state: "error", configured: current?.configured || false, encryptionReady: current?.encryptionReady || false,
        message: error instanceof Error ? error.message : "সংযোগ যাচাই করা যায়নি।" }));
    } finally { if (mounted.current && ticket === sequence.current) setBusy(null); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);

  useEffect(() => {
    if (!verification) return;
    const timer = window.setTimeout(() => {
      setVerification(null); setNotice("Verification-এর সময় শেষ হয়েছে। আবার Verify করুন।"); setFailed(true);
    }, Math.max(0, verification.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [verification]);

  function edit() { edited.current = true; setVerification(null); setNotice(""); setFailed(false); }
  async function act(action: "verify" | "connect" | "disconnect" | "reconnect") {
    if (working.current || busy) return;
    if (action === "connect" && (!verification || verification.expiresAt <= Date.now())) { setVerification(null); return; }
    working.current = true;
    const ticket = ++sequence.current;
    setBusy(action); setNotice(""); setFailed(false);
    try {
      const payload = action === "verify" ? { action, cloudName, apiKey, apiSecret }
        : action === "connect" ? { action, receipt: verification?.receipt } : { action };
      const reply = await requestConnection(payload);
      if (!mounted.current || ticket !== sequence.current) return;
      if (action === "verify" && reply.receipt && reply.expiresAt) {
        setVerification({ receipt: reply.receipt, expiresAt: reply.expiresAt }); setApiSecret(""); setShowSecret(false);
      } else if (reply.status) {
        setStatus(reply.status); setVerification(null); setApiSecret(""); setApiKey(""); setShowSecret(false);
      }
      setNotice(reply.message || reply.status?.message || "সম্পন্ন হয়েছে।");
    } catch (error) {
      if (!mounted.current || ticket !== sequence.current) return;
      const message = error instanceof Error ? error.message : "আবার চেষ্টা করুন।";
      setNotice(message); setFailed(true);
      if (action === "verify") setVerification(null);
      if (action === "reconnect" || action === "connect") {
        setStatus((current) => ({ ...current, state: "error", configured: current?.configured || false, encryptionReady: current?.encryptionReady || false, message }));
      }
    } finally { working.current = false; if (mounted.current && ticket === sequence.current) setBusy(null); }
  }

  async function copySetupKey() {
    try { await navigator.clipboard.writeText(setupKey); setCopied(true); }
    catch { setNotice("Copy করা যায়নি। Key select করে manually copy করুন।"); setFailed(true); }
  }

  const connectionError = status?.state === "error";
  const setup = status?.state === "setup_required";
  const ready = status?.encryptionReady === true;
  return <section className={"av-cloudinary " + (connectionError || failed ? "has-error" : "")} aria-labelledby="cloudinary-title">
    <div className="av-cloudinary-head">
      <div className="av-cloudinary-brand"><span className="av-cloudinary-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M9 24h15a6 6 0 0 0 0-12 8 8 0 0 0-15-2 7 7 0 0 0 0 14Z" stroke="currentColor" strokeWidth="1.7" /><path d="m13 17 3-3 3 3m-3-3v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><p>MEDIA INTEGRATION</p><h3 id="cloudinary-title">Cloudinary</h3></div></div>
      <span className={"av-cloudinary-badge is-" + (status?.state || "loading")} role="status"><i />{busy === "loading" ? "Checking…" : status ? labels[status.state] : "Checking…"}</span>
    </div>
    <p className="av-cloudinary-intro">আপনার Cloudinary account এক জায়গা থেকে Verify, Connect এবং Disconnect করুন।</p>
    <div className={"av-cloudinary-status is-" + (status?.state || "loading")} aria-live="polite">
      <span aria-hidden="true">{connectionError ? "!" : status?.state === "connected" ? "✓" : "○"}</span>
      <div><strong>{status?.message || "সংযোগের অবস্থা যাচাই করা হচ্ছে…"}</strong>
        {status?.cloudName && <small>Cloud: {status.cloudName} · API Key: {status.maskedKey}{status.checkedAt ? " · Checked " + new Date(status.checkedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}</small>}
      </div>
      {connectionError && <button className="av-admin-action" type="button" disabled={!!busy} onClick={() => status?.configured ? void act("reconnect") : void refresh()}>{busy === "reconnect" ? "Reconnecting…" : status?.configured ? "Reconnect" : "Retry"}</button>}
    </div>

    {setup && <div className="av-cloudinary-setup">
      <strong>একবার server setup করুন</strong>
      <p>নিচে একটি encryption key তৈরি করুন। Vercel → এই project → Settings → Environment Variables-এ <code>CLOUDINARY_INTEGRATION_KEY</code> নামে বসান। Preview ও Production select করে save ও redeploy করুন, তারপর Refresh status চাপুন।</p>
      <p>এই key নিরাপদে রাখুন। পরে key বদলালে Cloudinary আবার Verify ও Connect করতে হবে।</p>
      <div className="av-cloudinary-actions"><button type="button" className="av-admin-action" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(32)); setSetupKey(Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")); setCopied(false); }}>Generate encryption key</button><button type="button" className="av-admin-action" disabled={!!busy} onClick={() => void refresh()}>Refresh status</button></div>
      {setupKey && <div className="av-cloudinary-key"><input type="password" aria-label="Generated encryption key" value={setupKey} readOnly onFocus={(event) => event.target.select()} /><button className="av-admin-action" type="button" onClick={() => void copySetupKey()}>{copied ? "Copied ✓" : "Copy key"}</button></div>}
    </div>}

    <form className="av-cloudinary-form" autoComplete="off" onSubmit={(event) => { event.preventDefault(); void act("verify"); }}>
      <div className="av-cloudinary-fields">
        <label>Cloud name<input value={cloudName} disabled={!!busy || !ready} onChange={(event) => { edit(); setCloudName(event.target.value); }} placeholder="pcprovqw" autoCapitalize="none" spellCheck={false} maxLength={100} required /></label>
        <label>API Key<input value={apiKey} disabled={!!busy || !ready} onChange={(event) => { edit(); setApiKey(event.target.value); }} placeholder="Enter API Key" autoCapitalize="none" spellCheck={false} inputMode="numeric" maxLength={30} required /></label>
        <div className="av-cloudinary-field"><label htmlFor="cloudinary-api-secret">API Secret</label><div className="av-cloudinary-secret"><input id="cloudinary-api-secret" type={showSecret ? "text" : "password"} value={apiSecret} disabled={!!busy || !ready} onChange={(event) => { edit(); setApiSecret(event.target.value); }} placeholder={verification ? "Verified securely" : "Enter API Secret"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={200} required={!verification} /><button type="button" disabled={!!busy || !ready} aria-label={showSecret ? "Hide API Secret" : "Show API Secret"} aria-pressed={showSecret} onClick={() => setShowSecret((value) => !value)}>{showSecret ? "Hide" : "Show"}</button></div></div>
      </div>
      <div className="av-cloudinary-flow" aria-label="Connection steps"><span className={verification ? "is-done" : ""}><b>1</b> Verify credentials</span><i aria-hidden="true">→</i><span className={status?.state === "connected" ? "is-done" : ""}><b>2</b> Connect account</span></div>
      <AnimatePresence initial={false}>{notice && <motion.div key={notice} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={"av-cloudinary-notice " + (failed ? "is-error" : "is-success")} role={failed ? "alert" : "status"}>{notice}</motion.div>}</AnimatePresence>
      <div className="av-cloudinary-footer"><div className="av-cloudinary-actions">
        <button className="av-admin-action" type="submit" disabled={!!busy || !ready || !cloudName.trim() || !apiKey.trim() || !apiSecret.trim()}>{busy === "verify" ? "Verifying…" : verification ? "Verified ✓" : "Verify"}</button>
        <button className="av-admin-action primary" type="button" disabled={!!busy || !ready || !verification} onClick={() => void act("connect")}>{busy === "connect" ? "Connecting…" : "Connect"}</button>
        {status?.configured && <button className="av-admin-action danger" type="button" disabled={!!busy} onClick={() => void act("disconnect")}>{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</button>}
      </div><span className="av-cloudinary-security">✓ Secret encrypted on server</span></div>
    </form>
    <p className="av-cloudinary-footnote">Disconnect করলে সংরক্ষিত connection মুছে যাবে; আগের uploaded ছবিগুলো Cloudinary account-এ থাকবে। Settings খোলা থাকলে প্রতি মিনিটে connection status যাচাই হবে।</p>
  </section>;
}
