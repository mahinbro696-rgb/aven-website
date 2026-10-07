"use client";

import { AdminThemeToggle } from "@/components/admin/AdminTheme";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { browserSessionPersistence, getIdTokenResult, onIdTokenChanged, setPersistence, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminIcon from "./AdminIcon";
import { ADMIN_IDLE_MS, adminRecordAllowed, adminSessionFresh, withAdminDeadline } from "@/lib/admin-security";

type State =
  | { status: "checking"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "ready"; user: User; authenticatedAt: number };

export default function AdminAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "checking", user: null });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lockEpoch = useRef(0);
  const sessionLocked = useRef(false);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let stopAuth: (() => void) | undefined;
    let stopAccess: (() => void) | undefined;
    const deny = (reason: string) => {
      generation++;
      lockEpoch.current++;
      sessionLocked.current = true;
      stopAccess?.();
      stopAccess = undefined;
      if (!active) return;
      setState({ status: "signed-out", user: null });
      setMessage(reason);
      void signOut(auth).catch(() => { /* UI remains locked even if cleanup fails. */ });
    };
    void setPersistence(auth, browserSessionPersistence).then(() => {
      if (!active) return;
      stopAuth = onIdTokenChanged(auth, (user) => {
        const current = ++generation;
        const epoch = lockEpoch.current;
        stopAccess?.();
        stopAccess = undefined;
        if (!user) {
          setState({ status: "signed-out", user: null });
          return;
        }
        if (sessionLocked.current) { deny("সেশন লক করা হয়েছে। আবার sign in করুন।"); return; }
        setState({ status: "checking", user: null });
        void (async () => {
          try {
            const [token, snapshot] = await withAdminDeadline(Promise.all([
              getIdTokenResult(user),
              getDocFromServer(doc(db, "admins", user.uid)),
            ]));
            if (!active || current !== generation || epoch !== lockEpoch.current || auth.currentUser?.uid !== user.uid) return;
            const authenticatedAt = Date.parse(token.authTime);
            if (!adminSessionFresh(authenticatedAt) || !snapshot.exists() || !adminRecordAllowed(snapshot.data())) {
              deny("এই সেশন অনুমোদিত নয় অথবা মেয়াদ শেষ হয়েছে। আবার sign in করুন।");
              return;
            }
            setState({ status: "ready", user, authenticatedAt });
            setMessage("");
            stopAccess = onSnapshot(doc(db, "admins", user.uid), { includeMetadataChanges: true }, (record) => {
              if (!active || current !== generation || record.metadata.fromCache) return;
              if (!record.exists() || !adminRecordAllowed(record.data())) deny("অ্যাডমিন অনুমতি প্রত্যাহার করা হয়েছে।");
            }, () => {
              if (active && current === generation) deny("অ্যাডমিন অনুমতি নিশ্চিত করা যাচ্ছে না। আবার sign in করুন।");
            });
          } catch {
            if (active && current === generation) deny("অ্যাডমিন অনুমতি যাচাই করা যায়নি। সংযোগ যাচাই করে আবার sign in করুন।");
          }
        })();
      }, () => deny("সেশন যাচাই করা যায়নি। আবার sign in করুন।"));
    }).catch(() => deny("এই ব্রাউজারে নিরাপদ সেশন তৈরি করা যাচ্ছে না।"));
    return () => { active = false; generation++; stopAuth?.(); stopAccess?.(); };
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    let lastActivity = Date.now();
    let locked = false;
    const lock = () => {
      if (locked) return;
      locked = true;
      lockEpoch.current++;
      sessionLocked.current = true;
      setState({ status: "signed-out", user: null });
      setMessage("নিরাপত্তার জন্য সেশন শেষ হয়েছে। আবার sign in করুন।");
      void signOut(auth).catch(() => { /* Keep private content unmounted. */ });
    };
    const check = () => {
      if (Date.now() - lastActivity >= ADMIN_IDLE_MS || !adminSessionFresh(state.authenticatedAt)) { lock(); return false; }
      return !locked;
    };
    const activity = () => { if (check() && !document.hidden) lastActivity = Date.now(); };
    const visible = () => { if (!document.hidden) check(); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((name) => window.addEventListener(name, activity, { passive: true, capture: true }));
    window.addEventListener("focus", check);
    window.addEventListener("offline", lock);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(check, 5000);
    return () => {
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, activity, true));
      window.removeEventListener("focus", check);
      window.removeEventListener("offline", lock);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [state]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      await setPersistence(auth, browserSessionPersistence);
      sessionLocked.current = false;
      await signInWithEmailAndPassword(auth, email, password);
      // The token observer verifies the server-side admin record before mounting children.
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      setMessage(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
          ? "Email অথবা password সঠিক নয়।"
          : code.includes("too-many-requests")
            ? "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
            : "Sign in করা যায়নি। Firebase Email/Password sign-in enabled আছে কিনা যাচাই করুন।"
      );
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "checking") {
    return <main className="av-admin-login"><div className="av-admin-login-card"><p className="av-admin-login-brand">AVEN</p><span className="av-admin-login-loader" /><p>Admin access যাচাই হচ্ছে…</p></div></main>;
  }

  if (state.status === "signed-out") {
    return <main className="av-admin-login av-admin-login-split">
      <aside className="av-admin-login-story">
        <Link href="/" className="av-admin-login-wordmark">AVEN<span>THE STORE WORKSPACE</span></Link>
        <div className="av-admin-login-editorial"><p>A LITTLE MORE EFFORTLESS.</p><h2>Behind every<br /> beautiful<br /> <em>collection.</em></h2><span>আপনার স্টোর পরিচালনার প্রতিটি কাজ,<br />একটি সুন্দর ও সহজ জায়গায়।</span></div>
        <div className="av-admin-login-story-foot"><AdminIcon name="shield" /><span>Private access. Complete control.</span></div>
      </aside>
      <section className="av-admin-login-card"><div className="av-admin-login-theme"><AdminThemeToggle /></div>
        <span className="av-admin-login-emblem"><AdminIcon name="shield" /></span>
        <p className="av-admin-login-kicker">AVEN / STORE CONTROL</p>
        <h1>Admin sign in</h1>
        <p>Products, categories এবং orders manage করতে authorized account দিয়ে sign in করুন।</p>
        <form onSubmit={(event) => void submit(event)} className="av-admin-login-form">
          <label>Email address<input name="email" type="email" required autoComplete="username" placeholder="admin@example.com" /></label>
          <label>Password<input name="password" type="password" required minLength={6} autoComplete="current-password" placeholder="••••••••" /></label>
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"}</button>
        </form>
        {message && <div className="av-admin-login-message" role="alert">{message}</div>}
        <small>সেশন শুধু এই ট্যাবে থাকবে। ১০ মিনিট নিষ্ক্রিয় থাকলে অটো লগআউট হবে।</small>
        <Link className="av-admin-login-back" href="/">Storefront-এ ফিরে যান ↗</Link>
      </section>
    </main>;
  }

  return <>{children}</>;
}
