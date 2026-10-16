"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "worknest:install-dismissed";

/** True when the app is not installed yet and the user has not closed the banner. */
function canOffer() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  try {
    return !standalone && localStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return !standalone;
  }
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

const noSubscribe = () => () => {};

/** Registers /sw.js so the app can be installed and shows an offline page. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Dev build files are not content-hashed, so a cache would serve stale code.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/**
 * Phone-only bar inviting the user to add WorkNest to the home screen.
 * Android / Chrome get a one-tap install button; iPhone Safari has no install
 * API, so it gets the Share → Add to Home Screen steps instead.
 */
export function InstallBanner() {
  // Read once on the client; the server render never shows the banner.
  const iosHint = useSyncExternalStore(noSubscribe, () => isIos() && canOffer(), () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (canOffer()) setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode = closed ? null : deferred ? "prompt" : iosHint ? "ios" : null;
  if (!mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setClosed(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setClosed(true);
  }

  return (
    <div className="flex items-start gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700 print:hidden lg:hidden">
      <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="mt-0.5 size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">ติดตั้ง WorkNest ไว้ที่หน้าจอโฮม</p>
        {mode === "ios" ? (
          <p className="text-xs text-brand-700/80">
            กดปุ่มแชร์{" "}
            <svg aria-label="แชร์" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="inline size-4 align-text-bottom">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12L8 7m4-4 4 4M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
            </svg>{" "}
            แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
          </p>
        ) : (
          <p className="text-xs text-brand-700/80">เปิดได้เร็วเหมือนแอป ไม่ต้องพิมพ์ที่อยู่เว็บ</p>
        )}
      </div>
      {mode === "prompt" && (
        <button
          onClick={install}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          ติดตั้ง
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="ปิด"
        className="-mr-1 shrink-0 rounded-md p-1 text-brand-700/60 hover:bg-brand-100 hover:text-brand-700"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="size-4">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
