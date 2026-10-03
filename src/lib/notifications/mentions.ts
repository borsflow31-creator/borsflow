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

/**
 * Structured mentions: chat's @-autocomplete inserts `<@userId>` tokens, which
 * resolve exactly (no name collisions). Only ids that belong to `members` count,
 * so a hand-typed token can't notify someone outside the workspace.
 */
export function extractMentionTokens(
  text: string,
  members: { id: string }[],
  excludeUserId?: string
): string[] {
  if (!text || !text.includes('<@')) return [];
  const memberIds = new Set(members.map((m) => m.id));
  const found = new Set<string>();
  for (const match of Array.from(text.matchAll(/<@([A-Za-z0-9_-]{1,64})>/g))) {
    const id = match[1];
    if (id !== excludeUserId && memberIds.has(id)) found.add(id);
  }
  return Array.from(found);
}
