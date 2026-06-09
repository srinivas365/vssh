import type { AppSettings } from './types';

export const IPC = {
  // vault
  VAULT_STATE: 'vault:state',
  VAULT_INIT: 'vault:init',
  VAULT_UNLOCK: 'vault:unlock',
  VAULT_LOCK: 'vault:lock',
  VAULT_SET_SECRET: 'vault:set-secret',
  TOUCH_ID_STATUS: 'touch-id:status',
  TOUCH_ID_UNLOCK: 'touch-id:unlock',
  TOUCH_ID_ENROLL: 'touch-id:enroll',
  TOUCH_ID_DISABLE: 'touch-id:disable',
  // vms
  VMS_LIST: 'vms:list',
  VMS_CREATE: 'vms:create',
  VMS_UPDATE: 'vms:update',
  VMS_DELETE: 'vms:delete',
  VMS_CLONE: 'vms:clone',
  VMS_TOUCH_USED: 'vms:touch-used',
  VMS_TEST_CONNECTION: 'vms:test-connection',
  // settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_CHANGED: 'settings:changed',
  // folders
  FOLDERS_LIST: 'folders:list',
  FOLDERS_CREATE: 'folders:create',
  FOLDERS_DELETE: 'folders:delete',
  FOLDERS_RENAME: 'folders:rename',
  VMS_MOVE_TO_FOLDER: 'vms:move-to-folder',
  // sessions
  SESSION_START: 'session:start',
  SESSION_START_LOCAL: 'session:start-local',
  SESSION_INPUT: 'session:input',
  SESSION_RESIZE: 'session:resize',
  SESSION_CLOSE: 'session:close',
  SESSION_OUTPUT: 'session:output',           // main → renderer
  SESSION_STATE: 'session:state',             // main → renderer
  SESSION_TOAST: 'session:toast',             // main → renderer
  // transfers
  TRANSFER_PICK_UPLOAD_SOURCE: 'transfer:pick-upload-source',
  TRANSFER_PICK_DOWNLOAD_DESTINATION: 'transfer:pick-download-destination',
  TRANSFER_REMOTE_LIST: 'transfer:remote-list',
  TRANSFER_REMOTE_STAT: 'transfer:remote-stat',
  TRANSFER_START: 'transfer:start',
  TRANSFER_PAUSE: 'transfer:pause',
  TRANSFER_RESUME: 'transfer:resume',
  TRANSFER_STOP: 'transfer:stop',
  TRANSFER_DELETE_PARTIALS: 'transfer:delete-partials',
  TRANSFER_PROGRESS: 'transfer:progress',       // main → renderer
  TRANSFER_STATE: 'transfer:state',             // main → renderer
  TRANSFER_LOG: 'transfer:log',                 // main → renderer
  TRANSFER_TOAST: 'transfer:toast',             // main → renderer
  // misc
  PASTE_PASSWORD: 'session:paste-password',   // ⌘⇧P manual fallback
  VAULT_STATE_CHANGED: 'vault:state-changed', // main → renderer broadcast
  CLIPBOARD_READ_TEXT: 'clipboard:read-text',
  CLIPBOARD_WRITE_TEXT: 'clipboard:write-text',
  HOSTS_EXPORT: 'hosts:export',
  HOSTS_IMPORT: 'hosts:import',
} as const;

export const DEFAULTS = {
  CLIPBOARD_CLEAR_MS: 30_000,
  AUTO_LOCK_MS: 15 * 60_000,
  PROMPT_DEBOUNCE_MS: 2_000,
  PTY_BUFFER_BYTES: 512,
  LOGIN_PROMPT_WINDOW_MS: 5_000,
  WRONG_PASSWORD_DELAY_MS: 1_000,
  MIN_MASTER_PW_LEN: 6,
} as const;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  appFontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
  terminalFontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  terminalFontSize: 13,
  autoLockMinutes: 15,
  touchIdEnabled: false,
};
