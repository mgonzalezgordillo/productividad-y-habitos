import type { AuthSession } from "./types";

export const LOCAL_ACCOUNT = "local";

export const accountKeyFromSession = (session: AuthSession | null): string =>
  session?.email.toLowerCase() ?? LOCAL_ACCOUNT;

export const settingsIdForAccount = (accountKey: string): string =>
  accountKey === LOCAL_ACCOUNT ? "default" : `default:${accountKey}`;

export const accountEmailForRecord = (accountKey: string): string | undefined =>
  accountKey === LOCAL_ACCOUNT ? undefined : accountKey;

export const accountMatches = (recordAccountEmail: string | undefined, accountKey: string): boolean => {
  if (accountKey === LOCAL_ACCOUNT) return !recordAccountEmail;
  return recordAccountEmail?.toLowerCase() === accountKey;
};
