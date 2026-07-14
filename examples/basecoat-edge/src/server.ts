import { Edge } from 'edge.js'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucideIcons } from '@iconify-json/lucide'
import type { TypedEdge } from '../edge-templates.ts'

addCollection(lucideIcons)

const edge = Edge.create() as unknown as TypedEdge
edge.use(edgeIconify)
edge.mount(new URL('../templates/', import.meta.url))

Bun.serve({
  port: 4790,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/') {
      return new Response(await edge.render('demo', {}), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }
    return new Response('not found', { status: 404 })
  },
})

console.log('basecoat-edge demo listening on http://localhost:4790')
