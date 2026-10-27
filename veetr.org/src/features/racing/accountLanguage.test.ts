import { test } from "node:test";
import assert from "node:assert/strict";
import { rememberAccountLanguage } from "./accountLanguage";
test("language is persisted only for the current account and only when changed", async () => {
  let metadata: Record<string, unknown> = { display_name: "Sailor" };
  let writes = 0;
  const auth = {
    getUser: async () => ({
      data: { user: { id: "user", user_metadata: metadata } },
      error: null,
    }),
    updateUser: async ({
      data,
    }: {
      data: { preferred_language: "en" | "cs" };
    }) => {
      writes++;
      metadata = { ...metadata, ...data };
      return { error: null };
    },
  };
  await rememberAccountLanguage(auth, "user", "cs");
  assert.equal(metadata.preferred_language, "cs");
  assert.equal(metadata.display_name, "Sailor");
  await rememberAccountLanguage(auth, "user", "cs");
  assert.equal(writes, 1);
  await rememberAccountLanguage(auth, "other", "en");
  assert.equal(writes, 1);
  await rememberAccountLanguage(auth, "user", "en");
  assert.equal(metadata.preferred_language, "en");
  assert.equal(writes, 2);
});
test("preference save failures are surfaced", async () => {
  const auth = {
    getUser: async () => ({
      data: { user: { id: "user", user_metadata: {} } },
      error: null,
    }),
    updateUser: async () => ({ error: new Error("offline") }),
  };
  await assert.rejects(rememberAccountLanguage(auth, "user", "cs"), /offline/);
});
