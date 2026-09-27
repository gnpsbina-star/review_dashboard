import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index";

const env = { APP_URL: "https://app.example.com/" };
const go = (path: string) => worker.fetch(new Request(`https://go.example.workers.dev${path}`), env);

describe("QR redirect worker", () => {
  it("forwards a valid code to the app with a temporary redirect", async () => {
    const r = await go("/GM6QWS");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://app.example.com/r/GM6QWS");
  });
  it("accepts lower-case codes", async () => {
    expect((await go("/gm6qws")).headers.get("location")).toBe("https://app.example.com/r/GM6QWS");
  });
  it("rejects anything that isn't a code", async () => {
    expect((await go("/../admin")).status).toBe(404);
    expect((await go("/https:%2F%2Fevil.com")).status).toBe(404);
    expect((await go("/ABC0O1")).status).toBe(404);
  });
});
