import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("autenticacion y acceso", () => {
  it("parsea la lista de emails permitidos y normaliza espacios", async () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS", " test@gmail.com , otra@correo.com ");
    const auth = await import("./auth");
    expect(auth.allowedGoogleEmails).toEqual(["test@gmail.com", "otra@correo.com"]);
  });

  it("reconoce un email autorizado", async () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS", "test@gmail.com");
    const auth = await import("./auth");
    expect(auth.isAllowedGoogleEmail("test@gmail.com")).toBe(true);
  });

  it("rechaza un email no autorizado cuando existe lista permitida", async () => {
    vi.stubEnv("NEXT_PUBLIC_ALLOWED_GOOGLE_EMAILS", "test@gmail.com");
    const auth = await import("./auth");
    expect(auth.isAllowedGoogleEmail("otra@correo.com")).toBe(false);
  });

  it("convierte el usuario autenticado a la estructura interna estable", async () => {
    const auth = await import("./auth");
    expect(
      auth.toAuthenticatedUser({
        uid: "uid-123",
        email: "user@example.com",
        displayName: "User",
        photoURL: "https://example.com/p.png"
      } as never)
    ).toEqual({
      id: "uid-123",
      email: "user@example.com",
      name: "User",
      picture: "https://example.com/p.png"
    });
  });
});
