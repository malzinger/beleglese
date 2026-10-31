import { describe, expect, it } from 'vitest'
import { SAMPLES, type Truth } from '../samples'
import { germanVatIdValid, ibanValid, runChecks, verdict, type CheckId } from './checks'
import { score } from './evaluate'
import { Extraction } from './schema'

const TODAY = new Date('2026-10-31T12:00:00Z')

function s<T>(value: T | null) {
  return { value, source: value === null ? null : String(value), confidence: 'high' as const }
}

/** A faithful extraction of a sample, as a perfect reader would produce it. */
function fromTruth(t: Truth, overrides: Partial<Extraction> = {}): Extraction {
  const rate = t.vatRates[0] ?? 19
  const e: Extraction = {
    documentType: t.iban || t.reverseCharge ? 'invoice' : 'receipt',
    language: 'de',
    currency: t.currency,
    amountsAre:
      t.net !== undefined &&
      t.net !== null &&
      t.lineAmounts.reduce((a, b) => a + b, 0) < t.gross - 0.01
        ? 'net'
        : 'gross',
    vendor: {
      name: s(t.vendorName),
      address: s('Musterstraße 1, 12345 Musterstadt'),
      vatId: s(t.vendorVatId ?? null),
      taxNumber: s(null),
    },
    recipient: {
      name: s('Studio Nordlicht UG'),
      address: s('Karl-Heine-Straße 12, 04229 Leipzig'),
    },
    invoiceNumber: s(t.invoiceNumber ?? null),
    issueDate: s(t.issueDate),
    serviceDate: s(t.issueDate),
    dueDate: s(t.dueDate ?? null),
    lineItems: t.lineAmounts.map((amount, i) => ({
      description: `Position ${i + 1}`,
      quantity: 1,
      unitPrice: amount,
      vatRate: rate,
      amount,
      source: String(amount),
    })),
    vatBreakdown:
      t.net !== undefined && t.net !== null && t.vat !== undefined && t.vat !== null
        ? [{ rate, net: t.net, vat: t.vat }]
        : t.vatRates.map((r) => ({ rate: r, net: 0, vat: 0 })),
    totals: { net: s(t.net ?? null), vat: s(t.vat ?? null), gross: s(t.gross), tip: s(null) },
    payment: { iban: s(t.iban ?? null), bic: s(null), method: s('transfer') },
    reverseCharge: t.reverseCharge,
    booking: { account: '4930', accountName: 'Bürobedarf', reason: { de: 'Test', en: 'Test' } },
    ...overrides,
  }
  return Extraction.parse(e)
}

const sample = (id: string) => {
  const found = SAMPLES.find((x) => x.id === id)
  if (!found) throw new Error(id)
  return found
}
const statusOf = (e: Extraction, id: CheckId) =>
  runChecks(e, TODAY).find((c) => c.id === id)?.status

describe('checksums', () => {
  it('accepts valid IBANs and rejects a single wrong digit', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(ibanValid('DE02120300000000202051')).toBe(true)
    expect(ibanValid('DE89 3704 0044 0532 0130 01')).toBe(false)
    expect(ibanValid('DE8937040044053201300')).toBe(false)
  })

  it('verifies the German USt-IdNr check digit', () => {
    for (const id of ['DE284619375', 'DE315072641', 'DE268431758', 'DE351904285']) {
      expect(germanVatIdValid(id)).toBe(true)
    }
    expect(germanVatIdValid('DE284619376')).toBe(false)
    expect(germanVatIdValid('DE 284 619 375')).toBe(true)
    expect(germanVatIdValid('DE084619375')).toBe(false)
  })
})

describe('checks on the samples', () => {
  it('passes the clean invoice', () => {
    const e = fromTruth(sample('01-papierhaus').truth)
    expect(verdict(runChecks(e, TODAY))).toBe('ok')
  })

  it('catches the line items that do not add up to the printed net', () => {
    const e = fromTruth(sample('03-elektro').truth)
    const check = runChecks(e, TODAY).find((c) => c.id === 'lineSum')
    expect(check).toMatchObject({ status: 'fail', expected: 509.4, actual: 499.4 })
    expect(statusOf(e, 'totalMath')).toBe('pass')
    expect(verdict(runChecks(e, TODAY))).toBe('review')
  })

  it('accepts reverse charge without VAT and flags reverse charge with VAT', () => {
    const t = sample('04-fernhill').truth
    expect(statusOf(fromTruth(t), 'reverseCharge')).toBe('pass')
    const withVat = fromTruth(t, {
      totals: { net: s(303), vat: s(57.57), gross: s(360.57), tip: s(null) },
    })
    expect(statusOf(withVat, 'reverseCharge')).toBe('fail')
  })

  it('derives totals from the VAT table when a receipt prints no total net', () => {
    const t = sample('02-trattoria').truth
    const e = fromTruth(t, {
      vatBreakdown: [
        { rate: 7, net: 35.42, vat: 2.48 },
        { rate: 19, net: 12.94, vat: 2.46 },
      ],
    })
    expect(statusOf(e, 'totalMath')).toBe('pass')
    expect(statusOf(e, 'vatMath')).toBe('pass')
    expect(statusOf(e, 'lineSum')).toBe('pass')
  })

  it('tolerates the one-cent rounding on the fuel receipt', () => {
    expect(statusOf(fromTruth(sample('05-tankstelle').truth), 'vatMath')).toBe('pass')
  })

  it('lists missing § 14 fields on a large invoice', () => {
    const e = fromTruth(sample('01-papierhaus').truth, {
      invoiceNumber: s(null),
      recipient: { name: s(null), address: s(null) },
    })
    const check = runChecks(e, TODAY).find((c) => c.id === 'mandatory')
    expect(check?.status).toBe('fail')
    expect(check?.missing).toEqual(['recipientName', 'recipientAddress', 'invoiceNumber'])
  })

  it('rejects an issue date in the future and a due date before it', () => {
    const t = sample('01-papierhaus').truth
    expect(statusOf(fromTruth(t, { issueDate: s('2026-12-01') }), 'dates')).toBe('fail')
    expect(statusOf(fromTruth(t, { dueDate: s('2026-10-01') }), 'dates')).toBe('fail')
  })

  it('warns about a VAT rate that does not exist in Germany', () => {
    const e = fromTruth(sample('01-papierhaus').truth, {
      vatBreakdown: [{ rate: 16, net: 319.2, vat: 51.07 }],
    })
    expect(statusOf(e, 'vatRates')).toBe('warn')
  })
})

describe('score', () => {
  it.each(SAMPLES.map((x) => [x.id, x] as const))('%s: a faithful read scores 100 %%', (_, x) => {
    const rows = score(fromTruth(x.truth), x.truth)
    expect(rows.filter((r) => !r.ok)).toEqual([])
    expect(rows.length).toBeGreaterThan(8)
  })

  it('counts a misread amount and a missing line as misses', () => {
    const t = sample('01-papierhaus').truth
    const e = fromTruth(t)
    e.totals.gross.value = 379.58
    e.lineItems.pop()
    const misses = score(e, t).filter((r) => !r.ok)
    expect(misses.map((r) => r.field)).toEqual(['gross', 'line'])
    expect(misses[1]?.index).toBe(4)
  })

  it('matches names and invoice numbers loosely', () => {
    const t = sample('02-trattoria').truth
    const e = fromTruth(t, {
      vendor: { ...fromTruth(t).vendor, name: s('TRATTORIA SOLE, Köln') },
      invoiceNumber: s('Bon 0387'),
    })
    const rows = score(e, t)
    expect(rows.find((r) => r.field === 'vendorName')?.ok).toBe(true)
    expect(rows.find((r) => r.field === 'invoiceNumber')?.ok).toBe(true)
  })
})
