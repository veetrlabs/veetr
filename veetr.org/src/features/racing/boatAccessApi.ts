import { supabase } from "./api";
import { integrated } from "./routes";
export interface Invitation {
  id: string;
  boatId: string;
  email: string;
  token: string | null;
  expiresAt: string;
  sent: boolean;
  status: "pending" | "accepted" | "expired";
}
export interface BoatMember {
  boatId: string;
  userId: string;
  email: string;
  role: string;
}
export interface BoatRoster {
  invitations: Invitation[];
  members: BoatMember[];
}
export interface MyBoat {
  boatId: string;
  boat: string;
  seriesId: string;
  series: string;
  role: string;
  open: boolean;
  eligible: boolean;
  races: { id: string; name: string; date: string }[];
}

function client() {
  if (!supabase) throw new Error("Cloud is not configured");
  return supabase;
}
export async function getBoatRoster(sid: string): Promise<BoatRoster> {
  const { data, error } = await client().rpc("boat_invitation_roster", { sid });
  if (error) throw error;
  return data as unknown as BoatRoster;
}
export async function inviteSkipper(
  sid: string,
  bid: string,
  recipient: string,
) {
  const { data, error } = await client().rpc("invite_boat_skipper", {
    sid,
    bid,
    recipient,
  });
  if (error) throw error;
  return data as unknown as { id: string; token: string };
}
export async function emailInvitation(invitationId: string) {
  const { error } = await client().functions.invoke("boat-invitation-email", {
    body: { invitationId },
  });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      if (response.status === 404)
        throw new Error("Invitation saved. The email service is unavailable. Copy the invitation link instead.");
      if (response.status === 503)
        throw new Error("Invitation saved. Email is not configured. Copy the invitation link instead.");
    }
    throw new Error(
      "Invitation saved, but email delivery failed. Copy the link or retry in a minute.",
    );
  }
}
export function invitationHref(token: string) {
  return `${window.location.origin}${integrated ? "/account/?" : "/?account&"}invite=${encodeURIComponent(token)}`;
}
export async function revokeInvitation(sid: string, invitation_id: string) {
  const { error } = await client().rpc("revoke_boat_access", {
    sid,
    invitation_id,
  });
  if (error) throw error;
}
export async function removeBoatMember(
  sid: string,
  bid: string,
  member_id: string,
) {
  const { error } = await client().rpc("revoke_boat_access", {
    sid,
    bid,
    member_id,
  });
  if (error) throw error;
}
export async function previewInvitation(invite_token: string) {
  const { data, error } = await client().rpc("boat_invitation_preview", {
    invite_token,
  });
  if (error) throw error;
  return data as { boat: string; series: string; status: string } | null;
}
export async function acceptInvitation(invite_token: string) {
  const { error } = await client().rpc("accept_boat_invitation", {
    invite_token,
  });
  if (error) throw error;
}
export async function getMyBoats(): Promise<MyBoat[]> {
  const { data, error } = await client().rpc("my_boats");
  if (error) throw error;
  return data as unknown as MyBoat[];
}
export async function getTrackingWindow(sid: string) {
  const { data, error } = await client().rpc("tracking_window", { sid });
  if (error) throw error;
  return data as { open: boolean; until: string | null };
}
export async function setTrackingWindow(sid: string, enabled: boolean) {
  const { error } = await client().rpc("set_tracking_window", { sid, enabled });
  if (error) throw error;
}
