import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
    currentWorkspaceId: string | null;
    currentPageId: string | null;
    theme: 'light' | 'dark' | 'system';
    sidebarOpen: boolean;
    sidebarCollapsed: boolean;
    setWorkspace: (workspaceId: string | null) => void;
    setPage: (pageId: string | null) => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    toggleSidebar: () => void;
    toggleSidebarCollapsed: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            currentWorkspaceId: null,
            currentPageId: null,
            theme: 'system',
            sidebarOpen: true,
            sidebarCollapsed: false,
            setWorkspace: (workspaceId) => set({ currentWorkspaceId: workspaceId }),
            setPage: (pageId) => set({ currentPageId: pageId }),
            setTheme: (theme) => set({ theme }),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        }),
        {
            name: 'app-storage',
            partialize: (state) => ({
                currentWorkspaceId: state.currentWorkspaceId,
                theme: state.theme,
            }),
        }
    )
);
