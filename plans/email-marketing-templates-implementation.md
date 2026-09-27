# Email Marketing Templates Implementation Plan

This document outlines the steps required to make the `/email-marketing` page fully functional, specifically focusing on the "Clone template" and "Editing the email template" features.

## 1. Fix Data Serialization Bugs (Backend & Frontend)
Currently, there is a mismatch in how `variables` and `tags` are stringified between the frontend and backend, leading to double-stringification (e.g., `"[\"a\", \"b\"]"`) or database validation errors.

### Actions:
- **`src/components/email-marketing/TemplateModal.tsx`**: 
  - Stop stringifying `variables` and `tags` before sending them to the API. Send them as raw arrays.
  ```typescript
  const templateData = {
    ...formData,
    workspaceId,
    variables: formData.variables, // Do not stringify here
    tags: formData.tags // Do not stringify here
  }
  ```
- **`src/app/api/email-marketing/templates/[id]/route.ts` (PATCH)**:
  - Stringify the arrays before passing them to Prisma, just like the POST route does.
  ```typescript
  const body = await request.json()
  const updateData = { ...body }
  if (updateData.variables && Array.isArray(updateData.variables)) {
    updateData.variables = JSON.stringify(updateData.variables)
  }
  if (updateData.tags && Array.isArray(updateData.tags)) {
    updateData.tags = JSON.stringify(updateData.tags)
  }
  const template = await prisma.emailTemplate.update({
    where: { id: params.id },
    data: updateData
  })
  ```

## 2. Implement the Live Preview in the Template Editor
The `TemplateModal` component has a "Preview" button that toggles a `showPreview` state, but the actual preview UI is missing. Users cannot see what their HTML looks like while editing.

### Actions:
- **`src/components/email-marketing/TemplateModal.tsx`**:
  - Update the layout structure. When `showPreview` is `true`, switch from a single-column layout to a side-by-side split layout (e.g., `grid-cols-2`).
  - Add an `<iframe>` pane on the right side to render `formData.htmlContent` dynamically.
  ```tsx
  {showPreview && (
    <div className="border-l border-gray-200 pl-6 h-full flex flex-col">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Live Preview</h3>
      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
        <iframe
          srcDoc={formData.htmlContent || '<div style="padding: 20px; color: #666; font-family: sans-serif;">Empty preview</div>'}
          className="w-full h-full bg-white"
          title="Email Preview"
        />
      </div>
    </div>
  )}
  ```

## 3. Enhance Variable Insertion
Currently, clicking a variable button appends `{{variable}}` to the very end of the HTML content, which is frustrating if the user is editing the middle of the document.

### Actions:
- **`src/components/email-marketing/TemplateModal.tsx`**:
  - Add a `ref` to the HTML `<textarea>`.
  - Update the `insertVariable` function to read the textarea's `selectionStart` and `selectionEnd` properties.
  - Splice the `{{variable}}` string exactly at the cursor position.

## 4. Fix Gallery `alreadyImported` Logic
In `EmailStarterTemplateGallery.tsx`, the `alreadyImported` logic relies on exact case-insensitive name matching. While mostly fine, this can be fragile if users rename templates slightly.

### Actions:
- Ensure the "Clone template" functionality disables the button reliably to prevent spam-clicking. The current implementation relies on `cloningId === template.id`, which is functionally sound, but we must ensure `setError` and `setStatus` correctly clear and update states upon a successful clone.
- Ensure the `onCloneStarter` callback in `src/app/email-marketing/page.tsx` correctly waits for the API response and immediately calls `fetchData(workspaceId)` so the newly cloned template appears seamlessly in the "Workspace templates" section at the bottom of the page.

## Summary of Files to Modify
1. `src/components/email-marketing/TemplateModal.tsx` (Serialization, Live Preview UI, Cursor Insertion)
2. `src/app/api/email-marketing/templates/[id]/route.ts` (Serialization handling for PATCH)
3. `src/app/email-marketing/page.tsx` (Ensure `fetchData` works flawlessly after a successful `POST` from `handleCloneStarterTemplate`)