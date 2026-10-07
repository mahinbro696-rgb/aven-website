"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useProductUploads() {
  const pending = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  const track = useCallback((key: string, busy: boolean) => {
    if (busy) pending.current.add(key); else pending.current.delete(key);
    setUploading(pending.current.size > 0);
  }, []);
  return { uploading, track, pending };
}
export function useAdminDraftGuard(dirty: boolean, busy: boolean) {
  useEffect(() => {
    const leave = (event: Event) => {
      if (busy || (dirty && !window.confirm("সংরক্ষণ না করা পরিবর্তন আছে। সেগুলো বাদ দিয়ে অন্য section-এ যাবেন?"))) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("aven:admin-leave", leave); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("aven:admin-leave", leave); window.removeEventListener("beforeunload", unload); };
  }, [dirty, busy]);
}
export function canLeaveAdminDraft() { return window.dispatchEvent(new Event("aven:admin-leave", { cancelable: true })); }
