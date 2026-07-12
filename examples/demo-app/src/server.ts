import { Edge } from 'edge.js'
import type { TypedEdge } from '../edge-templates.ts'

const edge = Edge.create() as unknown as TypedEdge
edge.mount(new URL('../templates/', import.meta.url))

const user = { name: 'Ada Lovelace', displayName: 'Ada Lovelace', bio: 'Mathematician and writer, first to publish an algorithm meant for a machine.' }
const posts = [
  { title: 'On the Analytical Engine', body: 'A general-purpose computing machine could do more than arithmetic.' },
  { title: 'Notes on computation', body: 'Every process has an underlying pattern that can be expressed as a set of rules.' },
]

Bun.serve({
  port: 4780,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/') {
      return new Response(await edge.render('home', { user, posts, activePage: 'home' }), {
        headers: { 'content-type': 'text/html' },
      })
    }
    if (url.pathname === '/profile') {
      return new Response(await edge.render('profile', { user, activePage: 'profile' }), {
        headers: { 'content-type': 'text/html' },
      })
    }
    if (url.pathname === '/legacy') {
      return new Response(await edge.render('legacy-banner', { message: 'This page predates edge-language-tools.' }), {
        headers: { 'content-type': 'text/html' },
      })
    }
    return new Response('not found', { status: 404 })
  },
})

console.log('demo-app listening on http://localhost:4780')
