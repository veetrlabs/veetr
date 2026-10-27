import type { Language } from "./i18n";

// Metadata is a communication preference only; never use it for permissions.
async function writeAccountLanguage(
  auth: {
    getUser: () => Promise<{
      data: {
        user: { id: string; user_metadata: Record<string, unknown> } | null;
      };
      error: unknown;
    }>;
    updateUser: (attributes: {
      data: { preferred_language: Language };
    }) => Promise<{ error: unknown }>;
  },
  userId: string,
  language: Language,
) {
  const { data, error } = await auth.getUser();
  if (error) throw error;
  if (
    !data.user ||
    data.user.id !== userId ||
    data.user.user_metadata.preferred_language === language
  )
    return;
  const result = await auth.updateUser({
    data: { preferred_language: language },
  });
  if (result.error) throw result.error;
}

// Header changes, login effects, and account settings share one write queue.
let pending: Promise<void> = Promise.resolve();
export function rememberAccountLanguage(
  ...args: Parameters<typeof writeAccountLanguage>
): Promise<void> {
  pending = pending.catch(() => {}).then(() => writeAccountLanguage(...args));
  return pending;
}
