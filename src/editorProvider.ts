import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { decodeFile, encodeJson, type DecodeOutcome } from './cli';
import { formatHexDump } from './hex';
import { formatByteCount, renderWebviewHtml, type ViewMode } from './webview';

class ObufDocument implements vscode.CustomDocument {
  public rawBytes: Uint8Array;
  public decode: DecodeOutcome;
  public jsonText: string;

  private readonly _onDidChange = new vscode.EventEmitter<{
    readonly label: string;
    undo(): void;
    redo(): void;
  }>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _onDidSyncContent = new vscode.EventEmitter<void>();
  public readonly onDidSyncContent = this._onDidSyncContent.event;

  constructor(
    public readonly uri: vscode.Uri,
    rawBytes: Uint8Array,
    decode: DecodeOutcome,
  ) {
    this.rawBytes = rawBytes;
    this.decode = decode;
    this.jsonText = decode.ok ? decode.json : '';
  }

  public applyEdit(newText: string): void {
    if (newText === this.jsonText) {
      return;
    }
    const previousText = this.jsonText;
    this.jsonText = newText;
    this._onDidChange.fire({
      label: 'Edit OmniBuf JSON',
      undo: () => {
        this.jsonText = previousText;
        this._onDidSyncContent.fire();
      },
      redo: () => {
        this.jsonText = newText;
        this._onDidSyncContent.fire();
      },
    });
  }

  public replaceFromDisk(rawBytes: Uint8Array, decode: DecodeOutcome): void {
    this.rawBytes = rawBytes;
    this.decode = decode;
    this.jsonText = decode.ok ? decode.json : '';
    this._onDidSyncContent.fire();
  }

  public dispose(): void {
    this._onDidChange.dispose();
    this._onDidSyncContent.dispose();
  }
}

export class ObufEditorProvider implements vscode.CustomEditorProvider<ObufDocument> {
  public static readonly viewType = 'omnibuf.obufViewer';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<ObufDocument>
  >();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  private readonly _panelsByUri = new Map<string, Set<vscode.WebviewPanel>>();
  private readonly _writingUris = new Set<string>();

  private getCliConfig() {
    const cfg = vscode.workspace.getConfiguration('omnibuf');
    return {
      cliPath: cfg.get<string>('cliPath', 'omnibuf'),
      schemaPath: cfg.get<string>('schemaPath', ''),
      messageType: cfg.get<string>('messageType', ''),
      includeField0: cfg.get<boolean>('includeField0', true),
      deterministic: cfg.get<boolean>('deterministic', false),
      maxHexBytes: cfg.get<number>('maxHexBytes', 262_144),
    };
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
  ): Promise<ObufDocument> {
    const cfg = this.getCliConfig();
    const [rawBytes, decode] = await Promise.all([
      vscode.workspace.fs.readFile(uri),
      decodeFile(uri.fsPath, {
        cliPath: cfg.cliPath,
        schemaPath: cfg.schemaPath,
        messageType: cfg.messageType,
      }),
    ]);

    const doc = new ObufDocument(uri, rawBytes, decode);

    if (openContext.backupId) {
      try {
        const backupBytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(openContext.backupId));
        doc.jsonText = Buffer.from(backupBytes).toString('utf8');
      } catch {
        // Ignore stale backups.
      }
    }

    doc.onDidChange((edit) => {
      this._onDidChangeCustomDocument.fire({
        document: doc,
        label: edit.label,
        undo: edit.undo,
        redo: edit.redo,
      });
    });

    return doc;
  }

  async resolveCustomEditor(
    document: ObufDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const uriKey = document.uri.toString();
    let panels = this._panelsByUri.get(uriKey);
    if (!panels) {
      panels = new Set();
      this._panelsByUri.set(uriKey, panels);
    }
    panels.add(webviewPanel);

    let currentViewMode = this.getDefaultViewMode();

    const renderFull = () => {
      const cfg = this.getCliConfig();
      const hex = formatHexDump(document.rawBytes, cfg.maxHexBytes);
      const nonce = randomBytes(16).toString('hex');
      const decodeForView: DecodeOutcome = document.decode.ok
        ? { ok: true, json: document.jsonText }
        : document.decode;

      webviewPanel.webview.html = renderWebviewHtml({
        fileName: path.basename(document.uri.fsPath),
        viewMode: currentViewMode,
        decode: decodeForView,
        hex,
        nonce,
      });
    };

    renderFull();

    const syncSub = document.onDidSyncContent(() => {
      const cfg = this.getCliConfig();
      const hex = formatHexDump(document.rawBytes, cfg.maxHexBytes);
      void webviewPanel.webview.postMessage({
        type: 'updateJson',
        text: document.jsonText,
      });
      void webviewPanel.webview.postMessage({
        type: 'updateHex',
        hexText: hex.text,
        sizeLabel: formatByteCount(hex.totalBytes),
      });
    });

    const reloadFromDisk = async () => {
      const cfg = this.getCliConfig();
      const [rawBytes, decode] = await Promise.all([
        vscode.workspace.fs.readFile(document.uri),
        decodeFile(document.uri.fsPath, {
          cliPath: cfg.cliPath,
          schemaPath: cfg.schemaPath,
          messageType: cfg.messageType,
        }),
      ]);
      document.replaceFromDisk(rawBytes, decode);
      renderFull();
    };

    const messageSub = webviewPanel.webview.onDidReceiveMessage(
      async (msg: { type?: string; mode?: string; text?: string }) => {
        switch (msg.type) {
          case 'viewModeChanged':
            if (msg.mode === 'json' || msg.mode === 'split' || msg.mode === 'hex') {
              currentViewMode = msg.mode;
            }
            break;
          case 'edit':
            if (typeof msg.text === 'string') {
              document.applyEdit(msg.text);
            }
            break;
          case 'copyJson': {
            const text = typeof msg.text === 'string' ? msg.text : document.jsonText;
            if (text) {
              await vscode.env.clipboard.writeText(text);
              void vscode.window.showInformationMessage('Copied OmniBuf JSON to clipboard.');
            }
            break;
          }
          case 'refresh':
            await reloadFromDisk();
            break;
          case 'openRaw':
            await openRawBinaryEditor(document.uri);
            break;
        }
      },
    );

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(document.uri.fsPath),
        path.basename(document.uri.fsPath),
      ),
    );
    const changeSub = watcher.onDidChange(() => {
      if (this._writingUris.has(uriKey)) {
        return;
      }
      void reloadFromDisk();
    });

    const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('omnibuf')) {
        void reloadFromDisk();
      }
    });

    webviewPanel.onDidDispose(() => {
      panels?.delete(webviewPanel);
      if (panels && panels.size === 0) {
        this._panelsByUri.delete(uriKey);
      }
      syncSub.dispose();
      messageSub.dispose();
      changeSub.dispose();
      watcher.dispose();
      configSub.dispose();
    });
  }

  async saveCustomDocument(document: ObufDocument): Promise<void> {
    await this.saveToUri(document, document.uri);
  }

  async saveCustomDocumentAs(document: ObufDocument, destination: vscode.Uri): Promise<void> {
    await this.saveToUri(document, destination);
  }

  async revertCustomDocument(document: ObufDocument): Promise<void> {
    const cfg = this.getCliConfig();
    const [rawBytes, decode] = await Promise.all([
      vscode.workspace.fs.readFile(document.uri),
      decodeFile(document.uri.fsPath, {
        cliPath: cfg.cliPath,
        schemaPath: cfg.schemaPath,
        messageType: cfg.messageType,
      }),
    ]);
    document.replaceFromDisk(rawBytes, decode);
  }

  async backupCustomDocument(
    document: ObufDocument,
    context: vscode.CustomDocumentBackupContext,
  ): Promise<vscode.CustomDocumentBackup> {
    await vscode.workspace.fs.writeFile(
      context.destination,
      Buffer.from(document.jsonText, 'utf8'),
    );
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
          // Ignore already-deleted backup.
        }
      },
    };
  }

  private async saveToUri(document: ObufDocument, targetUri: vscode.Uri): Promise<void> {
    if (!document.decode.ok) {
      throw new Error('Cannot save .obuf file while decode is in an error state.');
    }

    const cfg = this.getCliConfig();
    const encoded = await encodeJson(document.jsonText, {
      cliPath: cfg.cliPath,
      schemaPath: cfg.schemaPath,
      messageType: cfg.messageType,
      includeField0: cfg.includeField0,
      deterministic: cfg.deterministic,
    });

    if (!encoded.ok) {
      throw new Error(`OmniBuf encode failed: ${encoded.message}`);
    }

    const uriKey = targetUri.toString();
    this._writingUris.add(uriKey);
    try {
      await vscode.workspace.fs.writeFile(targetUri, encoded.bytes);
    } finally {
      setTimeout(() => this._writingUris.delete(uriKey), 500);
    }

    if (uriKey === document.uri.toString()) {
      document.rawBytes = encoded.bytes;
      const hex = formatHexDump(encoded.bytes, cfg.maxHexBytes);
      const panels = this._panelsByUri.get(uriKey);
      if (panels) {
        for (const panel of panels) {
          void panel.webview.postMessage({
            type: 'updateHex',
            hexText: hex.text,
            sizeLabel: formatByteCount(hex.totalBytes),
          });
        }
      }
    }
  }

  private getDefaultViewMode(): ViewMode {
    const cfg = vscode.workspace.getConfiguration('omnibuf');
    const mode = cfg.get<string>('defaultView', 'json');
    if (mode === 'split' || mode === 'hex') {
      return mode;
    }
    return 'json';
  }
}

export async function openRawBinaryEditor(uri: vscode.Uri): Promise<void> {
  // Prefer Microsoft's Hex Editor extension if installed; otherwise fall back to VS Code's default editor.
  const hasHexEditor = Boolean(vscode.extensions.getExtension('ms-vscode.hexeditor'));
  const viewType = hasHexEditor ? 'hexEditor.hexedit' : 'default';
  await vscode.commands.executeCommand('vscode.openWith', uri, viewType);
}
