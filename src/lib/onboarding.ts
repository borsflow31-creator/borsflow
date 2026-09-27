import { prisma } from './prisma'

/**
 * The workspace and welcome page every new account starts with.
 *
 * Email verification and Google sign-up each built this inline and had drifted:
 * one said "Welcome to Notion-Alt!", the other "Welcome to BorsFlow!", and both
 * stored the text as a TipTap document (`content: [...]`) while the page editor
 * reads `blocks`. The welcome page therefore opened empty. It is now written as
 * Block rows, which is what the editor loads first.
 */
export async function createStarterWorkspace(userId: string) {
  return prisma.workspace.create({
    data: {
      name: 'My Workspace',
      description: 'Welcome to your new workspace',
      ownerId: userId,
      pages: {
        create: {
          title: 'Getting Started',
          createdById: userId,
          content: JSON.stringify({ type: 'doc', blocks: [] }),
          blocks: {
            create: [
              {
                type: 'heading1',
                order: 0,
                createdById: userId,
                content: JSON.stringify({ text: 'Welcome to BorsFlow!' }),
              },
              {
                type: 'text',
                order: 1,
                createdById: userId,
                content: JSON.stringify({
                  text: 'This is your personal workspace. Start by creating new pages and organizing your content.',
                }),
              },
            ],
          },
        },
      },
    },
  })
}
