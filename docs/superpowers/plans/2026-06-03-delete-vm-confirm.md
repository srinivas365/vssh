# Delete VM Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trash icon and confirmation modal before deleting a VM host card.

**Architecture:** Two file changes — global CSS gets `.btn-danger` and `.modal-card` utility classes; `HostCard` in `HostsPage.tsx` gets local `confirmDelete` state and renders a `modal-backdrop` overlay when active.

**Tech Stack:** React 18 (useState), lucide-react icons, plain CSS (no modules)

---

### Task 1: Add `.btn-danger` and `.modal-card` CSS

**Files:**
- Modify: `src/renderer/styles/app.css`

`.modal-card` has no CSS definition in the project. `.btn-danger` doesn't exist either. Both go into `app.css` alongside the existing `.btn-primary` rule so they're globally available.

- [ ] **Step 1: Open `src/renderer/styles/app.css` and locate the `.btn-primary` block**

  It currently looks like this (around line 209):

  ```css
  .btn-primary {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  ```

- [ ] **Step 2: Add `.btn-danger` immediately after `.btn-primary:hover`**

  Insert these lines between `.btn-primary:hover` and `.btn:disabled`:

  ```css
  .btn-danger {
    background: #dc2626;
    color: #fff;
    border-color: transparent;
  }
  .btn-danger:hover { background: #b91c1c; border-color: transparent; }
  ```

- [ ] **Step 3: Add `.modal-card` and `.modal-actions` at the end of the file**

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

- [ ] **Step 4: Commit**

  ```bash
  git add src/renderer/styles/app.css
  git commit -m "style: add btn-danger and modal-card CSS utilities"
  ```

---

### Task 2: Update `HostCard` — swap icon, add confirm state, render modal

**Files:**
- Modify: `src/renderer/screens/HostsPage.tsx`

- [ ] **Step 1: Replace `X` with `Trash2` in the lucide-react import**

  Current line 2:
  ```tsx
  import { Download, Pencil, Search, Server, Upload, X } from 'lucide-react';
  ```

  Replace with:
  ```tsx
  import { Download, Pencil, Search, Server, Trash2, Upload } from 'lucide-react';
  ```

- [ ] **Step 2: Add `confirmDelete` state to `HostCard`**

  `HostCard` currently starts at line 126. Add a `useState` call as the first line inside the function body:

  ```tsx
  function HostCard({ vm, onConnect, onEdit, onDelete, onUpload, onDownload }: {
    vm: Vm;
    onConnect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onUpload: () => void;
    onDownload: () => void;
  }) {
    const [confirmDelete, setConfirmDelete] = useState(false);   // ← add this line

    const authBadge = ...
  ```

- [ ] **Step 3: Replace the `X` delete button with `Trash2` and wire up the state**

  Current delete button (inside `.host-card-actions`, line ~156):
  ```tsx
  <button className="host-card-icon-btn" onClick={onDelete} title="Delete"><X size={14} /></button>
  ```

  Replace with:
  ```tsx
  <button className="host-card-icon-btn" onClick={() => setConfirmDelete(true)} title="Delete"><Trash2 size={14} /></button>
  ```

- [ ] **Step 4: Add the confirm modal just before the closing `</div>` of `.host-card`**

  The `return` in `HostCard` ends with `</div>` closing `.host-card`. Add the modal inside the fragment, after that `</div>`:

  ```tsx
  return (
    <>
      <div className="host-card" onDoubleClick={onConnect}>
        {/* ...existing card content unchanged... */}
      </div>
      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Delete "{vm.label}"?</h2>
            <div className="modal-actions">
              <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={onDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
  ```

  > The `<>...</>` fragment wrapper is required because JSX must have a single root element. The modal uses `position: fixed` via `.modal-backdrop` so it renders above everything regardless of DOM nesting.

- [ ] **Step 5: Commit**

  ```bash
  git add src/renderer/screens/HostsPage.tsx
  git commit -m "feat: add delete confirmation modal and trash icon to HostCard"
  ```

---

### Task 3: Manual verification

- [ ] **Step 1: Start the app**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Navigate to the Hosts page and verify the delete button shows a trash icon (not X)**

- [ ] **Step 3: Click the trash icon on any host card**

  Expected: a modal overlay appears with title `Delete "<vm label>"?` and two buttons: Cancel and Delete.

- [ ] **Step 4: Click Cancel**

  Expected: modal closes, card is unchanged, VM still in the list.

- [ ] **Step 5: Click the trash icon again, then click Delete**

  Expected: modal closes and the VM is removed from the list.

- [ ] **Step 6: Verify other card actions (Connect, Upload, Download, Edit) still work normally**
