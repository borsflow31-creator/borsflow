'use client';

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { UserDirectory } from "@/components/chat/types";
import { useAppStore } from "@/store/appStore";

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

  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!session || !workspaceId) return;
    setWorkspace(workspaceId);
    fetch(`/api/workspaces/${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.workspace) {
          setWorkspaceState(data.workspace);
        } else {
          router.push("/dashboard");
        }
      })
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [session, workspaceId, setWorkspace, router]);

  // Owner + accepted members: resolves realtime clientIds (user ids) to trusted display names.
  // The owner has no WorkspaceMember row, so they must be added explicitly.
  const directory = useMemo<UserDirectory>(() => {
    const dir: UserDirectory = {};
    if (!workspace) return dir;
    if (workspace.owner) dir[workspace.owner.id] = { name: workspace.owner.name, email: workspace.owner.email };
    for (const m of workspace.members ?? []) dir[m.user.id] = { name: m.user.name, email: m.user.email };
    return dir;
  }, [workspace]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <AppShell
      workspace={{
        id: workspace.id,
        name: workspace.name,
        icon: workspace.icon || undefined,
      }}
    >
      <div className="h-full overflow-hidden">
        <ChatRealtimeProvider workspaceId={workspaceId}>
          <WorkspaceChat
            workspaceId={workspaceId}
            isOwner={workspace.ownerId === session?.user?.id}
            directory={directory}
          />
        </ChatRealtimeProvider>
      </div>
    </AppShell>
  );
}
