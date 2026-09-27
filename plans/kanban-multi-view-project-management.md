# Kanban Board Multi-View and Project Management Implementation Plan

## Overview
This plan outlines the implementation of multiple views (Kanban, List, Calendar, Timeline) and project management capabilities for the kanban board application.

## Current State Analysis

### Existing Infrastructure
- **Database Schema**: [`KanbanProject`](prisma/schema.prisma:107) and [`KanbanCard`](prisma/schema.prisma:120) models already exist
- **API Routes**: Project CRUD operations at [`/api/kanban/projects`](src/app/api/kanban/projects/route.ts:1)
- **UI Components**: 
  - [`KanbanBoard`](src/components/kanban/KanbanBoard.tsx:1) - Current kanban view
  - [`KanbanCard`](src/components/kanban/KanbanCard.tsx:1) - Individual card component
  - [`ViewToggle`](src/components/crm/ViewToggle.tsx:1) - Pattern for view switching
- **Page**: [`KanbanBoardPage`](src/app/kanban-board-view/page.tsx:1) - Main kanban board page

### Database Schema
```prisma
model KanbanProject {
  id          String       @id @default(cuid())
  name        String
  description String?
  color       String?      // Hex color for project visualization
  workspaceId String
  order       Int          @default(0)
  workspace   Workspace    @relation(fields: [workspaceId], references: [id])
  cards       KanbanCard[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model KanbanCard {
  id          String         @id @default(cuid())
  title       String
  description String?
  status      String         @default("todo")
  priority    String         @default("medium")
  tags        String?        // JSON array
  workspaceId String
  projectId   String?        // Optional project association
  order       Int            @default(0)
  dueDate     DateTime?
  assignees   String?        // JSON array
  // ... other fields
  project     KanbanProject? @relation(fields: [projectId], references: [id])
}
```

## Implementation Plan

### Phase 1: Project Management Infrastructure

#### 1.1 Project Sidebar Component
**File**: `src/components/kanban/ProjectSidebar.tsx`

**Features**:
- Display list of projects for current workspace
- Show project name, color indicator, and card count
- Active project highlighting
- "Add Project" button
- Project hover actions (edit, delete)
- Collapsible sidebar
- Search/filter projects

**Props Interface**:
```typescript
interface ProjectSidebarProps {
  workspaceId: string;
  projects: KanbanProject[];
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string | null) => void;
  onProjectCreate: () => void;
  onProjectEdit: (project: KanbanProject) => void;
  onProjectDelete: (projectId: string) => void;
  loading?: boolean;
}
```

**UI Layout**:
```
┌─────────────────────────┐
│ Projects               │
│ ─────────────────────── │
│ ▸ All Cards (24)       │
│   Website Redesign (12) │
│   Mobile App (8)        │
│   Marketing (4)         │
│                         │
│ [+ Add Project]         │
└─────────────────────────┘
```

#### 1.2 Project Modal Component
**File**: `src/components/kanban/ProjectModal.tsx`

**Features**:
- Create/Edit project form
- Name input (required)
- Description textarea (optional)
- Color picker (predefined colors + custom)
- Order field (auto-calculated)
- Form validation
- Error handling

**Props Interface**:
```typescript
interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => Promise<void>;
  project?: KanbanProject | null; // null = create mode
  loading?: boolean;
}

interface ProjectFormData {
  name: string;
  description?: string;
  color?: string;
}
```

**Predefined Colors**:
- #6366f1 (Indigo)
- #8b5cf6 (Violet)
- #ec4899 (Pink)
- #f43f5e (Rose)
- #f97316 (Orange)
- #eab308 (Yellow)
- #22c55e (Green)
- #14b8a6 (Teal)
- #0ea5e9 (Sky)
- #64748b (Slate)

#### 1.3 Update API Routes
**File**: `src/app/api/kanban/projects/[id]/route.ts` (Update existing)

**Enhancements**:
- Add DELETE endpoint for project deletion
- Add PUT endpoint for project updates
- Handle card reassignment when deleting project
- Add validation for project name uniqueness

**New Endpoints**:
```typescript
PUT /api/kanban/projects/[id]  // Update project
DELETE /api/kanban/projects/[id] // Delete project
```

### Phase 2: View Toggle Component

#### 2.1 Enhanced View Toggle
**File**: `src/components/kanban/ViewToggle.tsx`

**Features**:
- 4 view modes: Kanban, List, Calendar, Timeline
- Icons for each view
- Responsive design
- Accessible labels
- Active state indication

**Icons**:
- Kanban: `Columns` (lucide-react)
- List: `Table2` (lucide-react)
- Calendar: `Calendar` (lucide-react)
- Timeline: `Gantt` (lucide-react) or `Timeline`

**Props Interface**:
```typescript
type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}
```

### Phase 3: View Components

#### 3.1 List/Table View Component
**File**: `src/components/kanban/KanbanListView.tsx`

**Features**:
- Table display of all cards
- Sortable columns (title, status, priority, due date, assignees, project)
- Filterable columns
- Inline editing support
- Row actions (edit, delete)
- Pagination or infinite scroll
- Export functionality

**Columns**:
- Card title (with link to card details)
- Status badge (todo/inprogress/done)
- Priority badge (low/medium/high)
- Due date (with overdue highlighting)
- Assignees (avatar list)
- Tags (chip list)
- Project (with color indicator)
- Actions (edit, delete)

**Props Interface**:
```typescript
interface KanbanListViewProps {
  cards: KanbanCard[];
  projects: KanbanProject[];
  onCardUpdate: (cardId: string, updates: any) => void;
  onCardDelete: (cardId: string) => void;
  filter?: KanbanFilter;
  loading?: boolean;
}
```

#### 3.2 Calendar View Component
**File**: `src/components/kanban/KanbanCalendarView.tsx`

**Features**:
- Monthly calendar view
- Cards displayed on due dates
- Color-coded by status or project
- Day/week/month toggle
- Drag and drop to change due dates
- Click to view card details
- Navigate between months

**Dependencies**:
- Consider using `date-fns` for date manipulation
- Or `react-calendar` library

**Props Interface**:
```typescript
interface KanbanCalendarViewProps {
  cards: KanbanCard[];
  projects: KanbanProject[];
  onCardUpdate: (cardId: string, updates: any) => void;
  onCardClick: (card: KanbanCard) => void;
  filter?: KanbanFilter;
  currentDate?: Date;
}

type CalendarView = 'month' | 'week' | 'day';
```

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ < March 2025 > [Month|Week|Day]        │
├─────────────────────────────────────────┤
│ Sun  Mon  Tue  Wed  Thu  Fri  Sat       │
│  1    2    3    4    5    6    7        │
│      ●    ●         ●                  │
│  8    9   10   11   12   13   14        │
│  ●         ●    ●                      │
│ ...                                     │
└─────────────────────────────────────────┘
```

#### 3.3 Timeline/Gantt View Component
**File**: `src/components/kanban/KanbanTimelineView.tsx`

**Features**:
- Gantt chart visualization
- Cards displayed as bars on timeline
- Duration based on creation date to due date
- Group by project or status
- Zoom levels (day/week/month)
- Drag to resize (change duration)
- Drag to move (change dates)
- Milestone markers

**Dependencies**:
- Consider using `@gantt-task/react` or `react-gantt-chart`
- Or build custom with CSS grid

**Props Interface**:
```typescript
interface KanbanTimelineViewProps {
  cards: KanbanCard[];
  projects: KanbanProject[];
  onCardUpdate: (cardId: string, updates: any) => void;
  onCardClick: (card: KanbanCard) => void;
  filter?: KanbanFilter;
  startDate?: Date;
  endDate?: Date;
}

type TimelineZoom = 'day' | 'week' | 'month';
type TimelineGroupBy = 'project' | 'status' | 'priority' | 'none';
```

**UI Layout**:
```
┌────────────────────────────────────────────────┐
│ [◀] March 2025 [▶] [Day|Week|Month]           │
├────────────────────────────────────────────────┤
│ Project            Mar 1   Mar 8   Mar 15      │
│ ───────────────────────────────────────────────│
│ Website Redesign   ████████                   │
│                    ████████                   │
│ Mobile App         ████████████████████████   │
│ Marketing          ████████████               │
└────────────────────────────────────────────────┘
```

### Phase 4: Integration

#### 4.1 Update Kanban Board Page
**File**: `src/app/kanban-board-view/page.tsx`

**Changes**:
- Add project sidebar integration
- Add view toggle state management
- Add project selection state
- Update card fetching to filter by project
- Integrate all view components
- Update breadcrumbs
- Add project-specific filtering

**New State**:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('kanban');
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [projects, setProjects] = useState<KanbanProject[]>([]);
const [showProjectModal, setShowProjectModal] = useState(false);
const [editingProject, setEditingProject] = useState<KanbanProject | null>(null);
```

**New Functions**:
```typescript
const fetchProjects = async () => { /* ... */ };
const handleProjectCreate = async (data: ProjectFormData) => { /* ... */ };
const handleProjectUpdate = async (id: string, data: ProjectFormData) => { /* ... */ };
const handleProjectDelete = async (id: string) => { /* ... */ };
const handleProjectSelect = (projectId: string | null) => { /* ... */ };
```

**Layout Structure**:
```
┌─────────────────────────────────────────────────────┐
│ AppShell (header, workspace switcher)               │
├──────────────────┬──────────────────────────────────┤
│                  │ Breadcrumbs                       │
│                  │ ─────────────────                 │
│                  │ View Toggle  |  Filter Bar        │
│                  │ ─────────────────                 │
│ Project Sidebar  │                                    │
│                  │  [Current View Component]         │
│                  │                                    │
│                  │                                    │
└──────────────────┴──────────────────────────────────┘
```

#### 4.2 Update Kanban Board Component
**File**: `src/components/kanban/KanbanBoard.tsx`

**Changes**:
- Add project filtering support
- Add project badge to cards
- Update card display to show project info
- Ensure drag-and-drop works with project filtering

#### 4.3 Update Kanban Card Component
**File**: `src/components/kanban/KanbanCard.tsx`

**Changes**:
- Display project badge with color
- Add project indicator in card header
- Allow project assignment in edit mode

### Phase 5: API Enhancements

#### 5.1 Update Kanban API Route
**File**: `src/app/api/kanban/route.ts`

**Changes**:
- Add `projectId` query parameter support
- Filter cards by project when provided
- Include project data in response

**Updated GET Endpoint**:
```typescript
GET /api/kanban?workspaceId={id}&projectId={id}
```

#### 5.2 Update Kanban Card API Route
**File**: `src/app/api/kanban/[id]/route.ts`

**Changes**:
- Allow updating `projectId` field
- Validate project exists and belongs to workspace
- Return project data in response

#### 5.3 Add Project Statistics Endpoint
**File**: `src/app/api/kanban/projects/[id]/stats/route.ts`

**Features**:
- Get statistics for a project
- Card counts by status
- Completion percentage
- Overdue cards count
- Total cards

**Response**:
```json
{
  "totalCards": 24,
  "todo": 8,
  "inprogress": 12,
  "done": 4,
  "overdue": 3,
  "completionPercentage": 16.67
}
```

### Phase 6: Styling and UX

#### 6.1 Color System
- Use project colors consistently across all views
- Ensure sufficient contrast for accessibility
- Add color legend in sidebar

#### 6.2 Responsive Design
- Sidebar: Collapsible on mobile, slide-out drawer
- Views: Responsive layouts for all screen sizes
- Touch-friendly interactions for mobile

#### 6.3 Loading States
- Skeleton loaders for all views
- Loading spinners for actions
- Optimistic UI updates

#### 6.4 Error Handling
- Clear error messages
- Retry mechanisms
- Graceful degradation

### Phase 7: Testing

#### 7.1 Unit Tests
- Project sidebar component
- Project modal component
- View toggle component
- Each view component
- API routes

#### 7.2 Integration Tests
- Project creation, editing, deletion
- View switching
- Project filtering
- Card operations across views

#### 7.3 E2E Tests
- Complete user flows
- Cross-browser testing
- Mobile responsiveness

### Phase 8: Documentation

#### 8.1 User Documentation
- How to create and manage projects
- How to use different views
- How to filter cards by project
- Keyboard shortcuts

#### 8.2 Developer Documentation
- Component API documentation
- API endpoint documentation
- Architecture overview
- Contributing guidelines

## Implementation Order

1. **Phase 1**: Project management infrastructure (sidebar, modal, API updates)
2. **Phase 2**: View toggle component
3. **Phase 3**: Build view components (List, Calendar, Timeline)
4. **Phase 4**: Integration with main page
5. **Phase 5**: API enhancements
6. **Phase 6**: Styling and UX improvements
7. **Phase 7**: Testing
8. **Phase 8**: Documentation

## Dependencies

### Required Packages
```json
{
  "date-fns": "^3.0.0",           // Date manipulation
  "react-calendar": "^4.8.0",     // Calendar view
  "@gantt-task/react": "^3.1.0"  // Gantt chart (optional)
}
```

### Optional Packages
```json
{
  "lucide-react": "^0.300.0",     // Icons (already installed)
  "react-beautiful-dnd": "^13.1.1" // Drag and drop (already installed)
}
```

## File Structure

```
src/
├── app/
│   └── kanban-board-view/
│       └── page.tsx                    # Main page (update)
├── components/
│   └── kanban/
│       ├── KanbanBoard.tsx             # Existing (update)
│       ├── KanbanCard.tsx              # Existing (update)
│       ├── ProjectSidebar.tsx          # NEW
│       ├── ProjectModal.tsx            # NEW
│       ├── ViewToggle.tsx              # NEW
│       ├── KanbanListView.tsx          # NEW
│       ├── KanbanCalendarView.tsx      # NEW
│       └── KanbanTimelineView.tsx      # NEW
└── app/
    └── api/
        └── kanban/
            ├── route.ts                # Update
            ├── [id]/
            │   └── route.ts            # Update
            ├── projects/
            │   ├── route.ts            # Existing (update)
            │   └── [id]/
            │       ├── route.ts        # Update (add PUT/DELETE)
            │       └── stats/
            │           └── route.ts    # NEW
```

## Success Criteria

- [x] Users can create, edit, and delete projects
- [x] Users can switch between projects using sidebar
- [x] Users can filter cards by project
- [x] Four view modes work correctly (Kanban, List, Calendar, Timeline)
- [x] All views support project filtering
- [x] Project colors are consistent across views
- [x] Responsive design works on all devices
- [x] Performance is acceptable (smooth interactions)
- [x] Error handling is robust
- [x] Documentation is complete

## Potential Challenges

1. **Calendar View Complexity**: Implementing a full calendar with drag-and-drop may be complex
   - Solution: Start with basic calendar, add advanced features iteratively

2. **Timeline View Performance**: Rendering many cards on a timeline may be slow
   - Solution: Implement virtualization and lazy loading

3. **Project Deletion**: What happens to cards when a project is deleted?
   - Solution: Move cards to "All Cards" (projectId = null) or require confirmation

4. **State Management**: Managing view state, project state, and filter state
   - Solution: Use URL parameters for state persistence

5. **Mobile Responsiveness**: Complex views on small screens
   - Solution: Prioritize Kanban view on mobile, simplify other views

## Future Enhancements

1. **Project Templates**: Pre-defined project templates with common card structures
2. **Project Permissions**: Role-based access control for projects
3. **Project Archiving**: Archive old projects to reduce clutter
4. **Project Dependencies**: Define dependencies between projects
5. **Advanced Filtering**: More sophisticated filtering options
6. **Bulk Operations**: Bulk move, delete, or update cards
7. **Project Dashboard**: Overview page with project statistics
8. **Project Templates**: Save project structures as templates
9. **Time Tracking**: Track time spent on cards per project
10. **Project Reports**: Generate reports for projects

## Notes

- All new components should follow existing code style and patterns
- Use TypeScript for type safety
- Follow Material Design 3 guidelines for styling
- Ensure accessibility (WCAG 2.1 AA compliance)
- Add comprehensive error handling
- Include loading states for all async operations
- Use optimistic UI updates where possible
- Persist view preferences in localStorage
