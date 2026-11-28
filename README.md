# omnibuf-vscode

[![Release](https://github.com/omnibuf/omnibuf-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/omnibuf/omnibuf-vscode/actions/workflows/release.yml)
[![OmniBuf Spec: v1 DRAFT-1](https://img.shields.io/badge/OmniBuf%20Spec-v1%20DRAFT--1-FF4F18)](https://omnibuf.com/spec)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)
[![Website](https://img.shields.io/badge/website-omnibuf.com-111111?style=flat&labelColor=111111&color=D4FF33)](https://omnibuf.com/tooling/editors)

Visual Studio Code extension for inspecting and editing `.obuf` binary files. Part of the [OmniBuf](https://omnibuf.com) [tooling suite](https://omnibuf.com/tooling).

## Install

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=omnibuf.omnibuf-vscode) or [Open VSX](https://open-vsx.org/extension/omnibuf/omnibuf-vscode). Requires VS Code `1.85+` and the [`omnibuf` CLI](https://github.com/omnibuf/omnibuf-cli) on your `PATH`:

```bash
brew install omnibuf/tap/omnibuf
```

Build and install from source:

```bash
pnpm install
pnpm run typecheck && pnpm run build && pnpm test && pnpm run package
code --install-extension omnibuf-vscode-0.1.0.vsix
```

## Features

- Opens `*.obuf` files in a custom editor backed by `omnibuf decode` and `omnibuf encode`.
- Defaults to syntax-highlighted editable JSON; saving (`Cmd+S` / `Ctrl+S`) re-encodes back to binary wire bytes.
- Validates JSON inline on save and aborts write-back on errors so the existing `.obuf` file stays intact.
- Switches between **JSON**, **Split** (JSON + 16-byte hex/ASCII), and **Hex** views, or opens raw bytes in VS Code's Hex Editor.
- Supports external file reload, Undo/Redo, Save As, Revert, and hot-exit backups.

## Commands

| Command | Action |
| :--- | :--- |
| `OmniBuf: Open in OmniBuf Viewer` | Open the `.obuf` file in the OmniBuf custom editor |
| `OmniBuf: Open in Hex / Binary Editor` | Open the `.obuf` file in VS Code's Hex Editor or default binary editor |
| `OmniBuf: Copy Decoded JSON` | Decode the `.obuf` file via `omnibuf` and copy JSON to the clipboard |

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `omnibuf.cliPath` | `"omnibuf"` | Path to the `omnibuf` CLI executable |
| `omnibuf.defaultView` | `"json"` | Default view (`"json"`, `"split"`, or `"hex"`) |
| `omnibuf.schemaPath` | `""` | `FileDescriptorSet` path passed via `-s` (`.json`, `.pb`, `.pb.gz`) |
| `omnibuf.messageType` | `""` | Protobuf message type passed via `-t` |
| `omnibuf.maxHexBytes` | `262144` | Maximum bytes rendered in the built-in hex view |
| `omnibuf.includeField0` | `true` | Include Field #0 inline names on save (`--no-field0` when `false`) |
| `omnibuf.deterministic` | `false` | Sort map keys and schema fields deterministically (`--deterministic`) |

## License

Apache-2.0
