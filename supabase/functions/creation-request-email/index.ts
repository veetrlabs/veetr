const portal = Deno.env.get("PORTAL_URL") || "https://veetr.org";
const headers = {
  "Access-Control-Allow-Origin": portal,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const reply = (status: number, error: string) =>
    new Response(JSON.stringify({ message: error }), { status, headers });
  if (req.method !== "POST") return reply(405, "Method not allowed");
  try {
    const base = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("authorization");
    if (!auth) return reply(401, "Sign in required");
    const identity = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth },
    });
    if (!identity.ok) return reply(401, "Sign in required");
    const user = await identity.json();
    const { requestId } = await req.json();
    if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId))
      return reply(400, "Invalid request");
    const adminHeaders = { apikey: key, Authorization: `Bearer ${key}` };
    const query = `${base}/rest/v1/series_access_requests?id=eq.${requestId}&user_id=eq.${user.id}`;
    const found = await fetch(query, { headers: adminHeaders });
    if (!found.ok) return reply(502, "Request lookup failed");
    const [record] = await found.json();
    if (!record) return reply(404, "Request not found");
    if (record.email_sent_at || record.status !== "pending")
      return reply(200, "Already processed");
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return reply(503, "Email is not configured");
    const claim = await fetch(`${base}/rest/v1/rpc/claim_request_email`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, requester_id: user.id }),
    });
    if (!claim.ok) return reply(502, "Unable to reserve email attempt");
    if ((await claim.json()) !== true)
      return reply(
        429,
        "Please wait five minutes before retrying. Email notifications are limited to five attempts within 23 hours; your request remains available for admin review.",
      );
    const attemptId = crypto.randomUUID();
    const audit = async (
      outcome: string,
      providerStatus: number | null = null,
    ) => {
      const response = await fetch(`${base}/rest/v1/rpc/audit_request_email`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          outcome,
          attempt_id: attemptId,
          provider_status: providerStatus,
        }),
      });
      if (!response.ok) throw new Error("Unable to record email audit");
    };
    await audit("attempted");
    let sent: Response;
    try {
      sent = await fetch("https://api.resend.com/emails", {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `creation-request/${record.id}`,
        },
        body: JSON.stringify({
          from: "Veetr <hello@veetr.org>",
          to: ["hello@veetr.org"],
          reply_to: user.email,
          subject: "Veetr: request to create series",
          text: `${user.email} requests permission to create series.\n\n${record.note}\n\nReview and approve or decline (admin sign-in required):\n${portal.replace(/\/$/, "")}/account/\n\nReply to this email to contact the requester.`,
        }),
      });
    } catch {
      await audit("failed");
      return reply(502, "Email delivery failed");
    }
    await audit(sent.ok ? "accepted" : "failed", sent.status);
    if (!sent.ok) return reply(502, "Email delivery failed");
    const marked = await fetch(query, {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ email_sent_at: new Date().toISOString() }),
    });
    return reply(
      marked.ok ? 200 : 502,
      marked.ok ? "Sent" : "Delivery recorded by provider; retry to confirm",
    );
  } catch {
    return reply(500, "Unable to send notification");
  }
});
