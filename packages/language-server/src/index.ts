import { createConnection, createServer, createTypeScriptProject, loadTsdkByPath } from '@volar/language-server/node.js'
import { create as createTypeScriptServices } from 'volar-service-typescript'
import { edgeLanguagePlugin } from './languagePlugin.ts'
import { createRequireTypesDiagnosticsPlugin } from './requireTypesDiagnostics.ts'
import { createTagCompletionPlugin } from './tagCompletion.ts'
import { createTagHoverPlugin } from './tagHover.ts'
import { createTemplatePathCompletionPlugin } from './templatePathCompletion.ts'

const connection = createConnection()
const server = createServer(connection)

connection.listen()

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(params.initializationOptions.typescript.tsdk, params.locale)
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [edgeLanguagePlugin],
    })),
    [
      ...createTypeScriptServices(tsdk.typescript),
      createTemplatePathCompletionPlugin(),
      createTagCompletionPlugin(),
      createTagHoverPlugin(),
      createRequireTypesDiagnosticsPlugin(),
    ],
  )
})

connection.onInitialized(server.initialized)

connection.onShutdown(server.shutdown)
