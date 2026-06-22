import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Habitos Local First",
  description: "Registro local-first de habitos sin cuenta ni backend obligatorio.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`
};

export const viewport: Viewport = {
  themeColor: "#eefcfd",
  colorScheme: "light"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
