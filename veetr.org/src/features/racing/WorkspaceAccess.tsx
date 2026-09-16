export function requireAccount(currentId: string, expectedId: string): void {
  if (!currentId || currentId !== expectedId)
    throw new Error("Sign in before making changes to the race workspace.");
}
