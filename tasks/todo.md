# Add Quick Access Backup Button to Dashboard Admin Tools

## Tasks
- [x] Add imports for DatabaseBackupService and expo-sharing
- [x] Add backingUp state variable
- [x] Add handleBackupNow handler function
- [x] Add Backup entry as first item in adminQuickActions array
- [x] Update maxVisible from 4 to 5
- [x] Review

## Review

### Changes Summary

**`screens/DashboardScreen.tsx`**

1. **Added imports** — `DatabaseBackupService` and `expo-sharing` at top of file.
2. **Added `backingUp` state** — Tracks backup-in-progress status.
3. **Added `handleBackupNow` handler** — Same proven pattern from SettingsScreen: calls `DatabaseBackupService.getInstance().createBackup()`, shows success Alert with "Share Copy" option on native, handles web platform separately, catches errors.
4. **Added Backup to adminQuickActions** — Inserted as first item with green color (`#4CAF50`), `backup-restore` icon.
5. **Updated `maxVisible` from 4 to 5** — All 5 Admin Tools buttons (Backup, Users, Permissions, Reset Data, Database) now show without overflow.

### Button order:
Backup (green) | Users | Permissions | Reset Data | Database
