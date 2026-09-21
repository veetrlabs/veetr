import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvitationHandler } from "../functions/boat-invitation-email/handler.mjs";
const id = "00000000-0000-4000-8000-000000000001";
const env = {
  PORTAL_URL: "https://veetr.org",
  SUPABASE_URL: "https://backend.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-test",
  RESEND_API_KEY: "mail-test",
};
const request = (auth = "Bearer official-jwt") =>
  new Request("https://function.test", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: JSON.stringify({ invitationId: id, email: "attacker@example.test" }),
  });
test("email delivery requires authentication and database authorization", async () => {
  let calls = 0;
  const handle = createInvitationHandler(env, async () => {
    calls++;
    return new Response("{}", { status: 403 });
  });
  assert.equal((await handle(request(""))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handle(request())).status, 403);
  assert.equal(calls, 1);
});
test("delivery uses stored recipient and the official JWT; service credentials only mark delivery", async () => {
  const calls = [];
  const handle = createInvitationHandler(env, async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("prepare_boat_invitation_email"))
      return Response.json({
        email: "skipper@example.test",
        boat: "Aurora",
        series: "Autumn",
        token: id,
      });
    return Response.json({ id: "sent" });
  });
  assert.equal((await handle(request())).status, 200);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].init.headers.Authorization, "Bearer official-jwt");
  const email = JSON.parse(calls[1].init.body);
  assert.deepEqual(email.to, ["skipper@example.test"]);
  assert.match(email.text, /https:\/\/veetr.org\/account\/\?invite=/);
  assert.equal(
    calls[1].init.headers["Idempotency-Key"],
    `boat-invitation/${id}`,
  );
  assert.equal(calls[2].init.headers.Authorization, "Bearer service-test");
});
test("provider failure never marks delivery, and missing configuration performs no request", async () => {
  let calls = 0;
  const handle = createInvitationHandler(env, async () => {
    calls++;
    return calls === 1
      ? Response.json({
          email: "skipper@example.test",
          token: id,
          boat: "Boat",
          series: "Series",
        })
      : new Response("{}", { status: 503 });
  });
  assert.equal((await handle(request())).status, 502);
  assert.equal(calls, 2);
  const missing = createInvitationHandler(
    { ...env, RESEND_API_KEY: undefined },
    async () => {
      throw new Error("Must not fetch");
    },
  );
  assert.equal((await missing(request())).status, 503);
});

test("local mailcatcher uses authorized stored invitation and marks only successful delivery", async () => {
  const calls = [];
  const messages = [];
  const localEnv = {
    ...env,
    RESEND_API_KEY: undefined,
    PORTAL_URL: "http://localhost:4321",
  };
  const db = async (url) => {
    calls.push(url);
    if (url.endsWith("prepare_boat_invitation_email"))
      return Response.json({
        email: "skipper@example.test",
        boat: "Boat",
        series: "Series",
        token: id,
      });
    return Response.json({});
  };
  const handle = createInvitationHandler(localEnv, db, async (message) => {
    messages.push(message);
    return new Response(null, { status: 200 });
  });
  assert.equal((await handle(request())).status, 200);
  assert.deepEqual(messages[0].to, ["skipper@example.test"]);
  assert.match(messages[0].text, /http:\/\/localhost:4321\/account\/\?invite=/);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith("mark_boat_invitation_sent"));
  calls.length = 0;
  const failing = createInvitationHandler(localEnv, db, async () => {
    throw new Error("SMTP unavailable");
  });
  assert.equal((await failing(request())).status, 500);
  assert.equal(calls.length, 1);
});

test("race email validates the capability and uses only a configured recipient from the database", async () => {
  const token = id + id;
  const calls = [];
  const handle = createInvitationHandler(env, async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("prepare_race_invitation_email"))
      return Response.json({
        id,
        email: "admin@example.test",
        boat: "Luna",
        race: "Autumn",
        token,
        deliveryKey: "delivery",
      });
    return Response.json({ id: "sent" });
  });
  const reply = await handle(
    new Request("https://function.test", {
      method: "POST",
      headers: { authorization: "Bearer official" },
      body: JSON.stringify({
        raceToken: token,
        recipientId: id,
        email: "attacker@example.test",
      }),
    }),
  );
  assert.equal(reply.status, 200);
  assert.equal(calls[0].init.headers.Authorization, "Bearer official");
  assert.deepEqual(JSON.parse(calls[0].init.body), { token, recipient_id: id });
  const email = JSON.parse(calls[1].init.body);
  assert.deepEqual(email.to, ["admin@example.test"]);
  assert.match(email.text, /\/join\//);
  assert.match(email.text, /No account needed/);
  assert.doesNotMatch(email.text, /account\/\?invite/);
  assert.ok(calls[2].url.endsWith("mark_race_invitation_sent"));
});
test("race email rejects malformed tokens before touching the database", async () => {
  let calls = 0;
  const handle = createInvitationHandler(env, async () => {
    calls++;
    return Response.json({});
  });
  const reply = await handle(
    new Request("https://function.test", {
      method: "POST",
      headers: { authorization: "Bearer official" },
      body: JSON.stringify({ raceToken: "bad", recipientId: id }),
    }),
  );
  assert.equal(reply.status, 400);
  assert.equal(calls, 0);
});
