import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PlaygroundProp, PlaygroundSchema, PropControl } from '../src/playground-types.ts'

const RENDER_URL = 'http://localhost:4790/render'
const DEBOUNCE_MS = 300

interface PlaygroundProps {
  component: string
  schema: PlaygroundSchema
  minHeight?: number
}

function requestProps(
  defaults: Record<string, unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return { ...defaults, ...values }
}

function firstEditableProp(props: Record<string, PlaygroundProp>): string | null {
  for (const [name, prop] of Object.entries(props)) {
    if (prop.control) return name
  }
  return null
}

export default function Playground({ component, schema, minHeight = 160 }: PlaygroundProps) {
  const [propValues, setPropValues] = useState<Record<string, unknown>>(() => ({
    ...schema.defaultProps,
  }))
  const [slot, setSlot] = useState(schema.defaultSlot)
  const [source, setSource] = useState('')
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string | null>(null)
  const [serverAvailable, setServerAvailable] = useState(true)
  const [expandedProps, setExpandedProps] = useState<Set<string>>(() => {
    const first = firstEditableProp(schema.props)
    return first ? new Set([first]) : new Set()
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)
  const propValuesRef = useRef(propValues)
  const slotRef = useRef(slot)
  propValuesRef.current = propValues
  slotRef.current = slot

  const propEntries = Object.entries(schema.props)
  const showPropsTable = propEntries.length > 0 || schema.hasSlot

  const renderFromServer = useCallback(
    async (props: Record<string, unknown>, slotText: string) => {
      const requestId = ++requestRef.current
      try {
        const response = await fetch(RENDER_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            component,
            props,
            slot: slotText.trim() ? slotText : undefined,
          }),
        })
        if (!response.ok) throw new Error('render failed')
        const data = (await response.json()) as { html: string; source: string }
        if (requestId !== requestRef.current) return
        setServerAvailable(true)
        setIframeSrcDoc(data.html)
        setSource(data.source)
      } catch {
        if (requestId !== requestRef.current) return
        setServerAvailable(false)
        setIframeSrcDoc(null)
      }
    },
    [component],
  )

  const queueRender = useCallback(
    (props: Record<string, unknown>, slotText: string, debounce: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const run = () => void renderFromServer(props, slotText)
      if (debounce) {
        debounceRef.current = setTimeout(run, DEBOUNCE_MS)
      } else {
        run()
      }
    },
    [renderFromServer],
  )

  useEffect(() => {
    queueRender(requestProps(schema.defaultProps, propValues), slot, false)
  }, []) // mount

  const setPropImmediate = (name: string, value: unknown) => {
    setPropValues((current) => {
      const next = { ...current, [name]: value }
      queueRender(requestProps(schema.defaultProps, next), slotRef.current, false)
      return next
    })
  }

  const setPropDebounced = (name: string, value: unknown) => {
    setPropValues((current) => {
      const next = { ...current, [name]: value }
      queueRender(requestProps(schema.defaultProps, next), slotRef.current, true)
      return next
    })
  }

  const setSlotDebounced = (value: string) => {
    setSlot(value)
    queueRender(requestProps(schema.defaultProps, propValuesRef.current), value, true)
  }

  const togglePropRow = (name: string) => {
    setExpandedProps((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const copySource = async () => {
    if (!source) return
    try {
      await navigator.clipboard.writeText(source)
    } catch {
      // ignore clipboard errors
    }
  }

  const renderControlInput = (name: string, control: PropControl) => {
    const value = propValues[name]

    if (control.kind === 'select') {
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => setPropImmediate(name, event.target.value)}
          style={inputStyle}
        >
          {control.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }

    if (control.kind === 'toggle') {
      return (
        <label style={toggleLabelStyle}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => setPropImmediate(name, event.target.checked)}
          />
          <span style={labelTextStyle}>{Boolean(value) ? 'true' : 'false'}</span>
        </label>
      )
    }

    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
        onChange={(event) => setPropDebounced(name, event.target.value)}
        style={inputStyle}
      />
    )
  }

  const renderPropRow = (
    name: string,
    type: string,
    optional: boolean,
    detail: ReactNode,
  ) => {
    const expanded = expandedProps.has(name)
    return (
      <div
        key={name}
        style={{
          ...propsRowStyle,
          ...(expanded ? propsRowExpandedStyle : {}),
        }}
      >
        <button
          type="button"
          onClick={() => togglePropRow(name)}
          aria-expanded={expanded}
          style={propsSummaryStyle}
        >
          <code style={propNameStyle}>
            {name}
            {optional ? '?' : ''}
          </code>
          <code style={propTypeStyle}>{type}</code>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              ...chevronStyle,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {expanded && <div style={propsDetailStyle}>{detail}</div>}
      </div>
    )
  }

  return (
    <div style={rootStyle}>
      {!serverAvailable && (
        <p style={noticeStyle}>
          Playground needs the demo server: run <code style={codeStyle}>bun run demo</code> in{' '}
          <code style={codeStyle}>examples/basecoat-edge</code>
        </p>
      )}

      {serverAvailable && iframeSrcDoc ? (
        <iframe
          title={`${component} playground preview`}
          // allow-scripts: basecoat's runtime and the theme-sync script must run;
          // allow-same-origin: theme sync reads the parent's data-theme. Content
          // is our own edge-rendered markup from locally typed props.
          sandbox="allow-scripts allow-same-origin"
          srcDoc={iframeSrcDoc}
          style={{
            width: '100%',
            minHeight: `${minHeight}px`,
            border: '1px solid var(--blume-border)',
            borderRadius: '8px',
            background: 'var(--blume-background)',
          }}
        />
      ) : (
        <iframe
          src={`/previews/${schema.previewSlug}.html`}
          title={`${component} preview`}
          loading="lazy"
          style={{
            width: '100%',
            minHeight: `${minHeight}px`,
            border: '1px solid var(--blume-border)',
            borderRadius: '8px',
          }}
        />
      )}

      <div style={sourceHeaderStyle}>
        <span style={labelTextStyle}>Usage</span>
        <button type="button" onClick={() => void copySource()} style={buttonStyle} disabled={!source}>
          Copy
        </button>
      </div>
      <pre style={preStyle}>
        {source
          ? highlightEdge(source).map((t, i) =>
              t.color ? (
                <span key={i} style={{ color: t.color }}>
                  {t.text}
                </span>
              ) : (
                t.text
              ),
            )
          : '…'}
      </pre>

      {showPropsTable && (
        <>
          <div style={sourceHeaderStyle}>
            <span style={labelTextStyle}>Props</span>
          </div>
          <div style={propsTableStyle}>
            <div style={propsHeaderStyle}>
              <span>Prop</span>
              <span>Type</span>
              <span aria-hidden="true" style={chevronSpacerStyle} />
            </div>
            <div style={propsBodyStyle}>
              {propEntries.map(([name, prop]) =>
                renderPropRow(
                  name,
                  prop.type,
                  !prop.required,
                  <>
                    {prop.description && <p style={propDescriptionStyle}>{prop.description}</p>}
                    {prop.default && (
                      <p style={propDefaultStyle}>
                        <span style={propDefaultLabelStyle}>Default:</span>{' '}
                        <code style={propDefaultValueStyle}>{prop.default}</code>
                      </p>
                    )}
                    {prop.control && (
                      <div style={propControlStyle}>{renderControlInput(name, prop.control)}</div>
                    )}
                  </>,
                ),
              )}
              {schema.hasSlot &&
                renderPropRow(
                  'slot',
                  'edge markup',
                  true,
                  <textarea
                    value={slot}
                    onChange={(event) => setSlotDebounced(event.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />,
                )}
            </div>
          </div>
        </>
      )}

      {schema.hasIndexSignature && (
        <p style={indexSignatureStyle}>
          Plus any additional HTML attributes, forwarded to the root element.
        </p>
      )}
    </div>
  )
}


/**
 * Minimal Edge-aware highlighter for the live Usage snippet. Deterministic
 * regex tokenizer (tags, mustaches, strings, HTML) with theme-variable colors
 * so it tracks light/dark like the shiki fences elsewhere on the page.
 */
function highlightEdge(code: string): { text: string; color?: string }[] {
  const tokens: { text: string; color?: string }[] = []
  const pattern = /(@!?[\w.]+|@end\b|\{\{--|--\}\}|\{\{\{?|\}?\}\}|'[^']*'|"[^"]*"|<\/?[a-zA-Z][\w-]*|>)/g
  let last = 0
  for (const match of code.matchAll(pattern)) {
    const i = match.index ?? 0
    if (i > last) tokens.push({ text: code.slice(last, i) })
    const t = match[0]
    let color: string | undefined
    if (t.startsWith('@')) color = '#3b82f6'
    else if (t.startsWith("'") || t.startsWith('"')) color = '#22c55e'
    else if (t.startsWith('{{') || t.endsWith('}}')) color = '#f59e0b'
    else if (t.startsWith('<') || t === '>') color = 'var(--blume-muted-foreground)'
    tokens.push({ text: t, color })
    last = i + t.length
  }
  if (last < code.length) tokens.push({ text: code.slice(last) })
  return tokens
}

const rootStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  marginBlock: '1rem',
}

const toggleLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '0.5rem',
}

const labelTextStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--blume-muted-foreground)',
}

const inputStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  border: '1px solid var(--blume-border)',
  borderRadius: '6px',
  background: 'var(--blume-background)',
  color: 'var(--blume-foreground)',
  fontSize: '0.875rem',
  width: '100%',
  boxSizing: 'border-box',
}

const noticeStyle: CSSProperties = {
  margin: 0,
  padding: '0.65rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--blume-border)',
  background: 'var(--blume-muted)',
  color: 'var(--blume-muted-foreground)',
  fontSize: '0.875rem',
}

const codeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '0.8125rem',
}

const sourceHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
}

const buttonStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid var(--blume-border)',
  borderRadius: '6px',
  background: 'var(--blume-background)',
  color: 'var(--blume-foreground)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
}

const preStyle: CSSProperties = {
  margin: 0,
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--blume-border)',
  background: 'var(--blume-muted)',
  color: 'var(--blume-foreground)',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  overflowX: 'auto',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  whiteSpace: 'pre-wrap',
}

const propsTableStyle: CSSProperties = {
  border: '1px solid var(--blume-border)',
  borderRadius: '8px',
  background: 'color-mix(in oklch, var(--blume-muted) 30%, transparent)',
  padding: '0.375rem',
}

const propsHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr 0.875rem',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--blume-muted-foreground)',
}

const propsBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  marginTop: '0.25rem',
}

const propsRowStyle: CSSProperties = {
  borderTop: '1px solid var(--blume-border)',
}

const propsRowExpandedStyle: CSSProperties = {
  borderTopColor: 'transparent',
  borderRadius: '8px',
  background: 'var(--blume-background)',
  boxShadow: '0 1px 2px color-mix(in oklch, var(--blume-foreground) 8%, transparent)',
  outline: '1px solid var(--blume-border)',
}

const propsSummaryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr 0.875rem',
  alignItems: 'center',
  gap: '1rem',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
}

const propNameStyle: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '0.75rem',
  color: 'var(--blume-accent)',
  wordBreak: 'break-word',
}

const propTypeStyle: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  fontSize: '0.75rem',
  color: 'var(--blume-foreground)',
  wordBreak: 'break-word',
}

const chevronStyle: CSSProperties = {
  width: '0.875rem',
  height: '0.875rem',
  flexShrink: 0,
  color: 'var(--blume-muted-foreground)',
  transition: 'transform 0.15s ease',
}

const chevronSpacerStyle: CSSProperties = {
  width: '0.875rem',
  height: '0.875rem',
}

const propsDetailStyle: CSSProperties = {
  borderTop: '1px solid var(--blume-border)',
  padding: '0.75rem',
  fontSize: '0.75rem',
}

const propDescriptionStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  color: 'var(--blume-foreground)',
}

const propDefaultStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  color: 'var(--blume-foreground)',
}

const propDefaultLabelStyle: CSSProperties = {
  color: 'var(--blume-muted-foreground)',
}

const propDefaultValueStyle: CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
}

const propControlStyle: CSSProperties = {
  marginTop: '0.5rem',
}

const indexSignatureStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  color: 'var(--blume-muted-foreground)',
}
