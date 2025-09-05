// Environment helpers that avoid direct `import.meta` syntax to keep Jest/ts-jest happy
// and work in both browser (Vite) and Node test environments.

export function getViteEnvVar(key: string): string | undefined {
  // Access via globalThis to avoid the special parser form `import.meta`
  const g: any = (typeof globalThis !== 'undefined' ? globalThis : {});
  const viteEnv = g?.import?.meta?.env || g?.process?.env;
  const val = viteEnv?.[key] ?? g?.process?.env?.[key];
  return typeof val === 'string' ? val : undefined;
}

function readServerUrlFromGlobal(): string | undefined {
  const g: any = (typeof globalThis !== 'undefined' ? globalThis : {});
  const val = g.__APXO_SERVER_URL__;
  return typeof val === 'string' && val.trim().length > 0 ? val : undefined;
}

function readServerUrlFromMeta(): string | undefined {
  try {
    if (typeof document === 'undefined') return undefined;
    const el = document.querySelector('meta[name="apxo-server-url"]') as HTMLMetaElement | null;
    const val = el?.content;
    return typeof val === 'string' && val.trim().length > 0 ? val : undefined;
  } catch {
    return undefined;
  }
}

export function resolveServerUrl(): string | undefined {
  // Priority: runtime global override -> meta tag -> Vite env -> localhost fallback
  const globalUrl = readServerUrlFromGlobal();
  if (globalUrl) return globalUrl;

  const metaUrl = readServerUrlFromMeta();
  if (metaUrl) return metaUrl;

  const envUrl = getViteEnvVar('VITE_SERVER_URL');
  if (envUrl && envUrl.trim().length > 0) return envUrl;

  // Fallback for local dev during tests or when running on localhost
  const isBrowser = typeof window !== 'undefined' && !!(window as any).location;
  const isLocalhost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return isLocalhost ? 'http://localhost:3001' : undefined;
}
