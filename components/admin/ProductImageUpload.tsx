"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { prepareProductImage } from "@/lib/prepare-product-image";

export default function ProductImageUpload({ label, disabled = false, onUploaded, onBusy }: { label: string; disabled?: boolean; onUploaded: (url: string) => void; onBusy: (busy: boolean) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const onBusyRef = useRef(onBusy);
  useEffect(() => { onBusyRef.current = onBusy; }, [onBusy]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => { ++generation.current; xhr.current?.abort(); if (active.current) onBusyRef.current(false); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function upload(file: File) {
    if (active.current || disabled) return;
    active.current = true; const ticket = ++generation.current;
    setBusy(true); onBusyRef.current(true); setMessage(""); setFailed(false); setProgress(0); setPhase("ছবি প্রস্তুত হচ্ছে…");
    try {
      const prepared = await prepareProductImage(file);
      if (ticket !== generation.current) return;
      setPreview(URL.createObjectURL(prepared));
      const user = auth.currentUser; if (!user) throw new Error("আবার admin sign in করুন।");
      const token = await user.getIdToken();
      if (ticket !== generation.current) return;
      setPhase("Upload হচ্ছে…");
      const result = await new Promise<{ url: string; message?: string }>((resolve, reject) => {
        const request = new XMLHttpRequest(); xhr.current = request;
        request.open("POST", "/api/admin/images"); request.timeout = 60_000;
        request.setRequestHeader("Authorization", `Bearer ${token}`); request.setRequestHeader("Content-Type", prepared.type);
        request.upload.onprogress = (event) => { if (ticket === generation.current && event.lengthComputable) { setProgress(Math.round(event.loaded / event.total * 100)); if (event.loaded === event.total) setPhase("Cloudinary-তে সংরক্ষণ হচ্ছে…"); } };
        request.onload = () => {
          let value: { url?: string; message?: string }; try { value = JSON.parse(request.responseText); } catch { reject(new Error("Upload-এর উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।")); return; }
          if (request.status >= 200 && request.status < 300 && value.url?.startsWith("https://res.cloudinary.com/")) resolve({ url: value.url, message: value.message });
          else reject(new Error(value.message || "Upload হয়নি। Settings-এ Cloudinary connection যাচাই করুন।"));
        };
        request.onerror = request.ontimeout = () => reject(new Error("Upload-এর উত্তর পাওয়া যায়নি। Cloudinary Media Library দেখে আবার চেষ্টা করুন।"));
        request.onabort = () => reject(new Error("Upload বাতিল হয়েছে।"));
        request.send(prepared);
      });
      if (ticket !== generation.current) return;
      onUploaded(result.url); setProgress(100); setMessage(result.message || "ছবি upload হয়েছে। এখন product save করুন।");
    } catch (error) { if (ticket === generation.current) { setFailed(true); setMessage(error instanceof Error ? error.message : "Upload হয়নি। আবার চেষ্টা করুন।"); } }
    finally { if (ticket === generation.current) { active.current = false; xhr.current = null; setBusy(false); onBusyRef.current(false); } }
  }
  function cancel() { ++generation.current; xhr.current?.abort(); xhr.current = null; active.current = false; setBusy(false); onBusyRef.current(false); setPreview(""); setProgress(0); setMessage("Upload বাতিল হয়েছে; product-এর আগের ছবিই রাখা আছে।"); setFailed(false); }
  return <div className={"av-image-upload " + (dragging ? "is-dragging " : "") + (failed ? "has-error" : "")} onDragOver={(event) => { event.preventDefault(); if (!busy && !disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (busy || disabled) return; if (event.dataTransfer.files.length > 1) { setMessage("একবারে একটি ছবি দিন।"); setFailed(true); return; } const file = event.dataTransfer.files[0]; if (file) void upload(file); }}>
    <input id={id} ref={input} className="av-image-upload-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} aria-label={label + " file"} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    {preview && <Image className="av-image-upload-preview" src={preview} alt="Selected image preview" width={72} height={80} unoptimized />}
    <div className="av-image-upload-content"><strong>{label}</strong><small>JPG / PNG / WebP · সর্বোচ্চ 15 MB · টেনে আনুন অথবা ছবি বাছাই করুন</small>
      {busy && <div className="av-image-upload-progress"><span role="progressbar" aria-label="Image upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: progress + "%" }} /></span><small>{phase} {progress > 0 ? progress + "%" : ""}</small></div>}
      {message && <p className={failed ? "is-error" : "is-success"} role={failed ? "alert" : "status"}>{message}</p>}
    </div>
    {busy ? <button type="button" className="av-admin-action" onClick={cancel}>Cancel upload</button> : <button type="button" className="av-admin-action" disabled={disabled} onClick={() => input.current?.click()}>{failed ? "Try another image" : "Upload image"}</button>}
  </div>;
}
