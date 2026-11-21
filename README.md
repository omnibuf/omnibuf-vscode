# OmniBuf for Visual Studio Code (`omnibuf-vscode`)

[![Wire Spec: v0.1](https://img.shields.io/badge/spec-v0.1-111111?style=flat&labelColor=111111&color=FF4F18)](https://omnibuf.com/spec)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Website](https://img.shields.io/badge/website-omnibuf.com-111111?style=flat&labelColor=111111&color=D4FF33)](https://omnibuf.com)

Inspect and edit `.obuf` binary files in Visual Studio Code. Opening any `*.obuf` file decodes it through the [`omnibuf` CLI](https://github.com/omnibuf/omnibuf-cli) and opens an editable, syntax-highlighted JSON view by default. Saving (`Cmd+S` / `Ctrl+S`) re-encodes the JSON back to binary `.obuf` wire bytes via `omnibuf encode` and updates the Hex pane live.

---

## Requirements

- Visual Studio Code `1.85+`
- [`omnibuf` CLI](https://github.com/omnibuf/omnibuf-cli) on your `PATH` (or configured via `omnibuf.cliPath`):
  ```bash
  brew install omnibuf/tap/omnibuf
  ```

---

## Features

- **Editable JSON by default:** Custom editor for `*.obuf` files decodes payloads with `omnibuf decode` and renders syntax-highlighted JSON styled to your active VS Code theme. Edit directly in the JSON pane, format with **Format**, and save (`Cmd+S` / `Ctrl+S`) to re-encode back to binary `.obuf` wire bytes.
- **Safe write-back:** Invalid JSON displays an inline validation badge and aborts encoding on save without modifying the existing `.obuf` file.
- **Built-in Split & Hex views:** Switch between **JSON**, **Split** (JSON + canonical 16-byte hex/ASCII side-by-side), and **Hex** from the toolbar, or open the file in VS Code's Hex Editor (`ms-vscode.hexeditor`) / default binary editor via **Open Raw**.
- **Live reload & hot exit:** Watches `.obuf` files on disk for external changes, supports native VS Code Undo/Redo, Save As, Revert, and hot-exit backups.
- **Schema-aware mode:** Configure `omnibuf.schemaPath` (`-s`) and `omnibuf.messageType` (`-t`) to decode and encode with a `FileDescriptorSet` (`.json`, `.pb`, `.pb.gz`).
- **Graceful fallback:** Missing CLI or invalid wire bytes show a clear diagnostic while keeping the raw Hex view available.

---

## Commands

| Command | Action |
| :--- | :--- |
| `OmniBuf: Open in OmniBuf Viewer` | Open the selected `.obuf` file in the OmniBuf custom editor |
| `OmniBuf: Open in Hex / Binary Editor` | Open the `.obuf` file in VS Code's Hex Editor (if installed) or default binary editor |
| `OmniBuf: Copy Decoded JSON` | Decode the `.obuf` file via `omnibuf` CLI and copy the JSON to the clipboard |

---

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `omnibuf.cliPath` | `"omnibuf"` | Path to the `omnibuf` CLI executable |
| `omnibuf.defaultView` | `"json"` | Default view mode (`"json"`, `"split"`, or `"hex"`) |
| `omnibuf.schemaPath` | `""` | Optional `FileDescriptorSet` path passed to `omnibuf decode -s` / `omnibuf encode -s` |
| `omnibuf.messageType` | `""` | Optional Protobuf message type passed to `omnibuf decode -t` / `omnibuf encode -t` |
| `omnibuf.maxHexBytes` | `262144` | Maximum bytes rendered in the built-in hex dump view |
| `omnibuf.includeField0` | `true` | Include Field #0 inline field names when saving in schema-less mode (`--no-field0` when `false`) |
| `omnibuf.deterministic` | `false` | Sort map keys and schema fields deterministically when saving (`--deterministic`) |

---

## Packaging & Installation

### Build & Package `.vsix`

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
pnpm run package
```

### Install Locally from `.vsix`

```bash
code --install-extension omnibuf-vscode-0.1.0.vsix
```

### Run from Source in Extension Development Host

```bash
code --extensionDevelopmentPath=/path/to/omnibuf-vscode
```

## License

Released under the [Apache 2.0 License](./LICENSE).
