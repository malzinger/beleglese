import type { Truth } from '../samples'
import type { Extraction } from './schema'

export type FieldKey =
  | 'vendorName'
  | 'vendorVatId'
  | 'invoiceNumber'
  | 'issueDate'
  | 'dueDate'
  | 'currency'
  | 'net'
  | 'vat'
  | 'gross'
  | 'iban'
  | 'reverseCharge'
  | 'vatRates'
  | 'line'

export interface FieldScore {
  field: FieldKey
  /** 1-based position for line items. */
  index?: number
  expected: string
  actual: string
  ok: boolean
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const compact = (s: string | null | undefined) => (s ?? '').replace(/\s/g, '').toUpperCase()
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '–' : String(v))
const sameMoney = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.005

/**
 * Scores an extraction against hand-checked ground truth, one row per field. Names match
 * if either contains the other after normalising, IDs ignore spacing, amounts must match
 * to the cent. Missing or extra line items count as misses.
 */
export function score(e: Extraction, t: Truth): FieldScore[] {
  const rows: FieldScore[] = []
  const add = (field: FieldKey, expected: unknown, actual: unknown, ok: boolean, index?: number) =>
    rows.push({ field, index, expected: show(expected), actual: show(actual), ok })

  const name = e.vendor.name.value ?? ''
  const a = norm(name)
  const b = norm(t.vendorName)
  add('vendorName', t.vendorName, name, a.length > 0 && (a.includes(b) || b.includes(a)))

  if (t.vendorVatId !== undefined) {
    const got = e.vendor.vatId.value
    add('vendorVatId', t.vendorVatId, got, compact(got) === compact(t.vendorVatId))
  }
  if (t.invoiceNumber !== undefined) {
    const got = e.invoiceNumber.value
    const x = norm(got ?? '')
    const y = norm(t.invoiceNumber ?? '')
    add('invoiceNumber', t.invoiceNumber, got, x === y || (y.length > 0 && x.endsWith(y)))
  }
  add('issueDate', t.issueDate, e.issueDate.value, e.issueDate.value === t.issueDate)
  if (t.dueDate !== undefined)
    add('dueDate', t.dueDate, e.dueDate.value, e.dueDate.value === t.dueDate)
  add('currency', t.currency, e.currency, compact(e.currency) === t.currency)

  for (const key of ['net', 'vat', 'gross'] as const) {
    const expected = t[key]
    if (expected === undefined) continue
    const got = e.totals[key].value
    add(key, expected, got, sameMoney(got, expected))
  }
  if (t.iban !== undefined) {
    const got = e.payment.iban.value
    add('iban', t.iban, got, compact(got) === compact(t.iban))
  }
  add('reverseCharge', t.reverseCharge, e.reverseCharge, e.reverseCharge === t.reverseCharge)

  const rates = [
    ...new Set(
      e.vatBreakdown
        .map((r) => r.rate)
        .concat(e.lineItems.flatMap((l) => (l.vatRate === null ? [] : [l.vatRate]))),
    ),
  ].sort((x, y) => x - y)
  const wantRates = [...t.vatRates].sort((x, y) => x - y)
  add('vatRates', wantRates.join(' / '), rates.join(' / '), rates.join() === wantRates.join())

  const lines = Math.max(t.lineAmounts.length, e.lineItems.length)
  for (let i = 0; i < lines; i++) {
    const want = t.lineAmounts[i] ?? null
    const got = e.lineItems[i]?.amount ?? null
    add('line', want, got, sameMoney(got, want), i + 1)
  }
  return rows
}
