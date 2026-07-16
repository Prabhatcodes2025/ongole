/** Minimal bindings used by the vinext Cloudflare worker entry point. */
interface Fetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  readonly __d1Brand?: never;
}

declare module "cloudflare:workers" {
  export const env: { DB?: D1Database };
}
