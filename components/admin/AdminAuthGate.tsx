"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminIcon from "./AdminIcon";

type State =
  | { status: "checking"; user: null }
  | { status: "signed-out"; user: null }
  | { status: "forbidden"; user: User }
  | { status: "ready"; user: User };

async function isAuthorized(user: User) {
  const snapshot = await getDoc(doc(db, "admins", user.uid));
  return snapshot.exists() && snapshot.data().active !== false;
}

export default function AdminAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "checking", user: null });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    setMessage("");
    if (!user) {
      setState({ status: "signed-out", user: null });
      return;
    }
    try {
      const allowed = await isAuthorized(user);
      setState(allowed ? { status: "ready", user } : { status: "forbidden", user });
    } catch {
      setMessage("Admin permission যাচাই করা যায়নি। আবার চেষ্টা করুন।");
      setState({ status: "forbidden", user });
    }
  }), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const allowed = await isAuthorized(credential.user);
      if (!allowed) {
        setState({ status: "forbidden", user: credential.user });
        setMessage("এই account-টি AVEN admin হিসেবে অনুমোদিত নয়।");
      }
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

  async function leave() {
    setBusy(true);
    try { await signOut(auth); }
    finally { setBusy(false); }
  }

  if (state.status === "checking") {
    return <main className="av-admin-login"><div className="av-admin-login-card"><p className="av-admin-login-brand">AVEN</p><span className="av-admin-login-loader" /><p>Admin access যাচাই হচ্ছে…</p></div></main>;
  }

  if (state.status === "signed-out") {
    return <main className="av-admin-login av-admin-login-split">
      <aside className="av-admin-login-story">
        <Link href="/" className="av-admin-login-wordmark">AVEN<span>THE STORE WORKSPACE</span></Link>
        <div className="av-admin-login-editorial"><p>A LITTLE MORE EFFORTLESS.</p><h2>Behind every<br />beautiful<br /><em>collection.</em></h2><span>আপনার স্টোর পরিচালনার প্রতিটি কাজ,<br />একটি সুন্দর ও সহজ জায়গায়।</span></div>
        <div className="av-admin-login-story-foot"><AdminIcon name="shield" /><span>Private access. Complete control.</span></div>
      </aside>
      <section className="av-admin-login-card">
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
        <small>শুধুমাত্র অনুমোদিত অ্যাডমিনের জন্য সুরক্ষিত প্রবেশ।</small>
        <Link className="av-admin-login-back" href="/">Storefront-এ ফিরে যান ↗</Link>
      </section>
    </main>;
  }

  if (state.status === "forbidden") {
    return <main className="av-admin-login">
      <section className="av-admin-login-card">
        <p className="av-admin-login-kicker">ACCESS RESTRICTED</p>
        <h1>Admin permission নেই</h1>
        <p>{state.user.email || "এই account"} sign in করেছে, কিন্তু <code>admins/{state.user.uid}</code> authorization record পাওয়া যায়নি।</p>
        {message && <div className="av-admin-login-message" role="alert">{message}</div>}
        <button className="av-admin-login-secondary" type="button" disabled={busy} onClick={() => void leave()}>অন্য account দিয়ে sign in</button>
      </section>
    </main>;
  }

  return <>{children}</>;
}
