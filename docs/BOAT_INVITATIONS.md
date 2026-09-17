# Skipper invitations

## Referee

In a series, open **Fleet**. **Invite skipper** creates a seven-day email invitation for a boat already synced into that series. The recipient can be a new or existing account. The referee sees pending/expired invitations and connected skippers, and can copy the link, retry failed email delivery, resend, revoke an invitation, or remove an accepted member.

Resending issues a new link and invalidates the old pending link. Retrying failed delivery uses the same invitation and provider idempotency key. Email failure does not discard the invitation: the referee can copy its link. Both delivery and resending have a one-minute cooldown. The row shows Copy invitation link and one email action: Send email retries an unsent pending invitation; Resend invitation replaces a sent or expired invitation. Revocation is under More.

Invitations are restricted to the recipient's verified email address. A forwarded link cannot be accepted by another account. They grant series-specific skipper access, without changing the boat's permanent owner/editor roles or granting race-management access. `boats.created_by` records provenance separately from the existing profile-manager field `owner_id`; existing owners and editors retain their previous tracking rights.

In **Live map → Race tracking**, open tracking before the start so crews can check GPS. An explicitly opened window lasts 12 hours. Closing it stops the series' live sessions. Existing series with `status=active` remain available until the referee explicitly configures their window. Other series start with tracking closed. A boat still needs an entry in a published heat; publication alone no longer enables tracking in an inactive series.

## Skipper

1. Open the invitation and sign in or create an account with the invited email. Confirm the account if necessary. The email confirmation redirect retains the invitation.
2. Choose **Accept invitation**. The boat and its entered heats appear in **Account → My boats**.
3. Open the Veetr mobile app, sign in with the same account, and refresh eligible regattas. Once the tracking window is open and the boat is registered in a published heat, it appears in that list.
4. Choose **Join regatta & share tracking** and accept the existing public location/replay consent and location permissions.
5. If another phone is tracking, **Take over tracking** requires explicit confirmation and stops the previous live session. Uncertain network retries reuse the same session ID; they cannot silently stop a later session.

Removing a skipper immediately denies further uploads and removes their live/replay projection unless they independently retain legacy boat-owner/editor access. Closing a window hides live positions; previous replay consent still applies. Historical uploads are accepted only within the stopped session's timestamp bounds. Raw location data remains in the existing tracking tables and never enters scoring documents.

## Rollout

Apply `supabase/migrations/202609160001_boat_invitations.sql` on the current main migration history (including entity permissions, mobile tracking, replay, and audit migrations). Do not apply migration fragments from a pre-main checkout alongside that history.

Deploy the `boat-invitation-email` Edge Function. It uses the same Resend sender as creation-request email:

The Supabase production workflow deploys both email functions after migrations. The existing project-level Resend secret is shared; no new provider account or sending credential is required. Local Supabase is separate: run `sh supabase/scripts/serve-local-functions.sh` after `supabase start`. This explicitly enables the local SMTP transport and resolves the mailcatcher Docker address. Invitations are captured at http://127.0.0.1:54424 with acceptance links pointing to http://localhost:4321; they are not delivered to real inboxes. The script must remain running. Production continues to use Resend; its secrets are not copied locally.

- `RESEND_API_KEY`: configured in Edge Function secrets.
- `PORTAL_URL`: website origin, normally `https://veetr.org`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: supplied by Supabase.

The function invokes the preparation RPC with the caller's JWT; the service role only records delivery afterward. It never accepts a recipient email or destination URL from the client. No email is sent merely by accepting or previewing a link.

Add `https://veetr.org/account/**` to Supabase Auth's allowed redirect URLs so signup/password recovery can return to `/account/?invite=...`. Keep the existing exact account callback too. Local equivalents are in `supabase/config.toml`; restart local Auth after changing that file. The racing shell sets `Referrer-Policy: no-referrer` through a meta element to keep invitation URLs out of outgoing referrers.

Deploy the website and rebuild/distribute the mobile app for the takeover button. Existing app builds can use accepted skipper access through the unchanged `my_tracking_entries` and start/upload RPCs, but cannot explicitly take over an existing session.

Tests cover actual SQL authorization and lifecycle behavior with all current migrations, plus email authorization/failure handling and native takeover retries. No production migration or live email send is part of the implementation tests.
