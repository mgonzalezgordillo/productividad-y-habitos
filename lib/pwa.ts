"use client";

export const registerServiceWorker = (
  onUpdate: () => void,
  onReady?: () => void
): (() => void) | undefined => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;

  let active = true;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  navigator.serviceWorker
    .register(`${basePath}/sw.js`)
    .then((registration) => {
      onReady?.();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller && active) {
            onUpdate();
          }
        });
      });
    })
    .catch(() => undefined);

  return () => {
    active = false;
  };
};
