declare module '*.sql?raw' {
  const source: string;
  export default source;
}

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CLERK_SECRET: string;
    CLERK_PUBLIC: string;
    CLERK_AUTHORIZED_PARTIES?: string;
    TEST_MIGRATIONS: D1Migration[];
  }
}

declare module 'cloudflare:workers' {
  // Module augmentation requires an interface declaration.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Cloudflare.Env {}
}
