import { UserManagement } from "./UserManagement";
import { MySeries } from "./MySeries";
import { InvitationAcceptance, MyBoats } from "./BoatAccess";
import { CreationAccess } from "./CreationAccess";
import { PasswordAuth } from "./PasswordAuth";
import { appHref } from "./routes";
import { t } from "./i18n";
import { useEffect, useState } from "react";
import { signOutAccount, supabase } from "./api";
interface Props {
  recovery?: boolean;
  onRecovered: () => void;
  userId: string;
  seriesId?: string;
}
type AccountTab = "series" | "boats" | "users" | "requests";
function currentTab(): AccountTab {
  const hash = window.location.hash.slice(1);
  if (hash === "users-title") return "users";
  return ["boats", "users", "requests"].includes(hash) ? hash as AccountTab : "series";
}
export function AccountPanel({
  userId,
  recovery,
  onRecovered,
  seriesId,
}: Props) {
  const editUserId = new URLSearchParams(window.location.search).get("edit-user") || undefined;
  const [tab, setTab] = useState<AccountTab>(currentTab);
  const [isAdmin, setAdmin] = useState(false);
  useEffect(() => {
    const update = () => setTab(currentTab());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    let active = true;
    setAdmin(false);
    if (userId) void supabase?.rpc("creation_access").then(({data}) => {
      if (active) setAdmin(Boolean((data as {admin?: boolean})?.admin));
    });
    return () => {active = false;};
  }, [userId]);
  const tabs: {id: AccountTab; label: string}[] = [
    {id: "series", label: "My series"}, {id: "boats", label: "My boats"},
    ...(isAdmin ? [{id: "users" as const, label: "Users"}, {id: "requests" as const, label: "Requests"}] : []),
  ];
  const activeTab = tabs.some(item => item.id === tab) ? tab : "series";
  const selectTab = (id: AccountTab) => {setTab(id); window.location.hash = id;};
  const [boatRefresh, setBoatRefresh] = useState(0);
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    void supabase?.auth
      .getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, [userId]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : String((e as { message?: string }).message ?? e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={`account-page ${!userId || recovery ? "account-page-auth" : ""}`}
      aria-labelledby="account-title"
    >
      <a
        className="account-back"
        href={editUserId ? appHref("?account") + "#users" : seriesId ? appHref(`?series=${seriesId}`) : appHref("/")}
      >
        {t(editUserId ? "Back to users" : "All series")}
      </a>
      <h1 id="account-title">{t(editUserId ? "Edit user" : "Account")}</h1>
      {supabase && userId && !recovery && !editUserId && (
          <div className="account-identity">
            <div>
              <strong>{email || "Signed-in account"}</strong>
              <small>{t("Signed in")}</small>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await signOutAccount();
                })
              }
            >
              {t("Sign out")}
            </button>
          </div>
      )}
      {supabase && !recovery && !editUserId && (
        <InvitationAcceptance
          key={userId}
          userId={userId}
          onAccepted={() => setBoatRefresh((n) => n + 1)}
        />
      )}
      {!supabase ? (
        <p>
          {t(
            "Cloud sign-in is not configured for this installation. Add the Supabase settings to enable sign-in and the committee workspace.",
          )}
        </p>
      ) : !userId || recovery ? (
        <PasswordAuth recovery={recovery} onRecovered={onRecovered} />
      ) : editUserId ? (
        <UserManagement key={`edit-${userId}-${editUserId}`} editUserId={editUserId} />
      ) : (
        <>
          <nav className="race-tabs account-tabs" role="tablist" aria-label={t("Account")}>
            {tabs.map((item, index) => <button key={item.id} id={`account-tab-${item.id}`}
              role="tab" aria-selected={activeTab === item.id} aria-controls={`account-panel-${item.id}`}
              tabIndex={activeTab === item.id ? 0 : -1} className={activeTab === item.id ? "selected" : ""}
              onClick={() => selectTab(item.id)} onKeyDown={event => {
                const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
                if (next < 0) return;
                event.preventDefault(); selectTab(tabs[next].id);
                document.getElementById(`account-tab-${tabs[next].id}`)?.focus();
              }}>{t(item.label)}</button>)}
          </nav>
          <div className="account-tab-panel" role="tabpanel" id={`account-panel-${activeTab}`} aria-labelledby={`account-tab-${activeTab}`}>
            {activeTab === "series" && <MySeries key={`series-${userId}`} userId={userId} />}
            {activeTab === "boats" && <MyBoats key={userId} refreshKey={boatRefresh} />}
            {activeTab === "users" && <UserManagement key={`admin-${userId}`} />}
            {activeTab === "requests" && <CreationAccess key={userId} />}
          </div>

        </>
      )}
      {message && (
        <p className="notice" role="status">
          {t(message)}
        </p>
      )}
    </section>
  );
}
