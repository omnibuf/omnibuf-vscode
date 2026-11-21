import * as vscode from 'vscode';
import { decodeFile } from './cli';
import { ObufEditorProvider, openRawBinaryEditor } from './editorProvider';

function resolveTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri) {
    return uri;
  }
  const activeTabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (activeTabInput && typeof activeTabInput === 'object' && 'uri' in activeTabInput) {
    const candidate = (activeTabInput as { uri?: unknown }).uri;
    if (candidate instanceof vscode.Uri) {
      return candidate;
    }
  }
  return vscode.window.activeTextEditor?.document.uri;
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ObufEditorProvider();

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(ObufEditorProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: true,
    }),

    vscode.commands.registerCommand('omnibuf.openAsJson', async (uri?: vscode.Uri) => {
      const target = resolveTargetUri(uri);
      if (!target) {
        void vscode.window.showWarningMessage('No .obuf file selected.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, ObufEditorProvider.viewType);
    }),

    vscode.commands.registerCommand('omnibuf.openRawHex', async (uri?: vscode.Uri) => {
      const target = resolveTargetUri(uri);
      if (!target) {
        void vscode.window.showWarningMessage('No .obuf file selected.');
        return;
      }
      await openRawBinaryEditor(target);
    }),

    vscode.commands.registerCommand('omnibuf.copyDecodedJson', async (uri?: vscode.Uri) => {
      const target = resolveTargetUri(uri);
      if (!target) {
        void vscode.window.showWarningMessage('No .obuf file selected.');
        return;
      }
      const cfg = vscode.workspace.getConfiguration('omnibuf');
      const result = await decodeFile(target.fsPath, {
        cliPath: cfg.get<string>('cliPath', 'omnibuf'),
        schemaPath: cfg.get<string>('schemaPath', ''),
        messageType: cfg.get<string>('messageType', ''),
      });
      if (!result.ok) {
        void vscode.window.showErrorMessage(`OmniBuf decode failed: ${result.message}`);
        return;
      }
      await vscode.env.clipboard.writeText(result.json);
      void vscode.window.showInformationMessage('Copied decoded OmniBuf JSON to clipboard.');
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up.
}
