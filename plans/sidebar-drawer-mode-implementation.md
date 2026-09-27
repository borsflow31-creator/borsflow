# Sidebar Drawer Mode Implementation Plan

## Overview
Implement a sidebar drawer mode that shows only icons on specific pages:
- `/kanban-board-view?workspace={id}`
- `/workspaces/{id}`

## Current State Analysis

### AppShell.tsx (Lines 268-340)
- Sidebar has fixed width `w-64` (256px) on desktop
- Mobile: Uses `translate-x-0` when open, `-translate-x-full` when closed
- Shows both icons and labels for navigation items
- Controlled by global `sidebarOpen` boolean state from appStore

### appStore.ts
- `sidebarOpen`: boolean (default: true)
- `toggleSidebar()`: toggles the boolean state
- No support for collapsed/icon-only mode

## Proposed Solution

### 1. Update appStore State
Add support for sidebar collapsed mode:

```typescript
interface AppState {
    currentWorkspaceId: string | null;
    currentPageId: string | null;
    theme: 'light' | 'dark' | 'system';
    sidebarOpen: boolean;
    sidebarCollapsed: boolean;  // NEW: Track collapsed/icon-only state
    setWorkspace: (workspaceId: string | null) => void;
    setPage: (pageId: string | null) => void;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    toggleSidebar: () => void;
    toggleSidebarCollapsed: () => void;  // NEW: Toggle collapsed mode
}
```

### 2. Modify AppShell Component

#### Route Detection Logic
Detect when on specific routes and auto-collapse sidebar:

```typescript
// Detect routes that should have collapsed sidebar
const shouldCollapseSidebar = useMemo(() => {
    return pathname.startsWith('/kanban-board-view') || 
           pathname.startsWith('/workspaces/');
}, [pathname]);

// Auto-collapse sidebar on these routes
useEffect(() => {
    if (shouldCollapseSidebar && !sidebarCollapsed) {
        toggleSidebarCollapsed();
    }
}, [shouldCollapseSidebar, sidebarCollapsed, toggleSidebarCollapsed]);
```

#### Sidebar Width Logic
Update sidebar width based on collapsed state:

```typescript
const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
const mainContentMargin = sidebarCollapsed ? 'ml-16' : 'ml-64';
```

#### Navigation Items Display
Show only icons when collapsed:

```typescript
<Link href={item.href} className="...">
    <NavIcon icon={item.icon} active={isItemActive} />
    {!sidebarCollapsed && <span className="...">{item.label}</span>}
</Link>
```

#### Workspace Section
Collapse workspace list when in collapsed mode:

```typescript
{!sidebarCollapsed && (
    <WorkspaceList
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceSelect={handleWorkspaceSelect}
        onCreateWorkspace={() => setShowCreateWorkspaceModal(true)}
        isLoading={isLoadingWorkspaces}
    />
)}
```

#### Invite Button
Hide invite button when collapsed:

```typescript
{effectiveWorkspace && canInviteUsers && !sidebarCollapsed && (
    <div className="px-4 py-3">
        <button onClick={() => setShowInviteUsersModal(true)}>
            <UserPlus className="h-4 w-4" />
            <span>Invite People</span>
        </button>
    </div>
)}
```

#### New Page Button
Show icon-only button when collapsed:

```typescript
<div className="p-4">
    <button
        onClick={handleCreatePage}
        disabled={isCreatingPage || !effectiveWorkspace}
        className="..."
    >
        {sidebarCollapsed ? (
            <Plus className="h-4 w-4" />
        ) : (
            <>
                {isCreatingPage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Plus className="h-4 w-4" />
                )}
                <span>{isCreatingPage ? 'Creating...' : !effectiveWorkspace ? 'Select Workspace' : 'New Page'}</span>
            </>
        )}
    </button>
</div>
```

### 3. Add Toggle Button
Add a button to toggle between expanded and collapsed modes:

```typescript
// In the sidebar, add a collapse/expand button
<button
    onClick={toggleSidebarCollapsed}
    className="absolute right-2 top-2 p-1.5 rounded-lg hover:bg-surface-container-highest transition-colors"
    title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
>
    {sidebarCollapsed ? (
        <ChevronRight className="h-4 w-4" />
    ) : (
        <ChevronLeft className="h-4 w-4" />
    )}
</button>
```

### 4. Tooltip Support (Optional Enhancement)
Add tooltips when hovering over icons in collapsed mode for better UX.

## Implementation Steps

1. **Update appStore.ts**
   - Add `sidebarCollapsed` state
   - Add `toggleSidebarCollapsed()` action
   - Update persist configuration if needed

2. **Modify AppShell.tsx**
   - Import `ChevronLeft` and `ChevronRight` icons
   - Add route detection logic for specific pages
   - Add useEffect to auto-collapse on target routes
   - Update sidebar width classes based on collapsed state
   - Update main content margin based on collapsed state
   - Conditionally hide labels when collapsed
   - Conditionally hide WorkspaceList when collapsed
   - Conditionally hide invite button when collapsed
   - Update New Page button for collapsed mode
   - Add collapse/expand toggle button

3. **Testing**
   - Test on `/kanban-board-view?workspace={id}` - sidebar should be collapsed
   - Test on `/workspaces/{id}` - sidebar should be collapsed
   - Test on other pages - sidebar should remain expanded
   - Test toggle button functionality
   - Test mobile responsiveness
   - Test that all functionality still works in collapsed mode

## Files to Modify

1. `src/store/appStore.ts` - Add collapsed state support
2. `src/components/AppShell.tsx` - Implement collapsed UI logic

## Expected Behavior

### On Target Routes (kanban-board-view, workspaces/[id])
- Sidebar is automatically collapsed to icon-only mode (64px width)
- Only navigation icons are visible
- Workspace list is hidden
- Invite button is hidden
- New Page button shows only the plus icon
- Toggle button appears to expand sidebar

### On Other Routes
- Sidebar remains expanded (256px width)
- All labels and components are visible
- Toggle button appears to collapse sidebar

### User Interaction
- User can manually toggle between expanded and collapsed modes
- Toggle button switches between left and right chevron icons
- Smooth transitions between states

## Edge Cases to Consider

1. **Route Changes**: When navigating away from target routes, should sidebar auto-expand?
   - Decision: Keep manual toggle state, don't auto-expand to avoid jarring UI changes

2. **Mobile View**: How does collapsed mode interact with mobile?
   - Decision: On mobile, use existing slide-out behavior, collapsed mode only applies to desktop

3. **Workspace Switch**: When switching workspaces on target routes?
   - Decision: Maintain collapsed state

4. **Persistence**: Should collapsed state persist across page refreshes?
   - Decision: Yes, persist in appStore (but not in localStorage to allow route-based behavior)
