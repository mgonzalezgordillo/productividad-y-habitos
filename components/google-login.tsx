"use client";

import Script from "next/script";
import { LogIn, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  allowedGoogleEmails,
  googleClientId,
  saveAuthSession,
  validateGoogleCredential
} from "@/lib/auth";
import type { AuthSession } from "@/lib/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string; select_by?: string }) => void;
            ux_mode?: "popup" | "redirect";
            use_fedcm_for_button?: boolean;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export function GoogleLogin({ onSignedIn }: { onSignedIn: (session: AuthSession) => void }) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !buttonRef.current || !window.google || !googleClientId) return;
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        try {
          if (!response.credential) throw new Error("Google no devolvio credencial.");
          const session = validateGoogleCredential(response.credential);
          void saveAuthSession(session).then(() => onSignedIn(session));
        } catch (authError) {
          setError(authError instanceof Error ? authError.message : "No se pudo iniciar sesion.");
        }
      },
      ux_mode: "popup",
      use_fedcm_for_button: true,
      auto_select: false
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: 280,
      locale: "es"
    });
  }, [loaded, onSignedIn]);

  return (
    <main className="grid min-h-screen place-items-center bg-turquoise-blue-50 p-4">
      <Script src="https://accounts.google.com/gsi/client" async defer onLoad={() => setLoaded(true)} />
      <section className="w-full max-w-md rounded-lg border border-turquoise-blue-100 bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-turquoise-blue-100 text-turquoise-blue-800">
            <LogIn className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-turquoise-blue-700">Acceso</p>
            <h1 className="text-2xl font-semibold">Inicia sesion con Google</h1>
          </div>
        </div>
        <p className="mb-5 text-sm text-turquoise-blue-800">
          Usa tu email de Google para entrar en esta instalacion. Tus habitos siguen guardandose en este dispositivo.
        </p>
        <div ref={buttonRef} className="min-h-11" />
        {!loaded ? <p className="mt-3 text-sm text-turquoise-blue-800">Cargando Google...</p> : null}
        {allowedGoogleEmails.length ? (
          <p className="mt-4 text-sm text-turquoise-blue-800">
            Emails permitidos: {allowedGoogleEmails.join(", ")}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>
              En GitHub Pages este login es una barrera de interfaz. Para privacidad fuerte usa un proveedor con control de acceso del lado servidor.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
