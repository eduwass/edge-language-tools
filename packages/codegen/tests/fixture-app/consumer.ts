import { Edge } from 'edge.js'
import type { TypedEdge } from './edge-templates'

const edge = Edge.create() as unknown as TypedEdge

await edge.render('templates/profile', { user: { name: 'Ada', age: 30 } })
edge.renderSync('templates/list', { items: ['a', 'b'] })

// @ts-expect-error wrong prop type for a known template
await edge.render('templates/profile', { user: { name: 'Ada', age: 'thirty' } })

// untyped templates stay renderable with any props
await edge.render('templates/untyped', { whatever: true })
