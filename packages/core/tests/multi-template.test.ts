import { expect, test } from 'bun:test'
import ts from 'typescript'
import { generateVirtualTs } from '../src/index.ts'

// Editors load every template's virtual TS into ONE tsserver project (unlike
// checkTemplate, which isolates each). Script-mode virtual files would share a
// global scope there: `const user` from two templates collides, and DOM's
// `declare var name` shadows props named `name`. Regression test for both.

const home = `{{--
@types {
  user: { name: string }
}
--}}
<p>{{ user.name }}</p>
`

const profile = `{{--
@types {
  user: { displayName: string, bio: string }
}
--}}
<p>{{ user.displayName }}</p>
`

test('two templates in one program with dom lib: no scope collisions', () => {
  const files = new Map([
    ['/home.edge.ts', generateVirtualTs(home, 'home.edge').code],
    ['/profile.edge.ts', generateVirtualTs(profile, 'profile.edge').code],
  ])
  const options: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  host.readFile = (f) => files.get(f) ?? readFile(f)
  host.fileExists = (f) => files.has(f) || fileExists(f)
  host.getSourceFile = (f, lv) => {
    const content = files.get(f)
    if (content !== undefined) return ts.createSourceFile(f, content, lv, true)
    return ts.createCompilerHost(options).getSourceFile(f, lv)
  }
  const program = ts.createProgram([...files.keys()], options, host)
  const diags = [...files.keys()].flatMap((f) => {
    const sf = program.getSourceFile(f)!
    return [...program.getSemanticDiagnostics(sf), ...program.getSyntacticDiagnostics(sf)]
  })
  const messages = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
  expect(messages).toEqual([])
})
