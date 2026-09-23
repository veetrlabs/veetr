import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

// Real migrations/RPCs and real function handler; Auth HTTP and Resend are
// deterministic adapters. No production credentials or outbound emails are used.
test("permission request, notification, and review workflow", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role service_role; create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  `);
  const dir = new URL("../migrations/", import.meta.url);
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(new URL(file, dir), "utf8"));
  }
  const admin = randomUUID(),
    user = randomUUID(),
    other = randomUUID();
  const unverified = randomUUID();
  for (const id of [admin, user, other, unverified]) {
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id,
      `${id}@example.test`,
      id === unverified ? null : new Date().toISOString(),
    ]);
  }
  await db.query("insert into public.platform_admins values ($1)", [admin]);
  async function rpc(id, sql, args = []) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({aal:'aal2'})]);
    await db.exec("set role authenticated");
    return db.query(sql, args);
  }
  const access = async (id) =>
    (await rpc(id, "select public.creation_access() a")).rows[0].a;
  const submit = (id) =>
    rpc(id, "select public.request_creation_access($1)", [
      "Our club needs to organize weekly regattas.",
    ]);
  const review = (id, request, approve) =>
    rpc(id, "select public.review_creation_access($1,$2)", [request, approve]);
  const pending = async () =>
    (await rpc(admin, "select public.list_creation_requests() r")).rows[0].r;
  let handler,
    failProvider = false,
    failMarker = false;
  const attempts = [],
    delivered = new Map();
  const code = ts.transpileModule(
    await readFile(
      new URL("../functions/creation-request-email/index.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  vm.runInNewContext(code, {
    Request,
    Response,
    AbortSignal,
    crypto: webcrypto,
    Deno: {
      env: {
        get: (name) =>
          ({
            SUPABASE_URL: "https://db.test",
            SUPABASE_SERVICE_ROLE_KEY: "server-only",
            RESEND_API_KEY: "test-key",
            PORTAL_URL: "http://127.0.0.1:4322",
          })[name],
      },
      serve: (fn) => {
        handler = fn;
      },
    },
    fetch: async (url, init = {}) => {
      await db.exec("reset role");
      if (url === "https://db.test/auth/v1/user") {
        const id = init.headers.Authorization?.replace("Bearer ", "");
        const rows = [admin, user, other, unverified].includes(id)
          ? (
              await db.query("select id,email from auth.users where id=$1", [
                id,
              ])
            ).rows
          : [];
        return Response.json(rows[0] ?? {}, {
          status: rows.length ? 200 : 401,
        });
      }
      if (url.endsWith("/rpc/check_account_access")) {
        try {await rpc(init.headers.Authorization.replace("Bearer ", ""), "select public.check_account_access()");return new Response(null,{status:204});}
        catch {return new Response(null,{status:403});}
      }
      if (url === "https://api.resend.com/emails") {
        const payload = JSON.parse(init.body),
          key = init.headers["Idempotency-Key"];
        attempts.push({ payload, key });
        if (failProvider)
          return Response.json(
            { error: "Temporarily unavailable" },
            { status: 503 },
          );
        if (delivered.has(key)) assert.deepEqual(payload, delivered.get(key));
        delivered.set(key, payload);
        return Response.json({ id: key });
      }
      if (url === "https://db.test/rest/v1/rpc/claim_request_email") {
        const args = JSON.parse(init.body);
        const result = await db.query(
          "select public.claim_request_email($1,$2) claimed",
          [args.request_id, args.requester_id],
        );
        return Response.json(result.rows[0].claimed);
      }
      if (url === "https://db.test/rest/v1/rpc/audit_request_email") {
        const args = JSON.parse(init.body);
        await db.query("select public.audit_request_email($1,$2,$3,$4)", [
          args.request_id,
          args.outcome,
          args.attempt_id,
          args.provider_status,
        ]);
        return new Response(null, { status: 204 });
      }
      const parsed = new URL(url);
      assert.equal(parsed.origin, "https://db.test");
      assert.equal(parsed.pathname, "/rest/v1/series_access_requests");
      assert.equal(init.headers.Authorization, "Bearer server-only");
      const requestId = parsed.searchParams.get("id")?.replace(/^eq\./, "");
      const userId = parsed.searchParams.get("user_id")?.replace(/^eq\./, "");
      if (init.method === "PATCH") {
        if (failMarker) return Response.json({}, { status: 503 });
        await db.query(
          "update public.series_access_requests set email_sent_at=$1 where id=$2 and user_id=$3",
          [JSON.parse(init.body).email_sent_at, requestId, userId],
        );
        return new Response(null, { status: 204 });
      }
      return Response.json(
        (
          await db.query(
            "select * from public.series_access_requests where id=$1 and user_id=$2",
            [requestId, userId],
          )
        ).rows,
      );
    },
  });
  const notify = (id, requestId, extra = {}) =>
    handler(
      new Request("https://fn.test", {
        method: "POST",
        headers: id ? { authorization: `Bearer ${id}` } : {},
        body: JSON.stringify({ requestId, ...extra }),
      }),
    );

  await t.test(
    "unverified accounts and invalid notes cannot create requests",
    async () => {
      await assert.rejects(submit(unverified), /Verify your email/);
      for (const note of ["   ", "x".repeat(2001)]) {
        await assert.rejects(
          rpc(user, "select public.request_creation_access($1)", [note]),
          /check constraint/,
        );
      }
      assert.equal((await access(user)).status, null);
    },
  );

  let requestId;
  await t.test(
    "failed notification preserves pending request; retry sends stored content once",
    async () => {
      await submit(user);
      requestId = (await access(user)).requestId;
      assert.ok(requestId);
      failProvider = true;
      assert.equal((await notify(user, requestId)).status, 502);
      assert.equal((await access(user)).emailSent, false);
      assert.equal((await access(user)).allowed, false);
      assert.equal((await pending()).length, 1);
      assert.equal((await notify(user, requestId)).status, 429);
      await db.exec("reset role");
      await db.query(
        "update public.series_access_requests set email_next_attempt_at = now() - interval '1 second' where id=$1",
        [requestId],
      );
      failProvider = false;
      assert.equal(
        (
          await notify(user, requestId, {
            note: "FORGED",
            to: "attacker@example.test",
          })
        ).status,
        200,
      );
      assert.equal((await access(user)).emailSent, true);
      assert.equal((await access(user)).status, "pending");
      const mail = delivered.get(`creation-request/${requestId}`);
      assert.deepEqual(mail.to, ["hello@veetr.org"]);
      assert.equal(mail.reply_to, `${user}@example.test`);
      assert.match(mail.text, /Our club needs to organize weekly regattas/);
      assert.match(mail.text, /http:\/\/127\.0\.0\.1:4322\/account\//);
      assert.doesNotMatch(mail.text, /FORGED/);
      const count = attempts.length;
      assert.equal((await notify(user, requestId)).status, 200);
      assert.equal(attempts.length, count);
    },
  );

  await t.test(
    "anonymous, expired, and other users cannot send or approve a request",
    async () => {
      const count = attempts.length;
      assert.equal((await notify(null, requestId)).status, 401);
      assert.equal((await notify("expired-token", requestId)).status, 401);
      assert.equal((await notify(other, requestId)).status, 404);
      assert.equal(attempts.length, count);
      await assert.rejects(review(other, requestId, true), /admin/);
      await assert.rejects(
        rpc(user, "insert into public.platform_admins values ($1)", [user]),
        /permission denied/,
      );
      assert.equal((await access(user)).allowed, false);
    },
  );

  await t.test(
    "admin approval grants access and cannot be reviewed twice",
    async () => {
      await review(admin, requestId, true);
      assert.equal((await access(user)).allowed, true);
      assert.equal((await access(user)).status, "approved");
      assert.equal((await pending()).length, 0);
      await assert.rejects(review(admin, requestId, false), /already reviewed/);
      assert.equal((await access(user)).allowed, true);
    },
  );

  await t.test(
    "retry after delivery-marker failure reuses the provider idempotency key",
    async () => {
      await submit(other);
      const id = (await access(other)).requestId;
      failMarker = true;
      assert.equal((await notify(other, id)).status, 502);
      assert.equal((await access(other)).emailSent, false);
      const count = delivered.size;
      assert.equal((await notify(other, id)).status, 429);
      await db.exec("reset role");
      await db.query(
        "update public.series_access_requests set email_next_attempt_at = now() - interval '1 second' where id=$1",
        [id],
      );
      failMarker = false;
      assert.equal((await notify(other, id)).status, 200);
      assert.equal((await access(other)).emailSent, true);
      assert.equal(delivered.size, count);
      assert.equal(attempts.at(-1).key, attempts.at(-2).key);
    },
  );

  await t.test(
    "declined requests grant no access and cannot send additional notifications",
    async () => {
      const id = (await access(other)).requestId;
      await review(admin, id, false);
      assert.equal((await access(other)).allowed, false);
      assert.equal((await access(other)).status, "declined");
      const count = attempts.length;
      assert.equal((await notify(other, id)).status, 200);
      assert.equal(attempts.length, count);
      await assert.rejects(review(admin, id, true), /already reviewed/);
    },
  );
  await t.test(
    "concurrent requests, failures, and expired retries cannot flood email or audit",
    async () => {
      await submit(admin);
      const id = (await access(admin)).requestId;
      failProvider = true;
      const before = attempts.length;
      const replies = await Promise.all(
        Array.from({ length: 12 }, () => notify(admin, id)),
      );
      assert.equal(replies.filter((r) => r.status === 502).length, 1);
      assert.equal(replies.filter((r) => r.status === 429).length, 11);
      assert.equal(attempts.length, before + 1);
      for (let attempt = 1; attempt < 5; attempt++) {
        await db.exec("reset role");
        await db.query(
          "update public.series_access_requests set email_next_attempt_at = now() - interval '1 second' where id=$1",
          [id],
        );
        assert.equal((await notify(admin, id)).status, 502);
      }
      await db.exec("reset role");
      await db.query(
        "update public.series_access_requests set email_next_attempt_at = now() - interval '1 second' where id=$1",
        [id],
      );
      const auditCount = async () =>
        (await db.query("select count(*) n from public.audit_log")).rows[0].n;
      const beforeAudit = await auditCount();
      for (let i = 0; i < 10; i++)
        assert.equal((await notify(admin, id)).status, 429);
      assert.equal(await auditCount(), beforeAudit);
      assert.equal(attempts.length, before + 5);
      // Even a remaining attempt must not outlive provider idempotency retention.
      await db.query(
        "update public.series_access_requests set email_attempt_count=1, email_first_attempt_at=now() - interval '24 hours' where id=$1",
        [id],
      );
      assert.equal((await notify(admin, id)).status, 429);
      assert.equal(attempts.length, before + 5);
      await assert.rejects(
        rpc(admin, "select public.claim_request_email($1,$2)", [id, admin]),
        /permission denied/,
      );
      await assert.rejects(
        rpc(
          admin,
          "update public.series_access_requests set email_attempt_count=0 where id=$1",
          [id],
        ),
        /permission denied/,
      );
      failProvider = false;
    },
  );

  await t.test(
    "email attempts and outcomes are auditable without message bodies",
    async () => {
      await db.exec("reset role");
      const records = (
        await db.query(
          "select * from public.audit_log where action like 'email.%' order by id",
        )
      ).rows;
      assert.ok(
        records.some(
          (row) =>
            row.action === "email.failed" &&
            row.metadata.provider_status === 503,
        ),
      );
      assert.ok(
        records.some(
          (row) =>
            row.action === "email.accepted" &&
            row.metadata.provider_status === 200,
        ),
      );
      for (const row of records.filter(
        (row) => row.action !== "email.attempted",
      )) {
        assert.ok(
          records.some(
            (start) =>
              start.action === "email.attempted" &&
              start.metadata.attempt_id === row.metadata.attempt_id,
          ),
        );
      }
      assert.doesNotMatch(
        JSON.stringify(records),
        /test-key|server-only|weekly regattas|Bearer/,
      );
    },
  );
});
