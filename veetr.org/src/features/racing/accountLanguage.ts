import type { Language } from "./i18n";

// Metadata is a communication preference only; never use it for permissions.
export async function rememberAccountLanguage(
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
