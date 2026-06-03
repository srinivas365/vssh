# Delete VM Confirmation — Design Spec

**Date:** 2026-06-03  
**Status:** Approved

## Summary

Add a confirmation modal before deleting a VM host, and replace the `X` (close) icon on the delete button with `Trash2` from `lucide-react`.

## Scope

Changes are confined to `HostsPage.tsx`, `HostsPage.css`, and `app.css`. No changes to `HostsPage` props, stores, or IPC layer.

## Icon Change

- In `HostCard`, replace the `X` import and usage with `Trash2` from `lucide-react`.
- Button `title` attribute remains `"Delete"`.
- No size or style change to the button itself.

## Confirm Modal

### State
`HostCard` gains a single local boolean: `const [confirmDelete, setConfirmDelete] = useState(false)`.

- Trash button click → `setConfirmDelete(true)`
- Modal Cancel → `setConfirmDelete(false)`
- Modal Delete → calls `onDelete()`, card unmounts naturally

### Markup
Renders inside `HostCard`'s JSX when `confirmDelete` is true, using existing global CSS classes:

```
<div className="modal-backdrop">
  <div className="modal-card">
    <h2>Delete "{vm.label}"?</h2>
    <div className="modal-actions">
      <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
      <button className="btn btn-danger" onClick={onDelete}>Delete</button>
    </div>
  </div>
</div>
```

### CSS additions

**`app.css`** — add `.btn-danger` variant alongside existing `.btn-primary`:

```css
.btn-danger {
  background: var(--red, #dc2626);
  color: #fff;
  border-color: transparent;
}
.btn-danger:hover { background: #b91c1c; border-color: transparent; }
```

**`HostsPage.css`** — add `.modal-card` styles (`.modal-backdrop` is already defined in `VmEditForm.css`):

```css
.modal-card {
  background: var(--bg-panel);
  color: var(--text);
  padding: 24px;
  border-radius: var(--radius-lg);
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: var(--shadow-lg);
}
.modal-card h2 { margin: 0; font-size: 16px; font-weight: 600; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
```

> Note: `.modal-card` may already have styles in `VmEditForm.css` — check at implementation time and skip if already global.

## What is NOT changing

- `HostsPage` component props and callbacks — unchanged
- `vms-store` `remove()` — unchanged
- All other card action buttons (Upload, Download, Edit, Connect) — unchanged
- No new files; changes go into existing files only
