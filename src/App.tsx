import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { runChecks, verdict } from './core/checks'
import { score } from './core/evaluate'
import type { ExtractionRun, MediaType } from './core/extract'
import { SAMPLES } from './samples'
import recorded from './samples/runs.json'
import {
  Accuracy,
  ChecksList,
  DocumentStage,
  InkFilter,
  Ledger,
  RunMeta,
  type AccuracyRow,
} from './ui/components'
import { detectLang, STRINGS, type Lang } from './ui/i18n'
import type { LiveError } from './ui/live'

const ACCEPTED: MediaType[] = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

const RECORDED = recorded as Record<string, ExtractionRun>
const REPO_URL = 'https://github.com/malzinger/beleglese'
const KEY_STORE = 'beleglese.key'

type Selection = { kind: 'sample'; id: string } | { kind: 'own' }
type Tab = 'doc' | 'accuracy'

interface OwnDoc {
  file: File
  url: string
  type: MediaType
}

function readUrl(): { sel: Selection; tab: Tab } {
  const q = new URLSearchParams(location.search)
  const id = q.get('doc')
  const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0]
  return {
    sel: { kind: 'sample', id: sample?.id ?? '' },
    tab: q.get('tab') === 'accuracy' ? 'accuracy' : 'doc',
  }
}

function loadKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}

function storeKey(key: string) {
  try {
    if (key) sessionStorage.setItem(KEY_STORE, key)
    else sessionStorage.removeItem(KEY_STORE)
  } catch {
    // Private mode: the key simply lives for this page view.
  }
}

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang)
  const t = STRINGS[lang]
  const [initial] = useState(readUrl)
  const [sel, setSel] = useState<Selection>(initial.sel)
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [liveRuns, setLiveRuns] = useState<Record<string, ExtractionRun>>({})
  const [own, setOwn] = useState<OwnDoc | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<LiveError | null>(null)
  const [apiKey, setApiKey] = useState(loadKey)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const key = sel.kind === 'own' ? 'own' : sel.id
  const sample = sel.kind === 'sample' ? SAMPLES.find((s) => s.id === sel.id) : undefined
  const run: ExtractionRun | undefined = liveRuns[key] ?? (sample ? RECORDED[sample.id] : undefined)
  const isLive = Boolean(liveRuns[key])
  const checks = useMemo(() => (run ? runChecks(run.extraction) : null), [run])
  const reading = busy === key

  const verdicts = useMemo(() => {
    const out: Record<string, ReturnType<typeof verdict>> = {}
    for (const s of SAMPLES) {
      const r = liveRuns[s.id] ?? RECORDED[s.id]
      if (r) out[s.id] = verdict(runChecks(r.extraction))
    }
    return out
  }, [liveRuns])

  const accuracyRows: AccuracyRow[] = useMemo(
    () =>
      SAMPLES.flatMap((s) => {
        const r = RECORDED[s.id]
        return r ? [{ sample: s, run: r, scores: score(r.extraction, s.truth) }] : []
      }),
    [],
  )

  useEffect(() => {
    const q = new URLSearchParams()
    if (sel.kind === 'sample') q.set('doc', sel.id)
    if (tab === 'accuracy') q.set('tab', 'accuracy')
    q.set('lang', lang)
    const theme = new URLSearchParams(location.search).get('theme')
    if (theme) q.set('theme', theme)
    history.replaceState(null, '', `${location.pathname}?${q.toString()}`)
    document.documentElement.lang = lang
  }, [sel, tab, lang])

  useEffect(
    () => () => {
      if (own) URL.revokeObjectURL(own.url)
    },
    [own],
  )

  const choose = (next: Selection) => {
    setSel(next)
    setError(null)
    setTab('doc')
  }

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    const type = ACCEPTED.find((a) => a === file.type)
    if (!type) return setError({ key: 'type' })
    if (file.size > MAX_BYTES) return setError({ key: 'tooBig' })
    setError(null)
    setLiveRuns((runs) => {
      const next = { ...runs }
      delete next.own
      return next
    })
    setOwn({ file, url: URL.createObjectURL(file), type })
    setSel({ kind: 'own' })
  }

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault()
    setDragging(false)
    acceptFile(ev.dataTransfer.files[0])
  }

  const readNow = async () => {
    if (!apiKey.trim()) return setError({ key: 'needKey' })
    const target = key
    setBusy(target)
    setError(null)
    // The SDK and the schema are only needed for live reads, so load them on demand.
    const live = await import('./ui/live')
    try {
      let blob: Blob
      let type: MediaType
      if (sel.kind === 'own') {
        if (!own) return
        blob = own.file
        type = own.type
      } else {
        if (!sample) return
        blob = await (await fetch(asset(sample.input))).blob()
        type = sample.mediaType
      }
      const result = await live.readLive(apiKey.trim(), blob, type)
      setLiveRuns((r) => ({ ...r, [target]: result }))
    } catch (err) {
      setError(live.classifyError(err))
    } finally {
      setBusy((b) => (b === target ? null : b))
    }
  }

  const docSrc = sel.kind === 'own' ? own?.url : sample ? asset(sample.image) : undefined
  const isPdf = sel.kind === 'own' && own?.type === 'application/pdf'
  const docAlt = sample ? `${sample.title[lang]}, ${sample.kind[lang]}` : (own?.file.name ?? '')

  const keyForm = (
    <div className="key-form">
      <label htmlFor="api-key">{t.keyTitle}</label>
      <input
        id="api-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.keyPlaceholder}
        value={apiKey}
        onChange={(e) => {
          setApiKey(e.target.value)
          storeKey(e.target.value.trim())
        }}
      />
      <p>{t.keyHelp}</p>
      <button
        className="btn primary"
        disabled={reading || (sel.kind === 'own' && !own)}
        onClick={readNow}
      >
        {reading ? `${t.reading} …` : sel.kind === 'own' ? t.extract : t.readLive}
      </button>
    </div>
  )

  const errorBox = error && (
    <p className="error" role="alert">
      {error.key === 'needKey'
        ? t.needKey
        : error.key === 'other'
          ? `${t.errors.other} ${error.detail ?? ''}`.trim()
          : t.errors[error.key]}
    </p>
  )

  return (
    <div className="app">
      <InkFilter />
      <header className="masthead">
        <div className="brand">
          <span className="wordmark">Beleglese</span>
          <span className="claim">{t.claim}</span>
        </div>
        <nav className="tabs" aria-label="Ansicht">
          {(['doc', 'accuracy'] as const).map((k) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              {t.tabs[k]}
            </button>
          ))}
        </nav>
        <div className="tools">
          <div className="seg" role="group" aria-label="Sprache / Language">
            {(['de', 'en'] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            {t.source} ↗
          </a>
        </div>
      </header>

      {tab === 'accuracy' ? (
        <main className="acc-main">
          <Accuracy rows={accuracyRows} t={t} lang={lang} />
        </main>
      ) : (
        <main className="workbench">
          <aside className="stack" aria-label={t.stack}>
            <h2 className="eyebrow">{t.stack}</h2>
            <ol>
              {SAMPLES.map((s) => {
                const v = verdicts[s.id]
                const active = sel.kind === 'sample' && sel.id === s.id
                return (
                  <li key={s.id}>
                    <button
                      className="stack-item"
                      aria-current={active || undefined}
                      onClick={() => choose({ kind: 'sample', id: s.id })}
                    >
                      <img src={asset(s.image)} alt="" loading="lazy" />
                      <span className="si-text">
                        <b>{s.title[lang]}</b>
                        <span>{s.kind[lang]}</span>
                      </span>
                      {v && <i className={`dot v-${v}`} title={t.verdict[v]} />}
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  className={`stack-item own${sel.kind === 'own' ? ' is-active' : ''}`}
                  aria-current={sel.kind === 'own' || undefined}
                  onClick={() => choose({ kind: 'own' })}
                >
                  <span className="plus" aria-hidden="true">
                    +
                  </span>
                  <span className="si-text">
                    <b>{t.ownDoc}</b>
                    <span>{own ? own.file.name : t.dropHelp}</span>
                  </span>
                </button>
              </li>
            </ol>
          </aside>

          <section className="desk">
            {docSrc ? (
              <DocumentStage
                src={docSrc}
                isPdf={isPdf}
                alt={docAlt}
                stampKey={`${key}-${run?.recordedAt ?? ''}`}
                result={run && checks ? { e: run.extraction, verdict: verdict(checks) } : undefined}
                t={t}
                lang={lang}
                overlay={reading ? <div className="scanline" aria-hidden="true" /> : undefined}
              />
            ) : (
              <div
                className={`dropzone${dragging ? ' over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <b>{t.dropTitle}</b>
                <span>{t.dropHelp}</span>
                <button className="btn" onClick={() => fileInput.current?.click()}>
                  {t.choose}
                </button>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              hidden
              accept={ACCEPTED.join(',')}
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            {sample && <p className="point">{sample.point[lang]}</p>}
            {sel.kind === 'own' && own && (
              <button className="btn quiet" onClick={() => fileInput.current?.click()}>
                {t.choose}
              </button>
            )}
            {run && <RunMeta run={run} t={t} lang={lang} live={isLive} />}
          </section>

          <aside className="sheet" aria-live="polite">
            {run && checks ? (
              <>
                <div className={`verdict v-${verdict(checks)}`}>
                  <b>{t.verdict[verdict(checks)]}</b>
                  <span>{t.verdictLong[verdict(checks)]}</span>
                </div>
                <ChecksList checks={checks} t={t} currency={run.extraction.currency} />
                <Ledger e={run.extraction} t={t} lang={lang} />
                {errorBox}
                <details className="rerun">
                  <summary>{t.readLive}</summary>
                  {keyForm}
                </details>
              </>
            ) : (
              <div className="sheet-empty">
                {sel.kind === 'sample' && <p>{t.noRun}</p>}
                {keyForm}
                {errorBox}
              </div>
            )}
          </aside>
        </main>
      )}
    </div>
  )
}
