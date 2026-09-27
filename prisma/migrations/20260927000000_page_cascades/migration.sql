-- Page had no referential actions on any of its incoming relations. Block_pageId_fkey
-- defaulted to RESTRICT, so deleting a page that had ever been opened in the editor
-- failed with a foreign key violation; Comment and the PageHierarchy self-relation
-- defaulted to SET NULL, silently orphaning comments and promoting sub-pages to root.

-- DropForeignKey
ALTER TABLE "Block" DROP CONSTRAINT "Block_pageId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_pageId_fkey";

-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_parentId_fkey";

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
