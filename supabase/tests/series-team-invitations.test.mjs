import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  createInvitationHandler,
  seriesTeamEmail,
} from "../functions/boat-invitation-email/handler.mjs";

test("series invitation authorization, alternate account acceptance, lifecycle and email limits", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role;create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    const dir = new URL("../migrations/", import.meta.url);
    for (const file of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, dir), "utf8"));
    const owner = randomUUID(),
      recipient = randomUUID(),
      other = randomUUID(),
      manager = randomUUID(),
      unverified = randomUUID();
    for (const id of [owner, recipient, other, manager, unverified])
      await db.query("insert into auth.users values($1,$2,$3)", [
        id,
        `${id}@example.org`,
        id === unverified ? null : new Date().toISOString(),
      ]);
    await db.query("insert into public.series_creators values($1)", [owner]);
    async function as(id, role = "authenticated") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id || "",
      ]);
      await db.exec(`set role ${role}`);
    }
    await as(owner);
    const doc = JSON.parse(
      await readFile(
        new URL(
          "../../veetr.org/imports/orlik-2026/series.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    doc.status = "draft";
    await db.query("select public.save_series($1,0,$2)", [doc, randomUUID()]);
    const value = async (sql, args = []) =>
      (await db.query(`select public.${sql} value`, args)).rows[0].value;
    const invite = async (email, role = "official") =>
      value("invite_series_teammate($1,$2,$3,$4,$5)", [
        doc.id,
        email,
        role,
        "cs",
        "Ahoj!",
      ]);
    const token = async (id) => {
      await db.exec("reset role");
      const t = (
        await db.query(
          "select token from public.series_team_invitations where id=$1",
          [id],
        )
      ).rows[0].token;
      await as(owner);
      return t;
    };
    assert.equal(
      await value("series_teammate_exists($1,$2)", [
        doc.id,
        `${recipient}@example.org`,
      ]),
      true,
    );
    assert.equal(
      await value("series_teammate_exists($1,$2)", [
        doc.id,
        "unknown@example.org",
      ]),
      false,
    );
    const id = await invite(" Unknown@example.org "),
      t = await token(id);
    assert.equal(t.length, 72);
    await assert.rejects(invite("unknown@example.org"), /Wait a minute/);
    await as(other);
    for (const sql of [
      "series_teammate_exists($1,'x@y.z')",
      "series_team_invitations($1)",
      "invite_series_teammate($1,'x@y.z','admin','en','')",
    ])
      await assert.rejects(value(sql, [doc.id]), /admin required/);
    await assert.rejects(
      value("prepare_series_team_invitation_email($1)", [id]),
      /admin required/,
    );
    await assert.rejects(
      db.query("select * from public.series_team_invitations"),
      /permission denied/,
    );
    await as(null, "anon");
    assert.equal(
      (await value("series_team_invitation_preview($1)", [t])).status,
      "pending",
    );
    assert.equal(
      await value("series_team_invitation_preview($1)", ["bogus"]),
      null,
    );
    await assert.rejects(
      value("accept_series_team_invitation($1)", [t]),
      /permission denied/,
    );
    await as(owner);
    const prepared = await value("prepare_series_team_invitation_email($1)", [
      id,
    ]);
    assert.equal(prepared.email, "unknown@example.org");
    assert.equal(prepared.language, "cs");
    assert.equal(prepared.message, "Ahoj!");
    await assert.rejects(
      value("prepare_series_team_invitation_email($1)", [id]),
      /Wait a minute/,
    );
    await assert.rejects(
      value("mark_series_team_invitation_sent($1)", [id]),
      /permission denied/,
    );
    await as(unverified);
    await assert.rejects(
      value("accept_series_team_invitation($1)", [t]),
      /Verify your email/,
    );
    await as(recipient);
    assert.equal(await value("accept_series_team_invitation($1)", [t]), doc.id);
    assert.equal(await value("accept_series_team_invitation($1)", [t]), doc.id);
    assert.equal(await value("is_official($1)", [doc.id]), true);
    await as(other);
    await assert.rejects(
      value("accept_series_team_invitation($1)", [t]),
      /already accepted/,
    );
    await as(owner);
    assert.equal(
      (await value("series_team_invitations($1)", [doc.id]))[0].acceptedEmail,
      `${recipient}@example.org`,
    );
    const revoke = await invite("revoke@example.org"),
      rt = await token(revoke);
    await value("revoke_series_team_invitation($1)", [revoke]);
    await as(recipient);
    await assert.rejects(
      value("accept_series_team_invitation($1)", [rt]),
      /unavailable/,
    );
    await as(owner);
    const expired = await invite("expired@example.org"),
      et = await token(expired);
    await db.exec("reset role");
    await db.query(
      "update public.series_team_invitations set expires_at=now()-interval '1 second' where id=$1",
      [expired],
    );
    await as(recipient);
    await assert.rejects(
      value("accept_series_team_invitation($1)", [et]),
      /expired/,
    );
    await as(owner);
    await value("set_race_official($1,$2,'admin')", [doc.id, manager]);
    const strong = await invite("manager@example.org"),
      st = await token(strong);
    await as(manager);
    await value("accept_series_team_invitation($1)", [st]);
    assert.equal(await value("is_official($1,true)", [doc.id]), true);
    const removed = await invite("removed@example.org");
    await db.exec("reset role");
    const removedToken = (
      await db.query(
        "select token from public.series_team_invitations where id=$1",
        [removed],
      )
    ).rows[0].token;
    await as(owner);
    await value("set_race_official($1,$2,'')", [doc.id, manager]);
    await as(other);
    await assert.rejects(
      value("accept_series_team_invitation($1)", [removedToken]),
      /new invitation/,
    );
    await as(null, "anon");
    assert.equal(
      (await value("series_team_invitation_preview($1)", [removedToken]))
        .status,
      "revoked",
    );
    await as(owner);
    const superseded=await invite(`${recipient}@example.org`), supersededToken=await token(superseded);
    await value('set_series_member($1,$2,$3)',[doc.id,`${recipient}@example.org`,'remove']);
    await as(recipient);
    await assert.rejects(value('accept_series_team_invitation($1)',[supersededToken]),/unavailable/);
  } finally {
    await db.close();
  }
});

test("team email uses authorized stored recipient and localized bearer link", async () => {
  const id = randomUUID(),
    calls = [];
  const handler = createInvitationHandler(
    {
      PORTAL_URL: "https://veetr.org",
      RESEND_API_KEY: "test",
      SUPABASE_URL: "https://db.example",
      SUPABASE_SERVICE_ROLE_KEY: "server-key",
    },
    async (url, options) => {
      calls.push({ url, ...options });
      if (url.includes("prepare_"))
        return Response.json({
          email: "invited@example.org",
          token: "secret-token",
          series: "Orlík",
          role: "admin",
          language: "cs",
          message: "Ahoj <script>text</script>",
          deliveryKey: "delivery-1",
        });
      return Response.json({});
    },
  );
  const request = (body) =>
    new Request("https://edge.example", {
      method: "POST",
      headers: { authorization: "Bearer manager" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await handler(
        request({ teamInvitationId: id, email: "attacker@example.org" }),
      )
    ).status,
    200,
  );
  assert.match(calls[0].url, /prepare_series_team_invitation_email$/);
  assert.equal(calls[0].headers.Authorization, "Bearer manager");
  const email = JSON.parse(calls[1].body);
  assert.deepEqual(email.to, ["invited@example.org"]);
  assert.match(email.text, /\/cs\/account\/\?series-invite=secret-token/);
  assert.match(email.text, /jinou e-mailovou adresou/);
  assert.match(email.text, /Ahoj <script>text<\/script>/);
  assert.equal(email.html, undefined);
  assert.match(calls[2].url, /mark_series_team_invitation_sent$/);
  assert.equal(calls[2].headers.Authorization, "Bearer server-key");
  assert.equal(
    (await handler(request({ teamInvitationId: id, invitationId: id }))).status,
    400,
  );
  assert.match(
    seriesTeamEmail(
      { series: "Test", role: "official", language: "en", message: "" },
      "link",
    ),
    /different email address/,
  );
});
