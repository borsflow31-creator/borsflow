# BorsFlow

A modern Notion-like application built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Authentication**: Secure user registration and login with NextAuth.js
- 📁 **Workspace Management**: Create and manage multiple workspaces
- 📄 **Document Editor**: Block-based rich text editor with multiple block types
- 🗂️ **Page Organization**: Hierarchical page structure with nesting
- 🔍 **Search**: Full-text search across all pages
- ⚙️ **Settings**: User profile and preferences management
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js
- **Icons**: Lucide React
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd NOTION-ALT
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your `NEXTAUTH_SECRET`:
```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

Generate a secure secret key:
```bash
openssl rand -base64 32
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts
│   │   │   └── register/route.ts
│   │   ├── workspaces/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── pages/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── blocks/route.ts
│   │   └── search/route.ts
│   ├── dashboard/
│   ├── login/
│   ├── register/
│   ├── pages/[id]/
│   ├── settings/
│   ├── workspaces/[id]/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── providers.tsx
├── lib/
│   ├── auth.ts
│   ├── prisma.ts
│   └── utils.ts
└── types/
    ├── index.ts
    └── next-auth.d.ts
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/[...nextauth]` - NextAuth authentication

### Workspaces
- `GET /api/workspaces` - Get all user workspaces
- `POST /api/workspaces` - Create a new workspace
- `GET /api/workspaces/[id]` - Get workspace details
- `PATCH /api/workspaces/[id]` - Update workspace
- `DELETE /api/workspaces/[id]` - Delete workspace

### Pages
- `GET /api/pages` - Get all pages (with optional filters)
- `POST /api/pages` - Create a new page
- `GET /api/pages/[id]` - Get page details
- `PATCH /api/pages/[id]` - Update page
- `DELETE /api/pages/[id]` - Delete page
- `GET /api/pages/[id]/blocks` - Get page blocks
- `POST /api/pages/[id]/blocks` - Create a new block

### Search
- `GET /api/search?q=query` - Search pages

## Block Types

The document editor supports the following block types organized into categories:

### Basic Blocks
- **Text**: Standard paragraph text
- **Heading 1**: Large section heading (H1)
- **Heading 2**: Medium section heading (H2)
- **Heading 3**: Small section heading (H3)
- **Bulleted List**: Bullet point list items
- **Numbered List**: Numbered list items
- **To-do List**: Checkbox items for task tracking
- **Code**: Code blocks with syntax highlighting
- **Quote**: Blockquotes for citations

### Formatting Blocks
- **Divider**: Horizontal line separator
- **Callout**: Colored boxes with icons for important notes (click icon to cycle through options)
- **Toggle**: Collapsible content blocks
- **Tag**: Colored tags for labeling content
- **Date**: Date picker with optional reminder
- **Link**: External link blocks

### Media Blocks
- **Image**: Upload and display images with captions
- **Video**: Embed YouTube or Vimeo videos
- **File**: Upload and attach files

### Advanced Blocks
- **Table**: Simple tables with rows and columns (add/remove rows and columns)
- **Bookmark**: Link preview cards with thumbnails
- **Equation**: Math equations using LaTeX syntax

### Using Blocks
- Type `/` in an empty block to open the slash command menu
- Click "Add a block" at the bottom to see all available blocks
- Drag blocks using the grip handle to reorder them
- Click the trash icon to delete a block
- Blocks are automatically saved as you type

## Database Schema

The application uses the following main entities:

- **User**: User accounts and authentication
- **Workspace**: Workspaces for organizing content
- **WorkspaceMember**: Workspace membership and roles
- **Page**: Documents and pages
- **Block**: Content blocks within pages
- **Session**: User sessions

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Future Enhancements

- [ ] Real-time collaboration
- [ ] Kanban board view
- [ ] Export to PDF/Markdown
- [ ] Mobile app
- [ ] Advanced search filters
- [ ] Page templates
- [ ] Integration with external services
- [ ] Equation rendering with KaTeX/MathJax
- [ ] Bookmark metadata fetching

## Support

For support, please open an issue in the GitHub repository.
