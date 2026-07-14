import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PlaygroundSchema, PropControl } from '../src/playground-types.ts'

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

export default function Playground({ component, schema, minHeight = 160 }: PlaygroundProps) {
  const [propValues, setPropValues] = useState<Record<string, unknown>>(() => ({
    ...schema.defaultProps,
  }))
  const [slot, setSlot] = useState(schema.defaultSlot)
  const [source, setSource] = useState('')
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string | null>(null)
  const [serverAvailable, setServerAvailable] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)
  const propValuesRef = useRef(propValues)
  const slotRef = useRef(slot)
  propValuesRef.current = propValues
  slotRef.current = slot

  const editableProps = Object.keys(schema.controls)

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

  const copySource = async () => {
    if (!source) return
    try {
      await navigator.clipboard.writeText(source)
    } catch {
      // ignore clipboard errors
    }
  }

  const renderControl = (name: string, control: PropControl) => {
    const value = propValues[name]

    if (control.kind === 'select') {
      return (
        <label key={name} style={labelStyle}>
          <span style={labelTextStyle}>{name}</span>
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
        </label>
      )
    }

    if (control.kind === 'toggle') {
      return (
        <label
          key={name}
          style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => setPropImmediate(name, event.target.checked)}
          />
          <span style={labelTextStyle}>{name}</span>
        </label>
      )
    }

    return (
      <label key={name} style={labelStyle}>
        <span style={labelTextStyle}>{name}</span>
        <input
          type="text"
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(event) => setPropDebounced(name, event.target.value)}
          style={inputStyle}
        />
      </label>
    )
  }

  const showSlot = schema.defaultSlot.length > 0 || slot.length > 0

  return (
    <div style={rootStyle}>
      {!serverAvailable && (
        <p style={noticeStyle}>
          Playground needs the demo server: run <code style={codeStyle}>bun run demo</code> in{' '}
          <code style={codeStyle}>examples/basecoat-edge</code>
        </p>
      )}

      {editableProps.length > 0 && (
        <div style={controlsStyle}>
          {editableProps.map((name) => renderControl(name, schema.controls[name]))}
        </div>
      )}

      {showSlot && (
        <label style={labelStyle}>
          <span style={labelTextStyle}>slot</span>
          <textarea
            value={slot}
            onChange={(event) => setSlotDebounced(event.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>
      )}

      {serverAvailable && iframeSrcDoc ? (
        <iframe
          title={`${component} playground preview`}
          sandbox=""
          srcDoc={iframeSrcDoc}
          style={{
            width: '100%',
            minHeight: `${minHeight}px`,
            border: '1px solid var(--color-border-tertiary)',
            borderRadius: '8px',
            background: 'var(--color-bg-primary, #fff)',
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
            border: '1px solid var(--color-border-tertiary)',
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
      <pre style={preStyle}>{source || '…'}</pre>
    </div>
  )
}

const rootStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  marginBlock: '1rem',
}

const controlsStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
}

const labelTextStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary, #555)',
}

const inputStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  border: '1px solid var(--color-border-tertiary, #ddd)',
  borderRadius: '6px',
  background: 'var(--color-bg-primary, #fff)',
  color: 'var(--color-text-primary, #111)',
  fontSize: '0.875rem',
}

const noticeStyle: CSSProperties = {
  margin: 0,
  padding: '0.65rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--color-border-tertiary, #ddd)',
  background: 'var(--color-bg-secondary, #f8f8f8)',
  color: 'var(--color-text-secondary, #555)',
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
  border: '1px solid var(--color-border-tertiary, #ddd)',
  borderRadius: '6px',
  background: 'var(--color-bg-primary, #fff)',
  color: 'var(--color-text-primary, #111)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
}

const preStyle: CSSProperties = {
  margin: 0,
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border-tertiary, #ddd)',
  background: 'var(--color-bg-secondary, #f8f8f8)',
  color: 'var(--color-text-primary, #111)',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  overflowX: 'auto',
  fontFamily: 'var(--font-mono, ui-monospace, monospace)',
  whiteSpace: 'pre-wrap',
}
