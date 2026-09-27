# Workspace Page Redesign - Rich Document Editor

## Overview
Transform the workspace page (`/workspaces/[id]/page.tsx`) from a page tree/overview layout to a rich document editor interface matching the reference HTML file.

## Reference Analysis

The reference HTML file ([`code.html`](stitch/rich_document_editor/code.html)) contains:

### 1. **Left Sidebar Navigation** (Lines 102-147)
- Brand logo with "Acme Corp" branding
- Navigation tabs:
  - Search
  - Inbox
  - My Tasks
  - **Workspace** (active state with border)
  - Settings
  - Templates
  - Trash
- Responsive design (collapsed on mobile, expanded on desktop)

### 2. **Top Navigation Bar** (Lines 149-174)
- Workspace title: "The Architect"
- Navigation tabs: Shared | Private
- Collaborator avatars (5 total)
- Action buttons: "Ask AI" and "Share"
- Additional icons: history, more_horiz

### 3. **Main Document Editor Area** (Lines 176-291)
- White page container with rounded corners
- Page breadcrumbs: "Product / Q4 Strategy / Architecture 2.0"
- Content blocks:
  - **Heading 1**: "Redefining Digital Workspace Architecture"
  - **Paragraph** with active cursor indicator (Alice is editing)
  - **Bulleted List** (3 items)
  - **Code Block** with copy button
- **Slash Command Menu** (visible overlay):
  - Basic Blocks: Heading 1, Text, Bullet List
  - Media: Image
- **Floating AI Toolbar** at bottom:
  - "Ask AI to fix..." section
  - Formatting tools: Bold, Italic, Underline, Link, Comment

### 4. **Right Comments Panel** (Lines 293-342)
- Comments header with filter icon
- Comment cards with:
  - User avatar and name
  - Timestamp
  - Comment content
  - Reply/Resolve buttons
- Active comment thread with typing indicator
- Comment input textarea with send button

## Current State Analysis

The current workspace page ([`page.tsx`](src/app/workspaces/[id]/page.tsx)) has:
- Page tree sidebar with search functionality
- Workspace overview with stats
- New page creation form
- Empty state for no pages
- Uses AppShell component for layout

## Implementation Plan

### Phase 1: Layout Structure Transformation

#### 1.1 Replace Page Tree Sidebar with Navigation Sidebar
- Remove current page tree sidebar
- Create new navigation sidebar component matching reference design
- Include: Brand logo, navigation tabs (Search, Inbox, My Tasks, Workspace, Settings, Templates, Trash)
- Implement responsive design (w-16 on mobile, w-64 on desktop)
- Add active state styling for Workspace tab

#### 1.2 Update Top Navigation Bar
- Replace current AppShell header with custom top navigation
- Add workspace title display
- Add navigation tabs (Shared | Private)
- Add collaborator avatars section
- Add action buttons (Ask AI, Share)
- Add utility icons (history, more_horiz)

#### 1.3 Redesign Main Content Area
- Remove workspace overview and stats
- Create white document editor container
- Add page breadcrumbs section
- Implement document editor area with sample content blocks

### Phase 2: Document Editor Components

#### 2.1 Content Blocks
- **Heading 1 Block**: Large heading with proper typography
- **Paragraph Block**: Text content with cursor indicator
- **Bulleted List Block**: List items with drag handles
- **Code Block**: Code display with language label and copy button

#### 2.2 Slash Command Menu
- Create floating menu component
- Include block categories: Basic Blocks, Media
- Implement block types: Heading 1, Text, Bullet List, Image
- Add hover states and icons
- Position at bottom of editor area

#### 2.3 Floating AI Toolbar
- Create fixed bottom toolbar
- Add "Ask AI to fix..." section with icon
- Add formatting tools: Bold, Italic, Underline, Link, Comment
- Style with dark background and rounded corners

### Phase 3: Comments Panel

#### 3.1 Comments Sidebar
- Create right sidebar component (hidden on smaller screens)
- Add comments header with filter icon
- Implement comment cards with:
  - User avatar and name
  - Timestamp
  - Comment content
  - Reply/Resolve buttons
- Add active comment thread with typing indicator
- Add comment input textarea with send button

### Phase 4: Styling and Theming

#### 4.1 Color Scheme Integration
- Ensure all colors match reference HTML:
  - Primary: #5f5e5e
  - Secondary: #4a4bd7
  - Surface: #f8f9fa
  - Background: #f8f9fa
  - All tertiary and variant colors

#### 4.2 Typography
- Use Inter font family
- Implement proper font weights and sizes
- Match line heights and letter spacing

#### 4.3 Icons
- Use Material Symbols Outlined icons
- Ensure proper icon sizes and colors
- Implement hover states for icons

#### 4.4 Spacing and Layout
- Match all margins, paddings, and gaps
- Implement proper responsive breakpoints
- Ensure consistent spacing scale (6-10 scale)

### Phase 5: Interactive Features

#### 5.1 Drag Handles
- Add drag handles to content blocks
- Show on hover with opacity transition
- Position at -left-8

#### 5.2 Cursor Indicators
- Implement real-time cursor indicator
- Show user name above cursor
- Style with secondary color

#### 5.3 Hover Effects
- Add hover states to navigation items
- Implement opacity transitions
- Add background color changes on hover

## Component Structure

```
src/app/workspaces/[id]/
├── page.tsx (main component)
├── components/
│   ├── NavigationSidebar.tsx
│   ├── TopNavigationBar.tsx
│   ├── DocumentEditor.tsx
│   ├── ContentBlock.tsx
│   ├── SlashCommandMenu.tsx
│   ├── FloatingAIToolbar.tsx
│   └── CommentsPanel.tsx
```

## Key Changes Required

### File: [`src/app/workspaces/[id]/page.tsx`](src/app/workspaces/[id]/page.tsx)

**Remove:**
- Page tree sidebar
- Workspace overview section
- Page stats section
- New page form
- Empty state for no pages

**Add:**
- Navigation sidebar
- Top navigation bar
- Document editor area
- Comments panel
- Sample content blocks
- Slash command menu
- Floating AI toolbar

**Modify:**
- Layout structure from flex with sidebar to full-width editor
- Remove AppShell dependency (or customize it)
- Update state management for new components

## Dependencies

- Material Symbols Outlined (already in reference HTML)
- Tailwind CSS (already configured)
- Lucide icons (current project uses these, may need to switch to Material Symbols)

## Notes

1. The reference HTML uses Material Symbols Outlined icons, while the current project uses Lucide icons. Consider switching to Material Symbols for consistency.

2. The reference includes sample content blocks. These should be replaced with actual dynamic content from the workspace/page data.

3. The slash command menu and floating AI toolbar are shown as visible in the reference. These should be interactive in the implementation.

4. The comments panel is hidden on smaller screens (`hidden xl:flex`).

5. The white page container has a minimum height of 1200px in the reference.

## Success Criteria

- [ ] Layout matches reference HTML exactly
- [ ] All colors, fonts, and spacing match
- [ ] Navigation sidebar is responsive
- [ ] Top navigation bar includes all elements
- [ ] Document editor displays content blocks correctly
- [ ] Slash command menu is positioned correctly
- [ ] Floating AI toolbar is fixed at bottom
- [ ] Comments panel displays correctly
- [ ] All hover effects work as expected
- [ ] Drag handles appear on hover
- [ ] Cursor indicator displays correctly
