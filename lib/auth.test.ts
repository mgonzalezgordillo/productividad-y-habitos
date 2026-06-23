import { describe, expect, it } from "vitest";
import { getGoogleClientIdConfig, maskGoogleClientId, validateGoogleClientId } from "./auth";

describe("configuracion de Google OAuth", () => {
  it("rechaza un Client ID ausente o vacio", () => {
    expect(() => validateGoogleClientId(undefined)).toThrow("Falta la configuracion");
    expect(() => validateGoogleClientId("")).toThrow("Falta la configuracion");
  });

  it("rechaza placeholders como Client ID", () => {
    expect(() => validateGoogleClientId("NEXT_PUBLIC_GOOGLE_CLIENT_ID")).toThrow("placeholder");
    expect(() => validateGoogleClientId("TU_CLIENT_ID.apps.googleusercontent.com")).toThrow("placeholder");
  });

  it("rechaza comillas, espacios y formatos que no son OAuth Client ID web", () => {
    expect(() => validateGoogleClientId(" 123456789-test.apps.googleusercontent.com")).toThrow("espacios");
    expect(() => validateGoogleClientId('"123456789-test.apps.googleusercontent.com"')).toThrow("comillas");
    expect(() => validateGoogleClientId("AIza-not-a-client-id")).toThrow("formato");
    expect(() => validateGoogleClientId("123456789-test")).toThrow("formato");
  });

  it("acepta un Client ID web valido y lo normaliza sin exponerlo completo", () => {
    const clientId = "1234567890-abcdefghi.apps.googleusercontent.com";
    expect(validateGoogleClientId(clientId)).toBe(clientId);
    expect(maskGoogleClientId(clientId)).toBe("1234...fghi.apps.googleusercontent.com");
  });

  it("devuelve error local y no un Client ID cuando la configuracion es invalida", () => {
    const config = getGoogleClientIdConfig("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
    expect(config.clientId).toBeNull();
    expect(config.error).toMatch(/placeholder/);
  });
});
