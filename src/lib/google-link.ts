/** Hosts of Google's "Ask for reviews" share links, which open the Google Maps app on phones. */
const MAPS_APP_HOSTS = ["g.page", "maps.app.goo.gl", "goo.gl", "maps.google.com"];

/**
 * True for review links that open the Google Maps app on a phone. Links like
 * search.google.com/local/writereview open in the browser instead, which can
 * show a blank page when the customer isn't signed in to Google.
 */
export function opensMapsApp(url: string): boolean {
  try {
    const u = new URL(url);
    return MAPS_APP_HOSTS.includes(u.hostname) || (u.hostname.endsWith("google.com") && u.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}
