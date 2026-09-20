/** Accept only Veetr invitation URLs; never navigate to arbitrary pasted links. */
export function invitationToken(value: string): string | null {
  const match = value
    .trim()
    .match(
      /^(?:https:\/\/(?:www\.)?veetr\.org\/join\/|veetr:\/\/join\/)([a-f0-9-]{72})\/?(?:[?#].*)?$/i,
    );
  return match?.[1] ?? null;
}
