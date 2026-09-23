# User management

The Account page includes user management for existing platform administrators. A verified TOTP MFA session (`aal2`) is required before user records or administration actions are available. Ordinary users cannot discover the user directory.

## Roles

- Platform administrator: global series/boat management, account suspension, session revocation, role assignment, pending skipper invitations and access-audit history. Global privileges require MFA on every request.
- Series manager: the owner or a `race_officials.role = 'admin'` member of that series. Can manage its settings, fleet and team. This legacy database role is not a platform administrator.
- Referee: `race_officials.role = 'official'`. Can change entries, results and publishing state of existing heats and use race tracking controls. Cannot change series/heat settings or delegate access.
- Skipper (formerly Boat manager): the owner or a `boat_members.role = 'manager'` member. Can edit the profile and manage its crew. Boat ownership remains separate from series permissions.
- Crew: boat membership and tracking participation; no profile, team or scoring administration.
- Existing boat editors retain profile editing rights but cannot manage membership. Existing owners retain their scoped rights. Creating new series remains a separate approval.

Membership changes use protected database RPCs. Neither profile metadata nor browser state is an authorization source. Changing a role takes effect on the next database authorization check, regardless of existing JWT role claims.

## Suspension and session revocation

`account_security` is protected from client writes. Suspension denies authenticated Data API requests and protected table reads. It does not delete the user's records. Restoring an account requires a fresh sign-in.

Session revocation records a cutoff and checks the original `auth.sessions.created_at` using the verified JWT's session ID. Refreshing an old token does not restore access. Missing/unknown session IDs fail closed after revocation. Auth session rows are not directly modified; the restriction applies to Veetr data access. Supabase Auth itself may still accept sign-in or refresh requests. Anonymous public pages and independently issued race-phone capabilities are separate from account sessions.

The migration configures `public.check_account_access` as the Data API pre-request hook on `authenticator`. It refuses to overwrite an unrelated existing hook. RLS restrictive policies and explicit checks protect existing authenticated mutation RPCs as additional layers. Future authenticated RPCs must call `require_active_account()` and use the relevant scope check. Edge Functions that use service credentials must first authorize the caller with their JWT; service credentials never go to the browser.

## Administrator bootstrap and recovery

There is no public bootstrap or self-promotion endpoint. A trusted operator must verify the intended account's email and UUID, then insert that UUID into `public.platform_admins` through the Supabase SQL editor. The user then enrolls and verifies an authenticator on the Account page. Do not grant an administrator based solely on an unverified email or a browser request.

Keep at least two independently controlled administrator accounts enrolled in MFA. The last active administrator cannot be removed, including via a cascading Auth-user deletion. Administrators cannot suspend themselves. Recovery after losing all authenticators requires the trusted Supabase project operator to verify identity and restore an administrator through Supabase's supported Auth recovery tools. There is no application MFA bypass.

## Audit

Existing append-only audit triggers cover administrators, series creation grants, series teams and boat teams. Account suspension/session changes are also recorded. The admin UI exposes only access-related audit entries; ordinary users cannot read or modify them. Invitation tokens and MFA secrets are never included in this view. Database owners remain trusted operators and are outside the application's audit-write restrictions.

## Verification and release

Run `npm run test:race` and `npm run build:race`, then the website build. `supabase/tests/user-management.test.mjs` exercises real migrations, non-admin/anonymous denial, forged user metadata, missing MFA, cross-series delegation, crew restrictions, referee settings restrictions, last-admin protection, revocation, refreshed versus new sessions, suspension and audit protection.

Apply migrations before the website release, and deploy the updated `creation-request-email` function. Verify MFA enrollment and verification with real Supabase Auth before enabling production administration. The automated database tests use deterministic Auth claims. On 23 September 2026, a disposable account also passed a real local Supabase Auth smoke test: password sign-in, AAL1 denial, TOTP enrollment/verification, AAL2 administration, session revocation and rejection after refresh. The test account was deleted. Production Auth configuration still needs its own release verification. No platform administrator is appointed automatically by the migration.

Boat access is now global to the boat. Skipper uses the internal `manager` role and manages the profile and team; Crew can track all races the boat enters. Existing series skipper/crew memberships migrate to boat memberships (the strongest role wins). Historical series memberships no longer grant access. Race officials do not gain boat-management rights. Legacy invitation links require the sender still to have boat-management authority; otherwise a skipper must renew the invitation. Removing a member revokes their invitations and stops their tracking sessions. Race invitation recipients come from the boat team.

Boat responsibility is explicitly accepted. Legacy creators remain temporary custodians until handover, rather than being presented as vessel owners. The custodian or an MFA-verified administrator can issue a seven-day handover invitation. Even existing verified users must accept explicitly. Acceptance locks the boat, checks the current custodian and sender authority, changes responsibility, removes the previous custodian's boat membership, stops their tracking sessions, and revokes superseded invitations. Series permissions and creation provenance remain intact. This records responsibility for the Veetr profile, not legal vessel ownership.
