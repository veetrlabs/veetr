import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";
const code = ts.transpileModule(
  readFileSync(
    new URL("../functions/creation-request-email/index.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const id = "11111111-1111-4111-8111-111111111111";
function setup({ missing = false, sent = false, fail = false } = {}) {
  let handler;
  const calls = [];
  vm.runInNewContext(code, {
    Request,
    Response,
    AbortSignal,
    crypto: webcrypto,
    Deno: {
      env: {
        get: (n) =>
          ({
            SUPABASE_URL: "https://db.test",
            SUPABASE_SERVICE_ROLE_KEY: "server",
            RESEND_API_KEY: "sending",
          })[n],
      },
      serve: (fn) => (handler = fn),
    },
    fetch: async (url, init = {}) => {
      calls.push({ url, ...init });
      if (url.endsWith("/rpc/check_account_access")) return new Response(null, {status: 204});
      if (url.endsWith("/rpc/claim_request_email")) return Response.json(true);
      if (url.endsWith("/user"))
        return Response.json({ id: "user", email: "requester@example.test" });
      if (url.includes("resend.com"))
        return Response.json({ id: "email" }, { status: fail ? 503 : 200 });
      if (init.method === "PATCH") return new Response(null, { status: 204 });
      return Response.json(
        missing
          ? []
          : [
              {
                id,
                note: "Club racing",
                status: "pending",
                email_sent_at: sent ? "today" : null,
              },
            ],
      );
    },
  });
  return { calls, handler };
}
test("email endpoint requires identity and only sends the caller’s stored request", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (await handler(new Request("https://fn.test", { method: "POST" }))).status,
    401,
  );
  assert.equal(calls.length, 0);
  const response = await handler(
    new Request("https://fn.test", {
      method: "POST",
      headers: {
        authorization: "Bearer user-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId: id }),
    }),
  );
  assert.equal(response.status, 200);
  assert.ok(calls.some(c => c.url.includes("user_id=eq.user")));
  assert.equal(calls.find(c => c.url.endsWith("/rpc/check_account_access")).headers.Authorization, "Bearer user-token");
  const mail = calls.find((c) => c.url.includes("resend.com"));
  assert.equal(JSON.parse(mail.body).reply_to, "requester@example.test");
  assert.deepEqual(JSON.parse(mail.body).to, ["hello@veetr.org"]);
  assert.equal(mail.headers["Idempotency-Key"], `creation-request/${id}`);
});
test("missing, delivered, and failed messages do not produce incorrect delivery markers", async () => {
  for (const options of [{ missing: true }, { sent: true }, { fail: true }]) {
    const { handler, calls } = setup(options);
    await handler(
      new Request("https://fn.test", {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({ requestId: id }),
      }),
    );
    assert.ok(!calls.some((c) => c.method === "PATCH"));
    if (!options.fail)
      assert.ok(!calls.some((c) => c.url.includes("resend.com")));
  }
});
