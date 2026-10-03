'use client';

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { UserDirectory } from "@/components/chat/types";
import { useAppStore } from "@/store/appStore";
import { cachedJson, peekCached } from "@/lib/client-cache";

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string;
}

interface Workspace {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  owner?: WorkspaceUser;
  members?: { user: WorkspaceUser }[];
}

// Client-only: keeps the Ably SDK out of the server bundle and guarantees no websocket is
// ever opened during SSR.
const ChatRealtimeProvider = dynamic(
  () => import("@/components/chat/ChatRealtimeProvider").then((m) => m.ChatRealtimeProvider),
  { ssr: false },
);
const WorkspaceChat = dynamic(
  () => import("@/components/chat/WorkspaceChat").then((m) => m.WorkspaceChat),
  { ssr: false },
);

export default function WorkspaceChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;
  const { setWorkspace } = useAppStore();

  const url = `/api/workspaces/${workspaceId}`;
  // Shares the shell's cached workspace request, so returning to chat is instant
  const [workspace, setWorkspaceState] = useState<Workspace | null>(
    () => peekCached<{ workspace?: Workspace }>(url)?.workspace ?? null,
  );

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session || !workspaceId) return;
    setWorkspace(workspaceId);
    cachedJson<{ workspace?: Workspace }>(url)
      .then((data) => {
        if (data.workspace) setWorkspaceState(data.workspace);
        else router.push("/dashboard");
      })
      .catch(() => router.push("/dashboard"));
  }, [session, workspaceId, url, setWorkspace, router]);

  // Owner + accepted members: resolves user ids to trusted display names.
  // The owner has no WorkspaceMember row, so they must be added explicitly.
  const directory = useMemo<UserDirectory>(() => {
    const dir: UserDirectory = {};
    if (!workspace) return dir;
    if (workspace.owner) dir[workspace.owner.id] = { name: workspace.owner.name, email: workspace.owner.email };
    for (const m of workspace.members ?? []) dir[m.user.id] = { name: m.user.name, email: m.user.email };
    return dir;
  }, [workspace]);

  return (
    <AppShell
      workspace={workspace ? { id: workspace.id, name: workspace.name, icon: workspace.icon || undefined } : undefined}
    >
      <div className="h-full overflow-hidden">
        {session && workspace ? (
          <ChatRealtimeProvider workspaceId={workspaceId}>
            <WorkspaceChat workspaceId={workspaceId} directory={directory} />
          </ChatRealtimeProvider>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-secondary" />
          </div>
        )}
      </div>
    </AppShell>
  );
}
