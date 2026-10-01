/**
 * Plain-text @mention detection.
 *
 * Comments and chat are plain textareas with no @-autocomplete, so there is no
 * structured mention token to read — this matches `@Full Name` or `@First` (word
 * boundary) against the workspace's own member list instead. It's a heuristic:
 * a member named "Al" will match inside "@Alan" only if there's no exact-first-
 * name collision, but it needs no UI changes to ship.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractMentionedUserIds(
  text: string,
  members: { id: string; name: string | null }[],
  excludeUserId?: string
): string[] {
  if (!text || !text.includes('@')) return [];

  const matched = new Set<string>();
  for (const member of members) {
    if (member.id === excludeUserId) continue;
    const name = member.name?.trim();
    if (!name) continue;

    const firstName = name.split(/\s+/)[0];
    // Try the full name first ("@Jane Doe"), then fall back to the first name
    // alone ("@Jane") so a one-word mention still resolves.
    const pattern = new RegExp(`@${escapeRegExp(name)}\\b|@${escapeRegExp(firstName)}\\b`, 'i');
    if (pattern.test(text)) matched.add(member.id);
  }

  return Array.from(matched);
}
