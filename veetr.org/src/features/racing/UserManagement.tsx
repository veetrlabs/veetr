import { useEffect, useState, useRef, useId } from "react";
import { supabase } from "./api";
import { appHref } from "./routes";
import { t } from "./i18n";

type MemberRole = {scope: "series" | "boat"; id: string; name: string; role: string};
type ManagedUser = {id: string; email: string; verified: boolean; admin: boolean; suspended: boolean; seriesCreator: boolean; roles: MemberRole[]};
type PendingInvitation = {id: string; series_id: string; email: string; series_name: string; boat_name: string; expires_at: string};
type DirectoryEntry = {id: string | null; email: string; admin: boolean; suspended: boolean; invitations: PendingInvitation[]};
type Entity = {id: string; name: string};
type Audit = {id: number; occurred_at: string; actor_email: string; action: string; entity_table: string; entity_key: unknown; old_values: unknown; new_values: unknown};

function AccessConfirmation({message, busy, error, onCancel, onConfirm}: {
  message: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {element.close(); previous?.focus();};
  }, []);
  return <dialog ref={dialog} className="race-confirmation access-confirmation"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} aria-busy={busy}
    onCancel={event => {event.preventDefault(); if (!busy) onCancel();}}>
    <h2 id={`${id}-title`}>{t("Confirm access change")}</h2>
    <p id={`${id}-message`}>{message}</p>
    {error && <p role="alert">{t(error)}</p>}
    <div className="actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>{t("Cancel")}</button>
      <button type="button" disabled={busy} onClick={onConfirm}>{t("Confirm")}</button>
    </div>
  </dialog>;
}

export function UserManagement({editUserId}: {editUserId?: string}) {
  const [isAdmin, setAdmin] = useState(false), [verified, setVerified] = useState(false);
  const [factor, setFactor] = useState(""), [qr, setQr] = useState("");
  const [users, setUsers] = useState<DirectoryEntry[]>([]), [selected, setSelected] = useState<ManagedUser | null>(null);
  const [entities, setEntities] = useState<{series: Entity[]; boats: Entity[]}>({series: [], boats: []});
  const [audit, setAudit] = useState<Audit[]>([]), [scope, setScope] = useState<"series" | "boat">("series");
  const [search, setSearch] = useState(""), [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [pending, setPending] = useState<{label: string; action: () => Promise<void>} | null>(null);
  async function load(query = search, page = offset) {
    if (editUserId) {
      const result = await supabase!.rpc("admin_user", {target_user: editUserId});
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Account not found");
      setSelected(result.data as unknown as ManagedUser);
      const catalog = await supabase!.rpc("admin_entities");
      if (catalog.error) throw catalog.error;
      setEntities(catalog.data as unknown as typeof entities);
      return;
    }
    const result = await supabase!.rpc("admin_directory", {search_text: query, page_offset: page});
    if (result.error) throw result.error;
    setUsers(result.data as unknown as DirectoryEntry[]);
    setSelected(null);
    const catalog = await supabase!.rpc("admin_entities");
    if (catalog.error) throw catalog.error;
    setEntities(catalog.data as unknown as typeof entities);
    const history = await supabase!.rpc("admin_audit", {});
    if (history.error) throw history.error;
    setAudit(history.data as unknown as Audit[]);

  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try {await action();} catch (e) {
      setError((e as Error).message); setUsers([]); setSelected(null); setAudit([]);
    } finally {setBusy(false);}
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supabase) return;
      const access = await supabase.rpc("creation_access");
      if (access.error) throw access.error;
      if (!active) return;
      const admin = Boolean((access.data as {admin?: boolean})?.admin);
      setAdmin(admin);
      if (!admin) return;
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (!active) return;
      setVerified(assurance.data.currentLevel === "aal2");
      if (assurance.data.currentLevel === "aal2") await load();
      else {
        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        if (active) setFactor(factors.data.totp.find(f => f.status === "verified")?.id ?? "");
      }
    })().catch(e => {if (active) setError(e.message);});
    return () => {active = false;};
  }, []);
  if (!isAdmin) return editUserId ? <p role="status">{t(error || "Administrator access required.")}</p> : null;
  const confirm = (label: string, action: () => Promise<void>) => setPending({label, action});
  const access = async (user: ManagedUser, role: string, enabled: boolean) => {
    const result = await supabase!.rpc("admin_set_access", {target_user: user.id, access_role: role, enabled});
    if (result.error) throw result.error;
  };
  return <section className="user-management" aria-labelledby="users-title">
    <h2 id="users-title">{editUserId ? selected?.email || t("Edit user") : t("User management")}</h2>
    {error && <p role="alert">{t(error)}</p>}
    {!verified ? <>
      <p>{t("Verify with your authenticator app to manage users.")}</p>
      {!factor && <button disabled={busy} onClick={() => void run(async () => {
        const result = await supabase!.auth.mfa.enroll({factorType: "totp", issuer: "Veetr", friendlyName: `Veetr admin ${new Date().toISOString()}`});
        if (result.error) throw result.error;
        setFactor(result.data.id); setQr(result.data.totp.qr_code);
      })}>{t("Set up authenticator")}</button>}
      {qr && <img className="admin-mfa-qr" src={qr} alt={t("Scan with your authenticator app")} />}
      {factor && <form onSubmit={e => {
        e.preventDefault(); const code = String(new FormData(e.currentTarget).get("code"));
        void run(async () => {
          const result = await supabase!.auth.mfa.challengeAndVerify({factorId: factor, code});
          if (result.error) throw result.error;
          setQr(""); setVerified(true); await load();
        });
      }}><label>{t("Authenticator code")}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label><button disabled={busy}>{t("Verify")}</button></form>}
    </> : <>
      {!editUserId && <>
      <form className="user-search" onSubmit={e => {e.preventDefault(); setOffset(0); void run(() => load(search, 0));}}>
        <label>{t("Find a user by email")}<input value={search} maxLength={200} onChange={e => setSearch(e.target.value)} type="search" /></label>
        <button disabled={busy}>{t("Search")}</button>
      </form>
      <ul className="team-list">{users.map(user => <li key={user.id || user.email}>
        <div className="directory-person">
          {user.id ? <a href={appHref(`?account&edit-user=${encodeURIComponent(user.id)}`)}>{user.email}</a> : <strong>{user.email}</strong>}
          {user.invitations.map(invite => <div className="directory-invitation" key={invite.id}>
            <span>{invite.boat_name} · {invite.series_name}</span>
            <button disabled={busy || !!pending} onClick={() => confirm(`${t("Revoke invitation")}: ${user.email} · ${invite.boat_name}`, async () => {
              const result = await supabase!.rpc("revoke_boat_access", {sid: invite.series_id, invitation_id: invite.id});
              if (result.error) throw result.error;
            })}>{t("Revoke invitation")}</button>
          </div>)}
        </div>
        <div className="directory-status">
          {user.id && <span>{t(user.suspended ? "Suspended" : user.admin ? "Administrator" : "Active")}</span>}
          {!!user.invitations.length && <span className="invitation-badge">{t("Pending invitation")}</span>}
        </div>
      </li>)}</ul>
      {!busy && !users.length && <p>{t("No users found.")}</p>}
      <div className="form-actions">
        <button disabled={busy || offset === 0 || !!pending} onClick={() => {setOffset(offset - 50); void run(() => load(search, offset - 50));}}>{t("Previous")}</button>
        <button disabled={busy || users.length < 50 || !!pending} onClick={() => {setOffset(offset + 50); void run(() => load(search, offset + 50));}}>{t("Next")}</button>
      </div>
      </>}
      {selected && <div className="user-editor">
        <p>{t(selected.verified ? "Email verified" : "Email not verified")}</p>
        <ul className="user-memberships">{selected.roles.map(role => <li key={`${role.scope}-${role.id}`}>
          <div><strong>{role.name}</strong><span>{t(role.scope === "series" ? "Series" : "Boat")} · {t(role.role === "manager" ? role.scope === "series" ? "Series manager" : "Skipper" : role.role === "referee" ? "Referee" : role.role === "crew" ? "Crew" : role.role === "owner" ? "Owner" : "Editor")}</span></div>
          {role.role !== "owner" && <button disabled={busy || !!pending} onClick={() => confirm(`${t("Remove access")}: ${selected.email} · ${role.name}`, async () => {
            const result = await supabase!.rpc("admin_set_membership", {target_user: selected.id, entity_type: role.scope, entity_id: role.id, member_role: "remove"});
            if (result.error) throw result.error;
          })}>{t("Remove access")} · {role.name}</button>}
        </li>)}</ul>
        <form onSubmit={e => {
          e.preventDefault(); const data = new FormData(e.currentTarget);
          const entityId = String(data.get("entity")), role = String(data.get("role"));
          const name = (scope === "series" ? entities.series : entities.boats).find(v => v.id === entityId)?.name;
          confirm(`${t("Grant access")}: ${selected.email} · ${name} · ${t(role === "manager" ? scope === "series" ? "Series manager" : "Skipper" : role === "referee" ? "Referee" : "Crew")}`, async () => {
            const result = await supabase!.rpc("admin_set_membership", {target_user: selected.id, entity_type: scope, entity_id: entityId, member_role: role});
            if (result.error) throw result.error;
          });
        }}><fieldset disabled={busy || !!pending || selected.suspended}>
          <legend>{t("Assign a role")}</legend>
          <label>{t("Scope")}<select value={scope} onChange={e => setScope(e.target.value as typeof scope)}><option value="series">{t("Series")}</option><option value="boat">{t("Boat")}</option></select></label>
          <label>{t("Name")}<select name="entity" required key={scope}>{(scope === "series" ? entities.series : entities.boats).map(entity => <option value={entity.id} key={entity.id}>{entity.name}</option>)}</select></label>
          <label>{t("Role")}<select name="role" key={`role-${scope}`}><option value="manager">{t(scope === "series" ? "Series manager" : "Skipper")}</option><option value={scope === "series" ? "referee" : "crew"}>{t(scope === "series" ? "Referee" : "Crew")}</option></select></label>
          <button>{t("Grant access")}</button>
        </fieldset></form>
        <div className="form-actions">
          <button disabled={busy || !!pending} onClick={() => confirm(`${t(selected.admin ? "Remove administrator" : "Make administrator")}: ${selected.email}`, () => access(selected, "admin", !selected.admin))}>{t(selected.admin ? "Remove administrator" : "Make administrator")}</button>
          <button disabled={busy || !!pending} onClick={() => confirm(`${t(selected.seriesCreator ? "Revoke series creation" : "Allow series creation")}: ${selected.email}`, () => access(selected, "series_creator", !selected.seriesCreator))}>{t(selected.seriesCreator ? "Revoke series creation" : "Allow series creation")}</button>
          <button disabled={busy || !!pending} onClick={() => confirm(`${t(selected.suspended ? "Restore account" : "Suspend account")}: ${selected.email}`, async () => {
            const result = await supabase!.rpc("admin_set_account_status", {target_user: selected.id, suspend: !selected.suspended}); if (result.error) throw result.error;
          })}>{t(selected.suspended ? "Restore account" : "Suspend account")}</button>
          <button disabled={busy || !!pending} onClick={() => confirm(`${t("Revoke sessions")}: ${selected.email}`, async () => {
            const result = await supabase!.rpc("admin_revoke_sessions", {target_user: selected.id}); if (result.error) throw result.error;
          })}>{t("Revoke sessions")}</button>
        </div>
      </div>}
      {pending && <AccessConfirmation message={pending.label} busy={busy} error={error}
        onCancel={() => setPending(null)}
        onConfirm={() => void run(async () => {await pending.action(); setPending(null); await load();})} />}
      {!editUserId && <>
      <details><summary>{t("Access audit history")}</summary>
        <ul>{audit.map(item => <li key={item.id}>
          <strong>{new Date(item.occurred_at).toLocaleString()} · {item.actor_email ?? t("System")}</strong>
          <p>{item.action} · {item.entity_table}</p>
          <details><summary>{t("Change details")}</summary><pre>{JSON.stringify({target: item.entity_key, before: item.old_values, after: item.new_values}, null, 2)}</pre></details>
        </li>)}</ul>
        {audit.length >= 50 && <button disabled={busy} onClick={() => void run(async () => {
          const result = await supabase!.rpc("admin_audit", {before_id: audit[audit.length - 1].id});
          if (result.error) throw result.error; setAudit(result.data as unknown as Audit[]);
        })}>{t("Older changes")}</button>}
      </details>
      </>}
    </>}
  </section>;
}
