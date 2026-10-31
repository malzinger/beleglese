import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Check, Verdict } from '../core/checks'
import type { FieldScore } from '../core/evaluate'
import type { ExtractionRun } from '../core/extract'
import type { Extraction, Sourced } from '../core/schema'
import type { Sample } from '../samples'
import { date, money, num, type Lang, type Strings } from './i18n'

/** SVG filter that roughens the stamps like real ink on paper. Rendered once. */
export function InkFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="2"
          seed="7"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.55"
          result="speckle"
        />
        <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
        <feDisplacementMap in="inked" in2="noise" scale="1.8" />
      </filter>
    </svg>
  )
}

interface StampProps {
  e: Extraction
  verdict: Verdict
  t: Strings
  lang: Lang
}

function Stamps({ e, verdict, t, lang }: StampProps) {
  const rates = [...new Set(e.vatBreakdown.map((r) => r.rate))]
  return (
    <div className="stamps" aria-hidden="true">
      <div className="stamp stamp-verdict">
        <div className={`verdict-stamp v-${verdict}`}>{t.verdict[verdict]}</div>
      </div>
      <div className="stamp stamp-k">
        <div className="kontierung">
          <div className="k-title">{lang === 'de' ? 'Kontierung' : 'Posting'}</div>
          <div className="k-cell">
            <span>{t.stamp.account}</span>
            <b className="k-big">{e.booking.account}</b>
          </div>
          <div className="k-cell">
            <span>{t.stamp.amount}</span>
            <b>{money(e.totals.gross.value, e.currency, lang)}</b>
          </div>
          <div className="k-cell">
            <span>{t.stamp.date}</span>
            <b>{date(e.issueDate.value, lang)}</b>
          </div>
          <div className="k-cell k-wide">
            <span>{t.stamp.text}</span>
            <b>{e.booking.accountName}</b>
          </div>
          <div className="k-cell">
            <span>{t.stamp.vat}</span>
            <b>{rates.length ? `${rates.join(' / ')} %` : '–'}</b>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StageProps {
  src: string
  isPdf: boolean
  alt: string
  result?: { e: Extraction; verdict: Verdict }
  /** Changing it replays the stamp animation. */
  stampKey: string
  t: Strings
  lang: Lang
  overlay?: ReactNode
}

export function DocumentStage({ src, isPdf, alt, result, stampKey, t, lang, overlay }: StageProps) {
  // The paper is a size container for the stamps, so it needs a width that does not
  // depend on its content; derive it from the image's aspect ratio once it has loaded.
  const [ratio, setRatio] = useState(0.71)
  return (
    <figure className={`stage${isPdf ? ' is-pdf' : ''}`}>
      <div
        className={`paper${ratio < 0.75 ? ' narrow' : ''}`}
        style={{ '--ar': ratio } as CSSProperties}
      >
        {isPdf ? (
          <object data={src} type="application/pdf" className="pdf" aria-label={alt} />
        ) : (
          <img
            src={src}
            alt={alt}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
            }}
          />
        )}
        {result && (
          <Stamps key={stampKey} e={result.e} verdict={result.verdict} t={t} lang={lang} />
        )}
        {overlay}
      </div>
    </figure>
  )
}

const GLYPH = { pass: '✓', warn: '!', fail: '✕', skip: '–' } as const

export function ChecksList({
  checks,
  t,
  currency,
}: {
  checks: Check[]
  t: Strings
  currency: string
}) {
  const active = checks.filter((c) => c.status !== 'skip')
  const skipped = checks.filter((c) => c.status === 'skip')
  return (
    <section className="checks" aria-label={t.checksTitle}>
      <header className="section-head">
        <h2>{t.checksTitle}</h2>
        <span>{t.checksNote}</span>
      </header>
      <ul>
        {active.map((c) => (
          <li key={c.id} className={`check s-${c.status}`}>
            <i aria-hidden="true">{GLYPH[c.status]}</i>
            <div>
              <b>{t.checkTitles[c.id]}</b>
              <p>{t.check(c, currency)}</p>
            </div>
          </li>
        ))}
      </ul>
      {skipped.length > 0 && (
        <p className="skipped">
          {t.skipped}: {skipped.map((c) => t.checkTitles[c.id]).join(', ')}
        </p>
      )}
    </section>
  )
}

interface RowProps<T> {
  label: string
  f: Sourced<T>
  t: Strings
  showSources: boolean
  children?: ReactNode
}

function Row<T>({ label, f, t, showSources, children }: RowProps<T>) {
  const doubt = f.confidence === 'high' ? undefined : t.confidence[f.confidence]
  return (
    <div className={`row c-${f.confidence}`}>
      <dt>{label}</dt>
      <dd>
        <span className="val" title={doubt}>
          {children ?? (f.value === null ? '–' : String(f.value))}
          {doubt && <span className="sr-only"> ({doubt})</span>}
        </span>
        {showSources && f.source && (
          <q className="src" aria-label={t.sourceLabel}>
            {f.source}
          </q>
        )}
      </dd>
    </div>
  )
}

export function Ledger({ e, t, lang }: { e: Extraction; t: Strings; lang: Lang }) {
  const [showSources, setShowSources] = useState(false)
  const m = (n: number | null) => money(n, e.currency, lang)
  const p = { t, showSources }
  return (
    <section className="ledger" aria-label={t.sections.doc}>
      <label className="sources-toggle">
        <input
          type="checkbox"
          checked={showSources}
          onChange={(ev) => setShowSources(ev.target.checked)}
        />
        {t.showSources}
      </label>

      <h3>{t.sections.vendor}</h3>
      <dl>
        <Row label={t.f.name} f={e.vendor.name} {...p} />
        <Row label={t.f.address} f={e.vendor.address} {...p} />
        <Row label={t.f.vatId} f={e.vendor.vatId} {...p} />
        <Row label={t.f.taxNumber} f={e.vendor.taxNumber} {...p} />
        <Row label={t.f.recipient} f={e.recipient.name} {...p} />
      </dl>

      <h3>{t.sections.doc}</h3>
      <dl>
        <div className="row c-high">
          <dt>{t.f.type}</dt>
          <dd>
            <span className="val">{t.docTypes[e.documentType]}</span>
          </dd>
        </div>
        <Row label={t.f.number} f={e.invoiceNumber} {...p} />
        <Row label={t.f.issueDate} f={e.issueDate} {...p}>
          {date(e.issueDate.value, lang)}
        </Row>
        <Row label={t.f.serviceDate} f={e.serviceDate} {...p} />
        <Row label={t.f.dueDate} f={e.dueDate} {...p}>
          {date(e.dueDate.value, lang)}
        </Row>
      </dl>

      <h3>
        {t.sections.items} <small>{t.f.amountsAre[e.amountsAre]}</small>
      </h3>
      <div className="items-wrap">
        <table className="items">
          <thead>
            <tr>
              <th>{t.itemCols.desc}</th>
              <th className="n">{t.itemCols.qty}</th>
              <th className="n">{t.itemCols.rate}</th>
              <th className="n">{t.itemCols.amount}</th>
            </tr>
          </thead>
          <tbody>
            {e.lineItems.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.description}
                  {showSources && <q className="src">{l.source}</q>}
                </td>
                <td className="n">{num(l.quantity, lang)}</td>
                <td className="n">{l.vatRate === null ? '–' : `${l.vatRate} %`}</td>
                <td className="n">{m(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t.sections.totals}</h3>
      <dl className="totals">
        <Row label={t.f.net} f={e.totals.net} {...p}>
          {m(e.totals.net.value)}
        </Row>
        {e.vatBreakdown.map((r) => (
          <div key={r.rate} className="row c-high sub">
            <dt>
              {t.f.vat} {r.rate} %
            </dt>
            <dd>
              <span className="val">{m(r.vat)}</span>
            </dd>
          </div>
        ))}
        <Row label={t.f.vat} f={e.totals.vat} {...p}>
          {m(e.totals.vat.value)}
        </Row>
        <Row label={t.f.gross} f={e.totals.gross} {...p}>
          <strong>{m(e.totals.gross.value)}</strong>
        </Row>
        {e.totals.tip.value !== null && (
          <Row label={t.f.tip} f={e.totals.tip} {...p}>
            {m(e.totals.tip.value)}
          </Row>
        )}
      </dl>

      <h3>{t.sections.payment}</h3>
      <dl>
        <Row label={t.f.iban} f={e.payment.iban} {...p}>
          <span className="mono">
            {e.payment.iban.value?.replace(/(.{4})/g, '$1 ').trim() ?? '–'}
          </span>
        </Row>
        <Row label={t.f.bic} f={e.payment.bic} {...p} />
        <Row label={t.f.method} f={e.payment.method} {...p} />
        <div className="row c-high">
          <dt>{t.f.reverseCharge}</dt>
          <dd>
            <span className="val">{e.reverseCharge ? t.yes : t.no}</span>
          </dd>
        </div>
      </dl>

      <h3>{t.sections.booking}</h3>
      <p className="booking">
        <b className="mono">{e.booking.account}</b> {e.booking.accountName}
        <span>{e.booking.reason[lang]}</span>
      </p>
    </section>
  )
}

export function RunMeta({
  run,
  t,
  lang,
  live,
}: {
  run: ExtractionRun
  t: Strings
  lang: Lang
  live: boolean
}) {
  const cost = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 3,
  }).format(run.costUsd)
  const when = new Date(run.recordedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (
    <p className="run-meta">
      <span>
        {t.run(
          run.model,
          run.inputTokens,
          run.outputTokens,
          cost,
          (run.latencyMs / 1000).toFixed(1),
        )}
      </span>
      <span className={live ? 'tag live' : 'tag'}>{live ? t.live : t.recorded(when)}</span>
      {run.fallbackUsed && <span className="tag">{t.fallback}</span>}
    </p>
  )
}

export interface AccuracyRow {
  sample: Sample
  run: ExtractionRun
  scores: FieldScore[]
}

export function Accuracy({ rows, t, lang }: { rows: AccuracyRow[]; t: Strings; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null)
  const total = rows.reduce((n, r) => n + r.scores.length, 0)
  const hits = rows.reduce((n, r) => n + r.scores.filter((s) => s.ok).length, 0)
  const cost = rows.reduce((n, r) => n + r.run.costUsd, 0)
  const usd = (n: number) =>
    new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 3,
    }).format(n)
  const label = (s: FieldScore) => `${t.fields[s.field]}${s.index ? ` ${s.index}` : ''}`
  const first = rows[0]?.run

  return (
    <section className="accuracy">
      <h2>{t.accTitle}</h2>
      <p className="lede">{t.accIntro}</p>
      {rows.length === 0 ? (
        <p className="empty">{t.accEmpty}</p>
      ) : (
        <>
          <div className="score-hero">
            <b>{total ? Math.round((hits / total) * 1000) / 10 : 0}&#8239;%</b>
            <span>
              {hits} / {total} {t.accFields}
            </span>
          </div>
          <table className="acc-table">
            <thead>
              <tr>
                <th>{t.accDoc}</th>
                <th>{t.accScore}</th>
                <th className="n">{t.accCost}</th>
                <th className="n">{t.accTime}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ok = r.scores.filter((s) => s.ok).length
                const misses = r.scores.filter((s) => !s.ok)
                const isOpen = open === r.sample.id
                return (
                  <tr key={r.sample.id} className={misses.length ? 'has-miss' : ''}>
                    <td>
                      <button
                        className="acc-doc"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : r.sample.id)}
                      >
                        <b>{r.sample.title[lang]}</b>
                        <span>{r.sample.kind[lang]}</span>
                      </button>
                      {isOpen && (
                        <div className="misses">
                          {misses.length === 0 ? (
                            <p>
                              {t.accMisses}: {t.accPerfect}
                            </p>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  <th />
                                  <th>{t.accExpected}</th>
                                  <th>{t.accActual}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {misses.map((s, i) => (
                                  <tr key={i}>
                                    <td>{label(s)}</td>
                                    <td className="mono">{s.expected}</td>
                                    <td className="mono">{s.actual}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="bar" aria-label={`${ok} / ${r.scores.length}`}>
                        {r.scores.map((s, i) => (
                          <i key={i} className={s.ok ? 'hit' : 'miss'} title={label(s)} />
                        ))}
                      </div>
                      <span className="mono">
                        {ok}/{r.scores.length}
                      </span>
                    </td>
                    <td className="n mono">{usd(r.run.costUsd)}</td>
                    <td className="n mono">{(r.run.latencyMs / 1000).toFixed(1)} s</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>{t.accTotal}</td>
                <td className="mono">
                  {hits}/{total}
                </td>
                <td className="n mono">{usd(cost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          {first && (
            <p className="fine">
              {t.accModel(
                first.model,
                new Date(first.recordedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB'),
              )}
            </p>
          )}
        </>
      )}
    </section>
  )
}
