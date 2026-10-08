import { prisma } from './prisma'
import { ensureDefaultPipelines, ensureDeveloperPipeline } from './services/pipelines'

/**
 * The workspace and welcome page every new account starts with.
 *
 * Email verification and Google sign-up each built this inline and had drifted:
 * one said "Welcome to Notion-Alt!", the other "Welcome to BorsFlow!", and both
 * stored the text as a TipTap document (`content: [...]`) while the page editor
 * reads `blocks`. The welcome page therefore opened empty. It is now written as
 * Block rows, which is what the editor loads first.
 */
export async function createStarterWorkspace(userId: string, db: Pick<typeof prisma, 'workspace'> = prisma) {
  const workspace = await db.workspace.create({
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

  // Every workspace is a real-estate agency: it starts with the contacts, buyer
  // and owner boards rather than an empty CRM. Inside a transaction the caller
  // does this once it has committed (see ensureOwnWorkspace).
  if (db === prisma) await ensureDefaultPipelines(workspace.id)

  return workspace
}

/**
 * Every account works in one workspace of its own, made at sign-up. This repairs
 * an account that has none (made before that, or whose workspace was lost) the
 * first time it lists its workspaces, and returns whether one was created.
 *
 * Two requests can arrive together (the shell and the page both list workspaces),
 * so the check and the create run under a per-user advisory lock: the second one
 * waits, then sees the workspace the first one made.
 */
export async function ensureOwnWorkspace(userId: string, businessType?: string | null): Promise<boolean> {
  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${userId}))) AS l`
    const owned = await tx.workspace.count({ where: { ownerId: userId } })
    if (owned > 0) return null
    return createStarterWorkspace(userId, tx)
  })
  if (!created) return false
  await ensureDefaultPipelines(created.id)
  if (businessType === 'DEVELOPER') await ensureDeveloperPipeline(created.id)
  return true
}
