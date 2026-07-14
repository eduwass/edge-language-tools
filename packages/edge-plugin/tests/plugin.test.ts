import { describe, expect, test } from 'bun:test'
import { Edge } from 'edge.js'
import { registerTypesTag } from '../src/index.ts'

describe('registerTypesTag', () => {
  test('renders a template using both @types forms with no type text in the output', async () => {
    const edge = Edge.create()
    registerTypesTag(edge)

    const output = await edge.renderRaw(
      `@types()
  user: { name: string }
@end
@types(import('./shared.ts').Unused)
@end
<h1>{{ user.name }}</h1>
`,
      { user: { name: 'Ada' } },
    )

    expect(output).toBe('<h1>Ada</h1>')
    expect(output).not.toContain('@types')
    expect(output).not.toContain('@end')
    expect(output).not.toContain('import(')
  })
})
