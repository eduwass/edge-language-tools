import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Edge } from 'edge.js'
import { edgeIconify, addCollection } from 'edge-iconify'
import { icons as lucideIcons } from '@iconify-json/lucide'
import type { TypedEdge } from '../edge-templates.ts'
import {
  buildEdgeSource,
  buildRenderTemplate,
  previewHtml,
  stemToTag,
} from './playground'

addCollection(lucideIcons)

const edge = Edge.create() as unknown as TypedEdge
edge.use(edgeIconify)
edge.mount(new URL('../templates/', import.meta.url))

const root = join(import.meta.dir, '..')
const componentsDir = join(root, 'templates/components')
const allowedComponents = new Set(
  readdirSync(componentsDir)
    .filter((file) => file.endsWith('.edge'))
    .map((file) => basename(file, '.edge')),
)

// Local-only tool: allow any localhost origin (blume dev hops ports when 4310 is taken).
function corsHeaders(origin?: string | null): HeadersInit {
  const allowed = origin && /^https?:\/\/localhost(:\d+)?$/.test(origin) ? origin : 'http://localhost:4310'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function jsonResponse(body: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  })
}

interface RenderRequest {
  component: string
  props: Record<string, unknown>
  slot?: string
}

async function parseRenderRequest(req: Request): Promise<RenderRequest | Response> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return jsonResponse({ error: 'Expected application/json body' }, 415, origin)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Expected a JSON object' }, 400, origin)
  }

  const record = body as Record<string, unknown>
  const component = record.component
  const props = record.props
  const slot = record.slot

  if (typeof component !== 'string' || !allowedComponents.has(component)) {
    return jsonResponse({ error: 'Unknown component' }, 400, origin)
  }

  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return jsonResponse({ error: 'props must be an object' }, 400, origin)
  }

  if (slot !== undefined && typeof slot !== 'string') {
    return jsonResponse({ error: 'slot must be a string' }, 400, origin)
  }

  return { component, props: props as Record<string, unknown>, slot }
}

async function handleRender(req: Request): Promise<Response> {
  const origin = req.headers.get('origin')
  const parsed = await parseRenderRequest(req)
  if (parsed instanceof Response) return parsed

  const { component, props, slot } = parsed
  const tag = stemToTag(component)
  const template = buildRenderTemplate(component, props, slot)
  const source = buildEdgeSource(tag, props, slot)

  return jsonResponse({ html: await previewHtml(edge, template), source }, 200, origin)
}

Bun.serve({
  port: 4790,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS' && url.pathname === '/render') {
      return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
    }

    if (req.method === 'POST' && url.pathname === '/render') {
      return handleRender(req)
    }

    if (url.pathname === '/') {
      return new Response(await edge.render('demo', {}), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('not found', { status: 404 })
  },
})

console.log('basecoat-edge demo listening on http://localhost:4790')
