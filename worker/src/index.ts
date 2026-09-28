/**
 * Permanent QR redirect: https://go.<account>.workers.dev/<CODE> → <APP_URL>/r/<CODE>
 *
 * Printed QR codes point here, never at the app directly. If the app moves to a new
 * host or domain, change APP_URL in wrangler.toml and redeploy; no QR is reprinted.
 */
export interface Env {
  APP_URL: string;
}

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const target = env.APP_URL.replace(/\/$/, "");
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    if (path === "") return Response.redirect(target, 302);
    const code = path.toUpperCase();
    if (!CODE.test(code)) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
    // 302 (not 301) so phones never cache an old destination.
    return Response.redirect(`${target}/r/${code}`, 302);
  },
};

export default worker;
