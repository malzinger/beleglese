import type { Extraction } from './schema'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type CheckId =
  | 'lineSum'
  | 'vatMath'
  | 'totalMath'
  | 'vatRates'
  | 'iban'
  | 'vatId'
  | 'dates'
  | 'mandatory'
  | 'reverseCharge'

export interface Check {
  id: CheckId
  status: CheckStatus
  /** Numbers or field names the UI needs to explain the result. */
  expected?: number
  actual?: number
  rates?: number[]
  missing?: MandatoryField[]
  smallInvoice?: boolean
}

export type MandatoryField =
  | 'vendorName'
  | 'vendorAddress'
  | 'recipientName'
  | 'recipientAddress'
  | 'taxId'
  | 'invoiceNumber'
  | 'issueDate'
  | 'serviceDate'
  | 'lineItems'
  | 'vatBreakdown'
  | 'gross'

/** Rounding slack in euros; printed amounts are rounded per line. */
const TOLERANCE = 0.02
const SMALL_INVOICE_LIMIT = 250
const GERMAN_VAT_RATES = [0, 7, 19]

const round2 = (n: number) => Math.round(n * 100) / 100
const close = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE + 1e-9

/**
 * Deterministic checks on what Claude read. The model transcribes; arithmetic, checksums
 * and the §14 UStG rules are verified here in code, so a wrong document or a misread
 * digit shows up as a failed check instead of being silently "fixed".
 */
export function runChecks(e: Extraction, today = new Date()): Check[] {
  return [
    lineSum(e),
    vatMath(e),
    totalMath(e),
    vatRates(e),
    ibanCheck(e),
    vatIdCheck(e),
    dates(e, today),
    mandatory(e),
    reverseCharge(e),
  ]
}

function lineSum(e: Extraction): Check {
  const target = e.amountsAre === 'net' ? e.totals.net.value : e.totals.gross.value
  if (e.lineItems.length === 0 || target === null) return { id: 'lineSum', status: 'skip' }
  const sum = round2(e.lineItems.reduce((s, l) => s + l.amount, 0))
  return {
    id: 'lineSum',
    status: close(sum, target) ? 'pass' : 'fail',
    expected: target,
    actual: sum,
  }
}

function vatMath(e: Extraction): Check {
  if (e.vatBreakdown.length === 0) return { id: 'vatMath', status: 'skip' }
  const wrong = e.vatBreakdown.find((r) => !close(round2((r.net * r.rate) / 100), r.vat))
  if (!wrong) return { id: 'vatMath', status: 'pass' }
  return {
    id: 'vatMath',
    status: 'fail',
    rates: [wrong.rate],
    expected: round2((wrong.net * wrong.rate) / 100),
    actual: wrong.vat,
  }
}

function totalMath(e: Extraction): Check {
  const gross = e.totals.gross.value
  // Till receipts often print only the per-rate table, so fall back to its sums.
  const fromTable = e.vatBreakdown.length > 0
  const net = e.totals.net.value ?? (fromTable ? sumOf(e.vatBreakdown, 'net') : null)
  const vat = e.totals.vat.value ?? (fromTable ? sumOf(e.vatBreakdown, 'vat') : null)
  if (net === null || vat === null || gross === null) return { id: 'totalMath', status: 'skip' }
  const sum = round2(net + vat)
  return {
    id: 'totalMath',
    status: close(sum, gross) ? 'pass' : 'fail',
    expected: gross,
    actual: sum,
  }
}

function sumOf(rows: Extraction['vatBreakdown'], key: 'net' | 'vat'): number {
  return round2(rows.reduce((s, r) => s + r[key], 0))
}

function vatRates(e: Extraction): Check {
  const rates = [
    ...new Set([
      ...e.vatBreakdown.map((r) => r.rate),
      ...e.lineItems.flatMap((l) => (l.vatRate === null ? [] : [l.vatRate])),
    ]),
  ]
  if (rates.length === 0) return { id: 'vatRates', status: 'skip' }
  const german = isGermanVendor(e)
  const odd = rates.filter((r) => !GERMAN_VAT_RATES.includes(r))
  if (!german || odd.length === 0) return { id: 'vatRates', status: 'pass', rates }
  return { id: 'vatRates', status: 'warn', rates: odd }
}

function ibanCheck(e: Extraction): Check {
  const iban = e.payment.iban.value
  if (!iban) return { id: 'iban', status: 'skip' }
  return { id: 'iban', status: ibanValid(iban) ? 'pass' : 'fail' }
}

function vatIdCheck(e: Extraction): Check {
  const id = e.vendor.vatId.value?.replace(/\s/g, '').toUpperCase()
  if (!id) return { id: 'vatId', status: 'skip' }
  if (id.startsWith('DE')) return { id: 'vatId', status: germanVatIdValid(id) ? 'pass' : 'fail' }
  return { id: 'vatId', status: /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(id) ? 'pass' : 'fail' }
}

function dates(e: Extraction, today: Date): Check {
  const issue = parseDate(e.issueDate.value)
  if (!issue) return { id: 'dates', status: 'skip' }
  if (issue.getTime() > today.getTime()) return { id: 'dates', status: 'fail' }
  const due = parseDate(e.dueDate.value)
  if (due && due.getTime() < issue.getTime()) return { id: 'dates', status: 'fail' }
  return { id: 'dates', status: 'pass' }
}

/** §14 Abs. 4 UStG for invoices, the reduced list of §33 UStDV up to 250 euros. */
function mandatory(e: Extraction): Check {
  if (e.documentType !== 'invoice' && e.documentType !== 'receipt') {
    return { id: 'mandatory', status: 'skip' }
  }
  const gross = e.totals.gross.value
  const smallInvoice = gross !== null && gross <= SMALL_INVOICE_LIMIT
  const has = (v: unknown) => v !== null && v !== undefined && v !== ''
  const required: Array<[MandatoryField, boolean]> = smallInvoice
    ? [
        ['vendorName', has(e.vendor.name.value)],
        ['vendorAddress', has(e.vendor.address.value)],
        ['issueDate', has(e.issueDate.value)],
        ['lineItems', e.lineItems.length > 0],
        ['gross', has(gross)],
      ]
    : [
        ['vendorName', has(e.vendor.name.value)],
        ['vendorAddress', has(e.vendor.address.value)],
        ['recipientName', has(e.recipient.name.value)],
        ['recipientAddress', has(e.recipient.address.value)],
        ['taxId', has(e.vendor.vatId.value) || has(e.vendor.taxNumber.value)],
        ['invoiceNumber', has(e.invoiceNumber.value)],
        ['issueDate', has(e.issueDate.value)],
        ['serviceDate', has(e.serviceDate.value)],
        ['lineItems', e.lineItems.length > 0],
        ['vatBreakdown', e.vatBreakdown.length > 0 || e.reverseCharge],
      ]
  const missing = required.filter(([, ok]) => !ok).map(([field]) => field)
  // Till receipts rarely name the buyer, so only formal invoices fail on missing fields.
  const status: CheckStatus =
    missing.length === 0 ? 'pass' : e.documentType === 'invoice' ? 'fail' : 'warn'
  return { id: 'mandatory', status, missing, smallInvoice }
}

function reverseCharge(e: Extraction): Check {
  const vat = e.totals.vat.value ?? 0
  if (e.reverseCharge)
    return { id: 'reverseCharge', status: vat > 0 ? 'fail' : 'pass', actual: vat }
  const foreign = !isGermanVendor(e) && e.vendor.vatId.value !== null
  if (foreign && vat === 0) return { id: 'reverseCharge', status: 'warn' }
  return { id: 'reverseCharge', status: 'skip' }
}

function isGermanVendor(e: Extraction): boolean {
  const id = e.vendor.vatId.value?.toUpperCase()
  if (id) return id.startsWith('DE')
  return e.currency === 'EUR' && e.language === 'de'
}

function parseDate(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** ISO 13616 mod-97 check, with the German length enforced. */
export function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('DE') && iban.length !== 22) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rest = 0
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  }
  return rest === 1
}

/** German USt-IdNr: DE plus nine digits, the last one an ISO 7064 MOD 11,10 check digit. */
export function germanVatIdValid(raw: string): boolean {
  const id = raw.replace(/\s/g, '').toUpperCase()
  if (!/^DE[1-9]\d{8}$/.test(id)) return false
  const digits = id.slice(2).split('').map(Number)
  let product = 10
  for (const d of digits.slice(0, 8)) {
    let sum = (d + product) % 10
    if (sum === 0) sum = 10
    product = (2 * sum) % 11
  }
  const check = (11 - product) % 10
  return check === digits[8]
}

export type Verdict = 'ok' | 'review' | 'notice'

export function verdict(checks: Check[]): Verdict {
  if (checks.some((c) => c.status === 'fail')) return 'review'
  if (checks.some((c) => c.status === 'warn')) return 'notice'
  return 'ok'
}
