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
        "http://127.0.0.1:4323",
        "http://localhost:4323",
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
      const {
        invitationId,
        raceToken,
        seriesToken,
        recipientId,
        teamInvitationId,
      } = await req.json();
      const team = teamInvitationId !== undefined;
      if (
        team &&
        (invitationId !== undefined ||
          raceToken !== undefined ||
          seriesToken !== undefined)
      )
        return reply(400, "Invalid invitation");
      const series = seriesToken !== undefined;
      const trackingToken = series ? seriesToken : raceToken;
      const race = trackingToken !== undefined;
      if (series && raceToken !== undefined)
        return reply(400, "Invalid invitation");
      const uuid = (value) =>
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        );
      if (
        race
          ? typeof trackingToken !== "string" ||
            !/^[a-f0-9-]{72}$/i.test(trackingToken) ||
            !uuid(recipientId)
          : !uuid(team ? teamInvitationId : invitationId)
      )
        return reply(400, "Invalid invitation");
      const apiKey = env.RESEND_API_KEY;
      if (!apiKey && !localSend)
        return reply(
          503,
          team
            ? "Invitation email is not configured. Contact the site administrator."
            : "Email is not configured. Copy the invitation link instead.",
        );
      const base = env.SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY;
      const prepared = await fetcher(
        `${base}/rest/v1/rpc/${team ? "prepare_series_team_invitation_email" : series ? "prepare_series_invitation_email" : race ? "prepare_race_invitation_email" : "prepare_boat_invitation_email"}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            race
              ? { token: trackingToken, recipient_id: recipientId }
              : { invitation_id: team ? teamInvitationId : invitationId },
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
      const link = team
        ? `${portal}${invitation.language === "cs" ? "/cs" : ""}/account/?series-invite=${encodeURIComponent(invitation.token)}`
        : invitation.granted
          ? `${portal}/account/#boats`
          : race
            ? `${portal}/join/${encodeURIComponent(invitation.token)}/`
            : `${portal}/account/?invite=${encodeURIComponent(invitation.token)}`;
      const role =
        invitation.role === "manager"
          ? "skipper"
          : invitation.role === "crew"
            ? "crew"
            : "skipper";
      const scope = invitation.series ? ` in ${invitation.series}` : "";
      const accessText = invitation.handover
        ? `You have been invited to take responsibility for ${invitation.boat} in Veetr.\n\nAccepting makes you its responsible skipper, with control of the boat profile and crew. The previous custodian loses boat access; their series permissions are unchanged. This manages the Veetr record, not legal ownership of the vessel.\n\nSign in or create a Veetr account with this email address, verify it, then preview and accept the boat:\n${link}\n\nThis invitation expires in 7 days. Until you accept, access stays unchanged. If unexpected, ignore this invitation.`
        : invitation.granted
          ? `You now have ${role} access to ${invitation.boat}${scope}.\n\nSign in with this email address to view your access:\n${link}\n\nThis does not start location sharing or transfer boat ownership.`
          : `You've been invited as ${role} for ${invitation.boat}${scope}.\n\nSign in or create an account with this email address, verify your email, then accept:\n${link}\n\nThis invitation expires in 7 days. It does not transfer boat ownership. Location sharing only starts when you choose to share.\n\nIf you weren't expecting this invitation, you can ignore it.`;
      const sendRequest = {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": team
            ? `series-team-invitation/${invitation.deliveryKey}`
            : race
              ? `race-invitation/${invitation.deliveryKey}`
              : `boat-invitation/${invitationId}`,
        },
        body: JSON.stringify({
          from: "Veetr <hello@veetr.org>",
          to: [invitation.email],
          subject: team
            ? invitation.language === "cs"
              ? `Veetr: pozvánka do týmu · ${invitation.series}`
              : `Veetr: series team invitation · ${invitation.series}`
            : race
              ? `Veetr: ${invitation.boat} · ${series ? invitation.series : invitation.race}`
              : `Veetr: ${invitation.granted ? "access granted" : "invitation"} for ${invitation.boat}`,
          text: team
            ? seriesTeamEmail(invitation, link)
            : series
              ? `Pozvánka / Invitation: ${invitation.boat} · ${invitation.series}\n\nTento odkaz propojí telefon s lodí pro celý seriál. V aplikaci Veetr pak vyberte závod a potvrďte připravenost. Účet není potřeba.\n\nPair your phone once for this series. In Veetr, choose a race and press Ready to race. No account needed. Location sharing starts only after you confirm and the referee enables tracking for that race.\n${link}\n\nKeep this link private. It works for this series until the organiser cancels it or removes the boat.`
              : race
                ? `Pozvánka / Invitation: ${invitation.boat} · ${series ? invitation.series : invitation.race}\n\nOtevřete odkaz v aplikaci Veetr a potvrďte připravenost k závodu. Účet není potřeba. Sdílení polohy začne až po potvrzení v aplikaci a spuštění rozhodčím.\n\nOpen this link in Veetr and press Ready to race. No account needed. Location sharing starts only after you confirm and the referee enables tracking.\n${link}\n\nAktuální čas startu najdete v pozvánce. / Open the invitation for the current start time.`
                : accessText,
        }),
      };
      const sent = localSend
        ? await localSend(JSON.parse(sendRequest.body))
        : await fetcher("https://api.resend.com/emails", sendRequest);
      if (!sent.ok)
        return reply(502, "Email delivery failed. Please retry in a minute.");
      const marked = await fetcher(
        `${base}/rest/v1/rpc/${team ? "mark_series_team_invitation_sent" : series ? "mark_series_invitation_sent" : race ? "mark_race_invitation_sent" : "mark_boat_invitation_sent"}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invitation_id: team
              ? teamInvitationId
              : race
                ? invitation.id
                : invitationId,
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
      return reply(500, "Unable to send invitation. Please retry in a minute.");
    }
  };
}

// Plain-text email keeps custom messages inert and avoids HTML injection.
export function seriesTeamEmail(invitation, link) {
  const cs = invitation.language === "cs";
  const role =
    invitation.role === "admin"
      ? cs
        ? "správce seriálu"
        : "series manager"
      : cs
        ? "rozhodčí"
        : "referee";
  const message = invitation.message
    ? cs
      ? `\n\nZpráva od pořadatele:\n${invitation.message}`
      : `\n\nMessage from the organiser:\n${invitation.message}`
    : "";
  return cs
    ? `Pozvánka do týmu seriálu ${invitation.series} v aplikaci Veetr. Role: ${role}.${message}\n\nOtevřete pozvánku, přihlaste se nebo si vytvořte účet a potvrďte přijetí. Můžete použít svůj stávající účet i s jinou e-mailovou adresou. Přístup se propojí s účtem, ve kterém pozvánku přijmete.\n${link}\n\nPozvánka platí 7 dní od vytvoření. Odkaz nepřeposílejte: kdokoli s ním může pozvánku přijmout. Pokud pozvánku neočekáváte, ignorujte ji.`
    : `You are invited to the ${invitation.series} series team in Veetr as a ${role}.${message}\n\nOpen the invitation, sign in or create an account, then confirm acceptance. You can use your existing account with a different email address. Access will be linked to the account you accept with.\n${link}\n\nThis invitation expires 7 days after creation. Keep this link private: anyone with it can accept. If you were not expecting this invitation, ignore it.`;
}
