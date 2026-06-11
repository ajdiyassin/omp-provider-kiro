export type LoginChoice =
  | { method: "builder-id" }
  | { method: "idc"; startUrl: string }
  | { method: "google" }
  | { method: "github" }
  | null;

export function setExtensionContext(_ctx: unknown): void {
  // No-op in OMP-native MVP.
}

export async function showLoginUI(): Promise<LoginChoice> {
  return null;
}
