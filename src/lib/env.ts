// Environment helpers that avoid direct `import.meta` syntax to keep Jest/ts-jest happy
// and work in both browser (Vite) and Node test environments.

export function getViteEnvVar(key: string): string | undefined {
  // Access via globalThis to avoid the special parser form `import.meta`
  const g: any = (typeof globalThis !== 'undefined' ? globalThis : {});
  const viteEnv = g?.import?.meta?.env || g?.process?.env;
  const val = viteEnv?.[key] ?? g?.process?.env?.[key];
  return typeof val === 'string' ? val : undefined;
}

export function resolveServerUrl(): string | undefined {
  const envUrl = getViteEnvVar('VITE_SERVER_URL');
  if (envUrl && envUrl.trim().length > 0) return envUrl;

  // Fallback for local dev during tests or when running on localhost
  const isBrowser = typeof window !== 'undefined' && !!(window as any).location;
  const isLocalhost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocalhost ? 'http://localhost:3001' : undefined;
}
