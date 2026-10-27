import { supabase } from "./api";
export interface TeamInvitation {
  id: string;
  email: string;
  role: "admin" | "official";
  sent: boolean;
  status: "pending" | "accepted" | "expired" | "revoked";
  acceptedEmail?: string;
}
export interface TeamInvitationPreview {
  series: string;
  role: "admin" | "official";
  message: string;
  expiresAt: string;
  status: TeamInvitation["status"];
}
function client() {
  if (!supabase) throw new Error("Cloud is not configured");
  return supabase;
}
export async function checkTeammate(sid: string, recipient: string) {
  const { data, error } = await client().rpc("series_teammate_exists", {
    sid,
    recipient,
  });
  if (error) throw error;
  return data;
}
export async function createTeamInvitation(
  sid: string,
  recipient: string,
  role: "admin" | "official",
  language: "en" | "cs",
  message: string,
) {
  const { data, error } = await client().rpc("invite_series_teammate", {
    sid,
    recipient,
    member_role: role,
    email_language: language,
    custom_message: message,
  });
  if (error) throw error;
  return data;
}
export async function getTeamInvitations(sid: string) {
  const { data, error } = await client().rpc("series_team_invitations", {
    sid,
  });
  if (error) throw error;
  return data as unknown as TeamInvitation[];
}
export async function revokeTeamInvitation(id: string) {
  const { error } = await client().rpc("revoke_series_team_invitation", {
    invitation_id: id,
  });
  if (error) throw error;
}
export async function sendTeamInvitation(teamInvitationId: string) {
  const { error } = await client().functions.invoke("boat-invitation-email", {
    body: { teamInvitationId },
  });
  if (error) {
    let message =
      "Email could not be sent. Retry from the invitations list in a minute.";
    try {
      const body = await error.context?.json();
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
}
export async function previewTeamInvitation(token: string) {
  const { data, error } = await client().rpc("series_team_invitation_preview", {
    invite_token: token,
  });
  if (error) throw error;
  return data as unknown as TeamInvitationPreview | null;
}
export async function acceptTeamInvitation(token: string) {
  const { data, error } = await client().rpc("accept_series_team_invitation", {
    invite_token: token,
  });
  if (error) throw error;
  return data;
}
export const teamInviteStorage = "veetr.series-invite";
export function pendingTeamToken() {
  const token = new URLSearchParams(location.search).get("series-invite");
  try {
    if (token) sessionStorage.setItem(teamInviteStorage, token);
    return token || sessionStorage.getItem(teamInviteStorage);
  } catch {
    return token;
  }
}
