import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { templateDocs } from '@edge-language-tools/core'

const componentsDir = join(import.meta.dir, '../templates/components')
const docsDir = join(import.meta.dir, '../docs/components')
mkdirSync(docsDir, { recursive: true })

function tagName(file: string): string {
  const stem = basename(file, '.edge')
  return stem.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function propsSnippet(types: string | null): string {
  if (!types) return '@componentName()'
  const firstLine = types.split('\n').find((l) => l.trim() && !l.includes('{') && !l.includes('}'))
  if (!firstLine) return '@componentName()'
  const optional = firstLine.includes('?')
  if (optional) return `@componentName({ /* see props */ })`
  return `@componentName({ /* required props */ })`
}

const files = readdirSync(componentsDir).filter((f) => f.endsWith('.edge')).sort()

for (const file of files) {
  const source = readFileSync(join(componentsDir, file), 'utf8')
  const docs = templateDocs(source, file)
  const name = docs.name ?? tagName(file)
  const tag = tagName(file)
  const descFirst = docs.desc?.split('\n')[0] ?? name
  const descBody = docs.desc ?? ''
  const typesBlock = docs.types ?? '{}'

  const usage = propsSnippet(docs.types).replace('componentName', tag)

  const mdx = `---
title: ${name}
description: ${descFirst.replace(/"/g, '\\"')}
---

${descBody}

## Props

\`\`\`ts
${typesBlock}
\`\`\`

## Usage

\`\`\`edge
@${usage}
  Content
@end
\`\`\`
`

  writeFileSync(join(docsDir, `${basename(file, '.edge')}.mdx`), mdx)
}

writeFileSync(
  join(docsDir, 'meta.ts'),
  `import { defineMeta } from 'blume'

export default defineMeta({
  title: 'Components',
  pages: ${JSON.stringify(files.map((f) => basename(f, '.edge')))},
})
`,
)

console.log(`Generated ${files.length} component docs`)
