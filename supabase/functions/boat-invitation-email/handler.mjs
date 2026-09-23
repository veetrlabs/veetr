export function createInvitationHandler(env, fetcher = fetch, localSend) {
  const portal = (env.PORTAL_URL || "https://veetr.org").replace(/\/$/, "");
  const headers = {
    "Access-Control-Allow-Origin": new URL(portal).origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  return async (req) => {
    const origin = req.headers.get("origin");
    const requestHeaders = { ...headers };
    if (
      localSend &&
      [
        "http://localhost:4321",
        "http://localhost:4333",
        "http://127.0.0.1:4321",
        "http://127.0.0.1:5192",
      ].includes(origin)
    ) {
      requestHeaders["Access-Control-Allow-Origin"] = origin;
      requestHeaders.Vary = "Origin";
    }
    if (req.method === "OPTIONS")
      return new Response("ok", { headers: requestHeaders });
    const reply = (status, message) =>
      new Response(JSON.stringify({ message }), {
        status,
        headers: requestHeaders,
      });
    if (req.method !== "POST") return reply(405, "Method not allowed");
    try {
      const auth = req.headers.get("authorization");
      if (!auth) return reply(401, "Sign in required");
      const { invitationId, raceToken, recipientId } = await req.json();
      const race = raceToken !== undefined;
      const uuid = (value) =>
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        );
      if (
        race
          ? typeof raceToken !== "string" ||
            !/^[a-f0-9-]{72}$/i.test(raceToken) ||
            !uuid(recipientId)
          : !uuid(invitationId)
      )
        return reply(400, "Invalid invitation");
      const apiKey = env.RESEND_API_KEY;
      if (!apiKey && !localSend)
        return reply(
          503,
          "Email is not configured. Copy the invitation link instead.",
        );
      const base = env.SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY;
      const prepared = await fetcher(
        `${base}/rest/v1/rpc/${race ? "prepare_race_invitation_email" : "prepare_boat_invitation_email"}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            race
              ? { token: raceToken, recipient_id: recipientId }
              : { invitation_id: invitationId },
          ),
        },
      );
      if (!prepared.ok) {
        console.error("Invitation preparation failed", prepared.status);
        return reply(
          403,
          "Invitation unavailable, access denied, or email retried too soon.",
        );
      }
      const invitation = await prepared.json();
      const link = invitation.granted ? `${portal}/account/#boats` : race
        ? `${portal}/join/${encodeURIComponent(invitation.token)}/`
        : `${portal}/account/?invite=${encodeURIComponent(invitation.token)}`;
      const role = invitation.role === "manager" ? "skipper" : invitation.role === "crew" ? "crew" : "skipper";
      const scope = invitation.series ? ` in ${invitation.series}` : "";
      const accessText = invitation.handover
        ? `You have been invited to take responsibility for ${invitation.boat} in Veetr.\n\nAccepting makes you its responsible skipper, with control of the boat profile and crew. The previous custodian loses boat access; their series permissions are unchanged. This manages the Veetr record, not legal ownership of the vessel.\n\nSign in with this email address, verify it, and explicitly accept:\n${link}\n\nThis invitation expires in 7 days. Until you accept, access stays unchanged. If unexpected, ignore this invitation.`
        : invitation.granted
        ? `You now have ${role} access to ${invitation.boat}${scope}.\n\nSign in with this email address to view your access:\n${link}\n\nThis does not start location sharing or transfer boat ownership.`
        : `You've been invited as ${role} for ${invitation.boat}${scope}.\n\nSign in or create an account with this email address, verify your email, then accept:\n${link}\n\nThis invitation expires in 7 days. It does not transfer boat ownership. Location sharing only starts when you choose to share.\n\nIf you weren't expecting this invitation, you can ignore it.`;
      const sendRequest = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": race
            ? `race-invitation/${invitation.deliveryKey}`
            : `boat-invitation/${invitationId}`,
        },
        body: JSON.stringify({
          from: "Veetr <hello@veetr.org>",
          to: [invitation.email],
          subject: race
            ? `Veetr: ${invitation.boat} · ${invitation.race}`
            : `Veetr: ${invitation.granted ? "access granted" : "invitation"} for ${invitation.boat}`,
          text: race
            ? `Pozvánka / Invitation: ${invitation.boat} · ${invitation.race}\n\nOtevřete odkaz v aplikaci Veetr a potvrďte připravenost k závodu. Účet není potřeba. Sdílení polohy začne až po potvrzení v aplikaci a spuštění rozhodčím.\n\nOpen this link in Veetr and press Ready to race. No account needed. Location sharing starts only after you confirm and the referee enables tracking.\n${link}\n\nAktuální čas startu najdete v pozvánce. / Open the invitation for the current start time.`
            : accessText,
        }),
      };
      const sent = localSend
        ? await localSend(JSON.parse(sendRequest.body))
        : await fetcher("https://api.resend.com/emails", sendRequest);
      if (!sent.ok)
        return reply(
          502,
          "Email delivery failed. Copy the link or retry in a minute.",
        );
      const marked = await fetcher(
        `${base}/rest/v1/rpc/${race ? "mark_race_invitation_sent" : "mark_boat_invitation_sent"}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invitation_id: race ? invitation.id : invitationId,
          }),
        },
      );
      return reply(
        marked.ok ? 200 : 502,
        marked.ok
          ? "Invitation sent"
          : "Email accepted by provider; delivery status could not be saved.",
      );
    } catch (error) {
      console.error(
        "Invitation email failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      return reply(
        500,
        "Unable to send invitation. Copy the link or retry in a minute.",
      );
    }
  };
}
