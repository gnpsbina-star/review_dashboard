import { vi } from "vitest";

/**
 * Minimal stand-ins for Next.js request APIs so server actions and route
 * handlers can run in tests. `redirect` and `notFound` throw like the real ones.
 */
export const cookieJar = new Map<string, string>();
export const requestHeaders = new Headers();

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
export class NotFoundError extends Error {
  constructor() {
    super("NOT_FOUND");
  }
}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => requestHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new NotFoundError();
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.mock("next/server", async (orig) => {
  const actual = await orig<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => void Promise.resolve().then(fn).catch(() => undefined), connection: async () => undefined };
});
