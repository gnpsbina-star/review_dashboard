import { cookieJar } from "./next-mocks";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { ORG_COOKIE } from "@/lib/access";

/** Signs a user in for the next server action / page call. */
export async function signInAs(userId: string, orgId?: string) {
  cookieJar.clear();
  const { token } = await createSession(userId);
  cookieJar.set(SESSION_COOKIE, token);
  if (orgId) cookieJar.set(ORG_COOKIE, orgId);
}
