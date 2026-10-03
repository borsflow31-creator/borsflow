-- Workspace chat realtime moves from Ably to Supabase Realtime (private channels).
--
-- Topics:
--   chat:<workspaceId>:<channelId>  server broadcasts messages; clients send typing + presence
--   chatsig:<workspaceId>           server-only signals (unread bumps, reactions, pins, ...)
--
-- Clients connect with a short-lived JWT minted by /api/workspaces/[id]/chat/token
-- (sub = our user id). Realtime checks these policies whenever a client joins a
-- topic, so access always follows live workspace/channel membership.
-- User ids are cuids, so we read the `sub` claim as text (auth.uid() casts to uuid).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.chat_topic_allowed(topic text, want_write boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid text := auth.jwt() ->> 'sub';
  kind text := split_part(topic, ':', 1);
  ws text := split_part(topic, ':', 2);
  ch text := split_part(topic, ':', 3);
  is_owner boolean;
  member_role text;
BEGIN
  IF uid IS NULL OR ws = '' THEN
    RETURN false;
  END IF;

  SELECT w."ownerId" = uid INTO is_owner FROM public."Workspace" w WHERE w.id = ws;
  IF is_owner IS NULL THEN
    RETURN false;
  END IF;

  IF NOT is_owner THEN
    SELECT m.role INTO member_role
    FROM public."WorkspaceMember" m
    WHERE m."workspaceId" = ws AND m."userId" = uid;
    IF member_role IS NULL THEN
      RETURN false;
    END IF;
    -- Viewers can read but not type into a channel (mirrors getChatAccess)
    IF want_write AND member_role = 'viewer' THEN
      RETURN false;
    END IF;
  END IF;

  IF kind = 'chatsig' THEN
    RETURN ch = '';
  END IF;
  IF kind <> 'chat' OR ch = '' THEN
    RETURN false;
  END IF;

  -- Same rule as visibleChannelWhere: public channels, private ones the user
  -- belongs to, and every channel for the workspace owner.
  RETURN EXISTS (
    SELECT 1 FROM public."Channel" c
    WHERE c.id = ch
      AND c."workspaceId" = ws
      AND (
        is_owner
        OR NOT c."isPrivate"
        OR EXISTS (
          SELECT 1 FROM public."ChannelMember" cm
          WHERE cm."channelId" = c.id AND cm."userId" = uid
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.chat_topic_allowed(text, boolean) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.chat_topic_allowed(text, boolean) TO authenticated;

-- Receive broadcasts and presence on any chat or signal topic the user can see
DROP POLICY IF EXISTS "chat: members receive" ON realtime.messages;
CREATE POLICY "chat: members receive"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.messages.extension IN ('broadcast', 'presence')
  AND private.chat_topic_allowed((SELECT realtime.topic()), false)
);

-- Appear online in a channel (viewers included)
DROP POLICY IF EXISTS "chat: members track presence" ON realtime.messages;
CREATE POLICY "chat: members track presence"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension = 'presence'
  AND (SELECT realtime.topic()) LIKE 'chat:%'
  AND private.chat_topic_allowed((SELECT realtime.topic()), false)
);

-- Typing indicators: writers only, channel topics only. Messages themselves are
-- broadcast by the server, and chatsig: topics never accept client sends.
DROP POLICY IF EXISTS "chat: writers broadcast" ON realtime.messages;
CREATE POLICY "chat: writers broadcast"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) LIKE 'chat:%'
  AND private.chat_topic_allowed((SELECT realtime.topic()), true)
);
