import { t } from "./i18n";
import React, { type ReactNode } from "react";
interface Props {
  userId: string;
  authReady: boolean;
  isPublic: boolean;
  browsingPublic?: boolean;
  children: ReactNode;
  publicContent?: ReactNode;
}
export function WorkspaceAccess({
  userId,
  authReady,
  isPublic,
  browsingPublic = false,
  children,
  publicContent,
}: Props) {
  if (isPublic) return <>{children}</>;
  if (!authReady)
    return (
      <>
        {publicContent}
        <section className="welcome" role="status">
          <h1>{t("Opening Race Control…")}</h1>
          <p>{t("Restoring your sign-in session.")}</p>
        </section>
      </>
    );
  if (!userId || browsingPublic) return <>{publicContent}</>;
  return <>{children}</>;
}
export function requireAccount(currentId: string, expectedId: string): void {
  if (!currentId || currentId !== expectedId)
    throw new Error("Sign in before making changes to the race workspace.");
}
