import { createInvitationHandler } from "./handler.mjs";
// Explicit local-only transport: capture development mail, never send it externally.
let localSend;
if (Deno.env.get("LOCAL_MAILCATCHER") === "true") {
  const backend = new URL(Deno.env.get("SUPABASE_URL")!);
  const portal = new URL(Deno.env.get("PORTAL_URL")!);
  if (!["kong", "supabase_kong_veetr", "localhost", "127.0.0.1"].includes(backend.hostname) ||
      !["localhost", "127.0.0.1"].includes(portal.hostname)) {
    throw new Error("Mailcatcher is restricted to local development");
  }
  const { default: nodemailer } = await import("npm:nodemailer@7.0.10");
  // The local Edge Runtime's Node DNS resolver does not resolve Docker aliases.
  const smtpHost = Deno.env.get("LOCAL_SMTP_HOST");
  if (!smtpHost || !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(smtpHost)) {
    throw new Error("Start local functions with scripts/serve-local-functions.sh");
  }
  const transport = nodemailer.createTransport({
    host: smtpHost, port: 2500, secure: false,
    connectionTimeout: 10000, socketTimeout: 10000,
  });
  localSend = async (message: object) => {
    await transport.sendMail(message);
    return new Response(null, { status: 200 });
  };
}
Deno.serve(
  createInvitationHandler({
    PORTAL_URL: Deno.env.get("PORTAL_URL"),
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"),
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }, fetch, localSend),
);
