CREATE TABLE IF NOT EXISTS folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vms (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id           INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  label               TEXT NOT NULL,
  host                TEXT NOT NULL,
  port                INTEGER NOT NULL DEFAULT 22,
  username            TEXT NOT NULL,
  auth_method         TEXT NOT NULL CHECK (auth_method IN ('password','key','key+password')),
  key_path            TEXT,
  vault_ref           TEXT NOT NULL UNIQUE,
  auto_copy_disabled  INTEGER NOT NULL DEFAULT 0,
  auto_submit_enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at        INTEGER,
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vms_folder ON vms(folder_id);
CREATE INDEX IF NOT EXISTS idx_vms_last_used ON vms(last_used_at DESC);

CREATE TABLE IF NOT EXISTS identities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  username    TEXT NOT NULL,
  vault_ref   TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);
