# arkNote Deployment and Release Guide

English | [简体中文](./DEPLOYMENT.zh-CN.md)

This guide is for arkNote maintainers. It covers local development, production builds, cross-platform packaging, GitHub Releases, automatic updates, and encrypted data repository initialization and recovery.

## 1. Deployment Model

arkNote uses two independent repository concepts:

| Repository | Purpose | Contains user notes |
| --- | --- | --- |
| Application source, `loong27/ArkNote` | Source, Actions, installers, and Releases | No |
| User encrypted data repository | Encrypted notes, images, metadata, and history | Yes, as ciphertext |

The digital ark principle separates application code, hosting services, and user data. A device or Git provider can be replaced without losing access, provided that the encrypted data, password, and a working arkNote build remain available.

## 2. Requirements

General requirements:

- Node.js 20
- npm
- Git
- At least 4 GB of free disk space for dependencies and packaging caches

Platform requirements:

- Windows: PowerShell; electron-builder downloads NSIS resources automatically
- Linux: `libfuse2` and `rpm`; AppImage runtime environments need FUSE
- macOS: Xcode Command Line Tools; production distribution needs an Apple Developer certificate and notarization

Verify the toolchain:

```bash
node --version
npm --version
git --version
```

## 3. Local Development

```bash
git clone git@github.com:loong27/ArkNote.git
cd ArkNote
npm ci
npm run dev
```

`npm run dev` starts Vite and Electron. The main process, preload, and React renderer are built separately with development reload support.

Do not use production data for destructive test scenarios. Use an isolated user directory and a dedicated test repository for recovery or migration tests.

## 4. Build and Test

Run the complete verification pipeline:

```bash
npm run build
```

The pipeline covers:

1. Icon dimensions, alpha channels, and ICO validation
2. Brand naming and legacy-data compatibility
3. Password policy, throttling, encryption, and legacy verifier migration
4. GitHub vault recovery safety
5. GitHub Release updater configuration
6. Chinese/English translation keys, interpolation, and dynamic messages
7. Bidirectional Git synchronization integration
8. Markdown extension rendering
9. Vite renderer, Electron main process, and preload production builds

Individual checks:

```bash
npm run verify:icons
npm run test:brand
npm run test:auth
npm run test:restore
npm run test:updater
npm run test:i18n
npm run test:sync
npm run test:markdown
```

## 5. Local Packaging

### Windows

```bash
npm run package:win
```

This creates NSIS installers for x64 and ia32. With the GitHub publisher configured, it also creates:

```text
release/latest.yml
release/*.exe.blockmap
release/*Setup*.exe
```

### Linux

```bash
npm run package:linux
```

This creates AppImage, DEB, and RPM packages. AppImage updates require:

```text
release/latest-linux.yml
release/*.AppImage.blockmap
release/*.AppImage
```

### macOS

```bash
npm run package:mac
```

Run this command on macOS. The current configuration does not automatically select a signing identity. Add signing, notarization, and a macOS Release job before production distribution.

## 6. GitHub Actions Releases

Workflow: `.github/workflows/package.yml`

Triggers:

- A pushed `v*` tag
- Manual `workflow_dispatch` from GitHub Actions

Recommended release sequence, using `1.0.4` as an example:

```bash
npm version 1.0.4 --no-git-tag-version
npm run build
git add package.json package-lock.json
git commit -m "release: v1.0.4"
git tag -a v1.0.4 -m "arkNote v1.0.4"
git push origin main
git push origin v1.0.4
```

The workflow:

1. Creates or reuses the corresponding GitHub Release
2. Builds AppImage, DEB, and RPM packages on Ubuntu
3. Builds x64 and ia32 NSIS installers on Windows
4. Uploads packages, `latest*.yml`, and blockmaps

After publishing, the Release should contain at least:

```text
latest.yml
latest-linux.yml
*.blockmap
Windows installer(s)
AppImage
DEB
RPM
```

Without `latest*.yml`, clients cannot discover an update. Without blockmaps, differential downloads are unavailable. A SHA-512 mismatch between metadata and the package causes the download to be rejected.

## 7. GitHub Release Updates

The publisher is defined in `package.json`:

```json
{
  "provider": "github",
  "owner": "loong27",
  "repo": "ArkNote"
}
```

Update sequence:

```text
Application starts
-> delayed GitHub Release check
-> semantic-version comparison
-> user is notified
-> user confirms download
-> SHA-512 verification and blockmap download
-> pending note changes are saved
-> application restarts and installs
```

Runtime policy:

- Check 12 seconds after launch
- Check every 6 hours while running
- Allow manual checks from Settings
- Require user confirmation before restart
- Reuse the note-save coordinator and cancel installation if saving fails

Platform support:

| Platform / format | In-app update | Notes |
| --- | --- | --- |
| Windows NSIS | Supported | Uses `latest.yml` |
| Linux AppImage | Supported | Uses `latest-linux.yml`; the app must run from an AppImage |
| Linux DEB / RPM | Not supported | Upgrade through the package manager or Releases |
| Development mode | Disabled | Prevents development builds from downloading production packages |

## 8. Code Signing

Packages are unsigned by default. Public production distribution should configure:

- A Windows Authenticode code-signing certificate
- A macOS Developer ID Application certificate
- macOS notarization credentials
- Certificate and password secrets in CI

Never commit `.p12`, `.pfx`, private keys, or passwords. Common certificate and key formats are excluded by `.gitignore`.

The updater verifies Release downloads over HTTPS and checks the SHA-512 value from `latest*.yml`, but integrity hashes do not replace operating-system code signing.

## 9. User Encrypted Data Repository

Use a separate private GitHub repository for each user or vault, for example:

```text
git@github.com:<account>/<private-data-repo>.git
```

Never commit user data to the `loong27/ArkNote` source repository.

### Create a New Digital Ark

1. Select “Create a new vault” on first launch.
2. Choose a new password with at least 12 characters.
3. Open “Settings -> Sync”.
4. Enter the separate data repository HTTPS or SSH URL and branch.
5. Save the configuration and run the first sync.
6. Confirm on GitHub that the repository contains ciphertext only.

### Restore on a New Device

1. Install arkNote, but do not create a new vault.
2. Select “Restore from GitHub”.
3. Enter the encrypted data repository and branch.
4. Wait for cloning and vault validation.
5. Unlock with the original arkNote password.
6. Verify directories, notes, images, and version history.
7. Run a manual sync to confirm remote access.

Recovery invariants:

- Only `https://github.com/...` and `git@github.com:...` URLs are accepted
- The local target directory must be empty
- Existing encrypted data is never overwritten
- Cloning occurs in a temporary sibling directory on the same filesystem
- Valid `salt.bin`, `verify.enc`, and `metadata.json.enc` files are required
- Repositories containing symbolic links are rejected
- The validated directory is moved into place atomically

SSH is recommended for private repositories. The operating-system user running arkNote must be able to run:

```bash
ssh -T git@github.com
git ls-remote git@github.com:<account>/<private-data-repo>.git
```

## 10. Configuration and Data Paths

Defaults:

```text
~/.ark-note-config.json   Non-sensitive application configuration
~/.ark-note/              Encrypted data repository
```

Legacy locations are read during startup and migrated into the arkNote configuration. Do not manually edit the data directory while the application is running or changing passwords.

A complete backup includes at least:

- `salt.bin`
- `verify.enc`
- `metadata.json.enc`
- `notes/`
- `images/`
- `versions/`
- `trash/`

Encrypted notes without the matching `salt.bin` cannot be used to derive the original key.

## 11. Post-Release Checklist

After every release:

1. Confirm that Windows and Linux Actions jobs succeeded.
2. Confirm that the Release tag matches the version in `package.json`.
3. Confirm that package names use `arkNote`.
4. Confirm that `latest*.yml` points to files present in the Release.
5. Confirm SHA-512 values and file sizes.
6. Check and download the update from the previous installed version.
7. Verify that pending note edits are saved before installation.
8. Test GitHub recovery into an empty data directory.
9. Confirm that recovery is rejected for a non-empty directory.

## 12. Troubleshooting

### The client cannot find an update

- Confirm that the new version is greater than the installed version.
- Confirm that the Release is not a draft and includes the platform's `latest*.yml`.
- Check owner and repo in packaged `app-update.yml`.
- Check proxies, firewalls, and GitHub connectivity.

### The update downloads but does not install

- Confirm that the installer matches the SHA-512 value in `latest.yml`.
- Check write permissions for the installation directory.
- Configure code signing for public Windows distribution.
- On Linux, only AppImage supports in-app replacement.

### GitHub recovery fails

- Confirm that the URL points to an encrypted data repository, not the application source.
- Confirm that the branch exists.
- For private repositories, verify SSH keys or Git Credential Manager access.
- Confirm that the local data directory is empty.
- Confirm that the remote repository contains the complete encrypted vault.

### The password cannot unlock restored data

- Use the password that created the data repository.
- Passwords are case-sensitive.
- Confirm that `salt.bin` belongs to the same repository.
- arkNote does not store passwords and cannot bypass encryption.
