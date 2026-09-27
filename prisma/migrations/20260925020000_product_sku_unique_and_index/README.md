# Product SKU uniqueness

Before applying, check for existing duplicates — the unique index creation will fail
if any exist:

```sql
SELECT "workspaceId", "sku", COUNT(*)
FROM "Product"
WHERE "sku" IS NOT NULL AND btrim("sku") <> ''
GROUP BY "workspaceId", "sku"
HAVING COUNT(*) > 1;
```

Resolve each group by renaming or clearing the duplicate SKUs, then run the migration.
