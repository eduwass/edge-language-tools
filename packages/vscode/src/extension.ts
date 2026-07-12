import * as serverProtocol from '@volar/language-server/protocol'
import { activateAutoInsertion, createLabsInfo, getTsdk } from '@volar/vscode'
import type { BaseLanguageClient, LanguageClientOptions, ServerOptions } from '@volar/vscode/node'
import { LanguageClient, TransportKind } from '@volar/vscode/node'
import * as vscode from 'vscode'

let client: BaseLanguageClient

export async function activate(context: vscode.ExtensionContext): Promise<ReturnType<typeof createLabsInfo>['extensionExports']> {
  const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.js')
  const runOptions = { execArgv: [] as string[] }
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6019'] }

  const serverOptions: ServerOptions = {
    run: { module: serverModule.fsPath, transport: TransportKind.ipc, options: runOptions },
    debug: { module: serverModule.fsPath, transport: TransportKind.ipc, options: debugOptions },
  }
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'edge' }],
    initializationOptions: {
      typescript: { tsdk: (await getTsdk(context))!.tsdk },
    },
  }
  client = new LanguageClient('edge-language-server', 'Edge Language Server', serverOptions, clientOptions)
  await client.start()

  activateAutoInsertion('edge', client)

  const labsInfo = createLabsInfo(serverProtocol)
  labsInfo.addLanguageClient(client)
  return labsInfo.extensionExports
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop()
}
