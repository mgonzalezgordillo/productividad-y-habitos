import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-turquoise-blue-50 p-6 text-turquoise-blue-950">
      <div className="max-w-md rounded-lg border border-turquoise-blue-100 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold text-turquoise-blue-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Pagina no encontrada</h1>
        <p className="mt-3 text-turquoise-blue-800">
          La seccion solicitada no existe en esta aplicacion local.
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center text-turquoise-blue-700 underline" href="/">
          Volver a Hoy
        </Link>
      </div>
    </main>
  );
}
