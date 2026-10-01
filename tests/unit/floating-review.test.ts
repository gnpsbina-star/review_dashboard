import { describe, expect, it } from "vitest";
import { canFloatOver, wrapLines } from "@/components/customer/floatingReview";
import { opensMapsApp } from "@/lib/google-link";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("Google review links", () => {
  it("knows which links open the Google Maps app", () => {
    expect(opensMapsApp("https://g.page/r/CQx9abc/review")).toBe(true);
    expect(opensMapsApp("https://maps.app.goo.gl/xyz")).toBe(true);
    expect(opensMapsApp("https://www.google.com/maps/place/X")).toBe(true);
    expect(opensMapsApp("https://search.google.com/local/writereview?placeid=X")).toBe(false);
    expect(opensMapsApp("not a url")).toBe(false);
  });
});

describe("floating review helper", () => {
  it("floats on iPhones always, and on Android only when Google opens in the Maps app", () => {
    expect(canFloatOver("https://search.google.com/local/writereview?placeid=X", IPHONE)).toBe(true);
    expect(canFloatOver("https://search.google.com/local/writereview?placeid=X", ANDROID)).toBe(false);
    expect(canFloatOver("https://g.page/r/CQx9abc/review", ANDROID)).toBe(true);
  });
  it("wraps the review and trims it with an ellipsis when it runs long", () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapLines("one two three four", 100, 3, measure)).toEqual(["one two", "three four"]);
    const long = wrapLines("aaaa bbbb cccc dddd eeee ffff", 90, 2, measure);
    expect(long).toHaveLength(2);
    expect(long[1].endsWith("…")).toBe(true);
    expect(measure(long[1])).toBeLessThanOrEqual(90);
  });
});
