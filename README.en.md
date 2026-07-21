# arkNote

English | [简体中文](./README.md)

[![Package Desktop App](https://github.com/loong27/ArkNote/actions/workflows/package.yml/badge.svg)](https://github.com/loong27/ArkNote/actions/workflows/package.yml)
[![Latest Release](https://img.shields.io/github/v/release/loong27/ArkNote)](https://github.com/loong27/ArkNote/releases/latest)

> A digital ark built for the long-term survival of personal knowledge.

arkNote is a local-first, end-to-end encrypted, cross-platform note application with Git synchronization. It does not require readable notes to be entrusted to a single cloud provider. Notes, images, tags, and version history are encrypted inside a user-controlled data directory that can be migrated and restored through a separate GitHub repository.

## The Digital Ark

Devices fail, platforms disappear, and accounts or network conditions change. In arkNote, a “digital ark” is not another name for cloud storage. It is a survival strategy for digital assets across devices, platforms, and service lifecycles:

- **Local ownership**: data lives on the device first and remains usable offline.
- **Encrypted preservation**: remote repositories contain ciphertext, not readable notes.
- **Portability**: the data directory is user-controlled and can be copied, backed up, or hosted in an independent Git repository.
- **Verifiable recovery**: a new device can restore the encrypted repository first and unlock it with the original password, without creating an empty vault.
- **Replaceable services**: GitHub is a transport and recovery channel, not the owner of the data format.

arkNote is concerned not only with writing something today, but also with whether that knowledge can still be located, verified, and opened years from now.

## Core Capabilities

- AES-256-GCM encrypted local storage
- PBKDF2-SHA512 key derivation with 600,000 iterations
- Markdown editing, live preview, and common extension syntax
- Mermaid diagrams, task lists, footnotes, definition lists, and more
- Encrypted image storage, paste import, and preserved dimensions
- Directories, tags, full-text search, recycle bin, and version history
- Instant Chinese/English UI switching with locally persisted language preferences
- Bidirectional Git sync, scheduled sync, and conflict handling
- First-run choice between creating a vault and restoring from GitHub
- GitHub Release update checks, downloads, and restart-to-install flow
- Build configuration for Windows, Linux, and macOS

## First Run

When no local user data exists, arkNote offers two non-destructive paths instead of forcing password setup:

```text
No local encrypted data
├─ Create a new vault
│  └─ Choose a new password -> initialize local encrypted data
└─ Restore from GitHub
   └─ Clone encrypted data -> validate the vault -> unlock with the original password
```

Recovery accepts GitHub HTTPS or SSH repository URLs only and writes only to an empty data directory. The repository is cloned into a temporary sibling directory, validated for `salt.bin`, `verify.enc`, `metadata.json.enc`, and symbolic links, and then atomically moved into place.

> The application source repository is `loong27/ArkNote`. Recovery requires your own **encrypted data repository**, not the application source repository.

## Security Model

| Area | Implementation |
| --- | --- |
| Content encryption | AES-256-GCM |
| Key derivation | PBKDF2-SHA512, 600,000 iterations |
| Password policy | At least 12 characters for new passwords, with common-password rejection |
| Unlock protection | Persistent backoff, serialized operations, and retry status |
| Automatic locking | Configurable idle and minimize locking |
| Password changes | Transactional re-encryption with interruption recovery |
| Remote storage | Git stores encrypted files, never plaintext notes |

Passwords are never uploaded and cannot be recovered. Losing the password means losing access to the data, so keep the password and an offline backup in a safe place.

## Quick Start

### Requirements

- Node.js 20
- npm
- Git

### Local Development

```bash
git clone git@github.com:loong27/ArkNote.git
cd ArkNote
npm ci
npm run dev
```

### Verify a Production Build

```bash
npm run build
```

This command validates brand assets, authentication security, vault recovery, updater configuration, Chinese/English translation coverage, Git synchronization, and Markdown rendering before building the renderer, Electron main process, and preload entry.

### Package by Platform

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

Build on the target operating system whenever possible. GitHub Actions is the recommended path for official releases.

## Data and Synchronization

Default locations:

| Type | Path |
| --- | --- |
| Application configuration | `~/.ark-note-config.json` |
| Encrypted data directory | `~/.ark-note` |

Use a separate private GitHub repository for arkNote data. A synchronized repository normally contains:

```text
salt.bin
verify.enc
metadata.json.enc
notes/
images/
versions/
trash/
.git/
```

Except for `.git/`, application content is stored in encrypted form. Every device needs access to the repository and the same arkNote password.

## Automatic Updates

Installed builds use GitHub Releases from `loong27/ArkNote`:

- Windows NSIS: in-app check, download, and restart-to-install.
- Linux AppImage: in-app check, download, and restart-to-install.
- Linux DEB / RPM: directs the user to update manually from Releases.
- Development mode: automatic updates are disabled.

Updates require `latest*.yml`, the installer or application image, and blockmap files in the Release. The repository workflow uploads them together.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite and Electron development environment |
| `npm run build` | Run the complete test suite and production build |
| `npm run test:auth` | Verify authentication, throttling, and encryption |
| `npm run test:restore` | Verify GitHub recovery and no-overwrite behavior |
| `npm run test:sync` | Run Git synchronization integration tests |
| `npm run test:updater` | Validate GitHub Release updater configuration |
| `npm run test:i18n` | Verify translation keys, interpolation, and dynamic messages |
| `npm run brand:generate` | Regenerate brand assets from the SVG masters |

## Project Structure

```text
electron/                 Electron main process, IPC, and local services
shared/                   Logic shared by main and renderer processes
src/                      React UI, state management, and editor
build/                    Brand SVG masters and platform icons
public/                   Web and desktop runtime assets
scripts/                  Security, sync, recovery, updater, and asset tests
.github/workflows/        Cross-platform packaging and GitHub Releases
```

## Deployment Documentation

- [中文部署指南](./docs/DEPLOYMENT.zh-CN.md)
- [English deployment guide](./docs/DEPLOYMENT.en.md)

## Current Boundaries

- Windows update packages are unsigned by default; configure code signing before public production distribution.
- macOS has a local build configuration, but the current GitHub Actions workflow does not publish macOS packages.
- Linux DEB and RPM upgrades remain the responsibility of the system package manager.
- The OSS settings are reserved for future work; Git is the current stable synchronization path.

## Repository

- Source: <https://github.com/loong27/ArkNote>
- Releases: <https://github.com/loong27/ArkNote/releases>
- Issues: <https://github.com/loong27/ArkNote/issues>
