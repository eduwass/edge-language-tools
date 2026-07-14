import { expect, test } from 'bun:test'
import { templateDocs } from '../src/doc-block.ts'
import { generateVirtualTs } from '../src/generator.ts'

const full = `{{--
@name User Card
@desc Displays a user card with title and body.
  Used on the profile and team pages.
@types {
  user: { name: string }
}
--}}
<h1>{{ user.name }}</h1>
`

test('parses @name, @desc, and @types from one comment', () => {
  const docs = templateDocs(full, 'card.edge')
  expect(docs.name).toBe('User Card')
  expect(docs.desc).toBe('Displays a user card with title and body.\nUsed on the profile and team pages.')
  expect(docs.types).toContain('user: { name: string }')
})

// Regression: findTypesBlock used to require the comment to START with @types,
// so a preceding @name/@desc silently disabled type-checking.
test('@types still found when @name/@desc precede it', () => {
  const virtual = generateVirtualTs(full, 'card.edge')
  expect(virtual.typesBlock).not.toBeNull()
  expect(virtual.typesBlock?.raw).toContain('user: { name: string }')
})

test('expression-form @types stops at a following directive line', () => {
  const source = `{{--
@types import('./props.ts').Props
@desc A card.
--}}
`
  const docs = templateDocs(source, 'card.edge')
  expect(docs.types).toBe("import('./props.ts').Props")
  expect(docs.desc).toBe('A card.')
})

test('all fields null without a doc comment', () => {
  expect(templateDocs('<p>plain</p>\n', 'plain.edge')).toEqual({ name: null, desc: null, types: null, url: null, examples: [] })
})

test('parses @url and repeated @example directives', () => {
  const source = `{{--
@name Button
@desc A button.
@url https://basecoatui.com/components/button/
@types { variant?: 'primary' | 'outline' }
@example Variants height=200
  @button({ variant: 'outline' })
    Outline
  @end
@example
  @button()
    Default
  @end
--}}
<button>x</button>
`
  const docs = templateDocs(source, 'button.edge')
  expect(docs.url).toBe('https://basecoatui.com/components/button/')
  expect(docs.types).toBe("{ variant?: 'primary' | 'outline' }")
  expect(docs.examples.length).toBe(2)
  expect(docs.examples[0]).toEqual({
    title: 'Variants',
    height: 200,
    raw: "@button({ variant: 'outline' })\n  Outline\n@end",
  })
  expect(docs.examples[1]?.title).toBeNull()
  expect(docs.examples[1]?.raw).toContain('Default')
})
