"use client";

import { LogIn, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { allowedGoogleEmails, authConfigError } from "@/lib/auth";

export function GoogleLogin() {
  const { user, loading, error, signInWithGoogle } = useAuth();

  if (user) {
    return (
      <div className="rounded-md border border-turquoise-blue-100 bg-turquoise-blue-50 p-4 text-sm text-turquoise-blue-900">
        Sesion iniciada como {user.email}.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-turquoise-blue-100 text-turquoise-blue-800">
          <LogIn className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-turquoise-blue-700">Cuenta</p>
          <h2 className="text-xl font-semibold">Inicia sesion con Google</h2>
        </div>
      </div>
      <p className="mb-5 text-sm text-turquoise-blue-800">
        Los datos se asociaran automaticamente a la cuenta de Google con la que entres. Al cerrar sesion, el espacio activo deja de mostrarse.
      </p>
      <button className="btn-primary" type="button" onClick={() => void signInWithGoogle()} disabled={Boolean(authConfigError) || loading}>
        <LogIn className="h-5 w-5" aria-hidden />
        {loading ? "Preparando..." : "Iniciar sesion"}
      </button>
      {authConfigError ? (
        <p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-sm text-red-900" role="alert">
          No se ha podido iniciar sesion con Google porque Firebase no esta configurado correctamente. Revisa las variables publicas en GitHub Actions.
        </p>
      ) : null}
      {allowedGoogleEmails.length ? (
        <p className="mt-4 text-sm text-turquoise-blue-800">Emails permitidos: {allowedGoogleEmails.join(", ")}</p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>Si la autenticacion falla, la app no descargara datos hasta completar la sesion y validar el correo.</p>
        </div>
      </div>
    </div>
  );
}

