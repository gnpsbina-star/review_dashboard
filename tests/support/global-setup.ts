import { execSync } from "node:child_process";

/** Applies migrations to the test database once before the suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://srp:srp@localhost:5432/srp_test";
  if (!/test/.test(url)) throw new Error("Refusing to run tests against a database whose name doesn't contain 'test'");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
