type AccountIdentity = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

function firstPresent(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

export function getAccountDisplayName(user: AccountIdentity | null | undefined, fallback: string) {
  return firstPresent(user?.name, user?.username, user?.email) ?? fallback;
}
