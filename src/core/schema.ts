import { z } from 'zod'

const confidence = z
  .enum(['high', 'medium', 'low'])
  .describe(
    'high: printed and clearly legible. medium: legible but ambiguous. low: guessed, smudged or inferred.',
  )

const source = z
  .string()
  .nullable()
  .describe(
    'The exact text on the document this value was read from, copied verbatim. null if not printed.',
  )

function sourced<T extends z.ZodType>(value: T, description: string) {
  return z.object({ value: value.nullable().describe(description), source, confidence })
}

const money = z.number().describe('Amount as a plain number with dot decimals, e.g. 1234.5')
const date = z.string().describe('ISO date YYYY-MM-DD')

export const Extraction = z.object({
  documentType: z
    .enum(['invoice', 'receipt', 'credit_note', 'other'])
    .describe('invoice: a formal Rechnung. receipt: till receipt, fuel receipt, restaurant bill.'),
  language: z.string().describe('ISO 639-1 code of the document language'),
  currency: z.string().describe('ISO 4217 code, e.g. EUR'),
  amountsAre: z
    .enum(['net', 'gross'])
    .describe('Whether the line item amounts on the document are net (before VAT) or gross.'),
  vendor: z.object({
    name: sourced(z.string(), 'Issuing company or shop'),
    address: sourced(z.string(), 'Full postal address on one line, comma separated'),
    vatId: sourced(z.string(), 'VAT ID (USt-IdNr.) without spaces, e.g. DE123456789'),
    taxNumber: sourced(z.string(), 'Tax number (Steuernummer) as printed'),
  }),
  recipient: z.object({
    name: sourced(z.string(), 'Billed company or person'),
    address: sourced(z.string(), 'Full postal address on one line, comma separated'),
  }),
  invoiceNumber: sourced(z.string(), 'Invoice or receipt number'),
  issueDate: sourced(date, 'Date the document was issued'),
  serviceDate: sourced(
    z.string(),
    'Delivery or service date or period as printed (Leistungsdatum)',
  ),
  dueDate: sourced(date, 'Payment due date. Only if printed or stated as a fixed date.'),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().nullable(),
        unitPrice: money.nullable(),
        vatRate: z.number().nullable().describe('VAT rate in percent, e.g. 19'),
        amount: money.describe('Line amount as printed, net or gross per amountsAre'),
        source: z.string().describe('The printed line, verbatim'),
      }),
    )
    .describe('Every line item in printed order. Do not merge or split lines.'),
  vatBreakdown: z
    .array(
      z.object({
        rate: z.number().describe('VAT rate in percent'),
        net: money,
        vat: money,
      }),
    )
    .describe('One row per VAT rate as printed in the totals block. Empty if no VAT is shown.'),
  totals: z.object({
    net: sourced(money, 'Total net amount'),
    vat: sourced(money, 'Total VAT amount'),
    gross: sourced(money, 'Total amount payable before any tip'),
    tip: sourced(money, 'Tip or Trinkgeld, if printed'),
  }),
  payment: z.object({
    iban: sourced(z.string(), 'IBAN without spaces'),
    bic: sourced(z.string(), 'BIC'),
    method: sourced(z.string(), 'How it was or should be paid, e.g. transfer, card, cash'),
  }),
  reverseCharge: z
    .boolean()
    .describe('True if the document states that the recipient owes the VAT (reverse charge).'),
  booking: z.object({
    account: z.string().describe('Suggested SKR03 expense account number, e.g. 4930'),
    accountName: z.string().describe('German name of that SKR03 account'),
    reason: z.object({
      de: z.string().describe('One short German sentence explaining the choice'),
      en: z.string().describe('The same sentence in English'),
    }),
  }),
})

export type Extraction = z.infer<typeof Extraction>
export type Sourced<T> = {
  value: T | null
  source: string | null
  confidence: 'high' | 'medium' | 'low'
}

/*
 * What is actually sent to the API. Structured outputs compile the schema into a grammar
 * with limits on its size and on nullable fields, so the request uses a flat shape: plain
 * fields with empty strings for anything not printed, nullable numbers only for amounts,
 * and one evidence list with the verbatim source and confidence per field. fromWire()
 * rebuilds the Extraction shape the rest of the app uses.
 */

const TEXT_FIELDS = [
  'vendorName',
  'vendorAddress',
  'vendorVatId',
  'vendorTaxNumber',
  'recipientName',
  'recipientAddress',
  'invoiceNumber',
  'issueDate',
  'serviceDate',
  'dueDate',
  'iban',
  'bic',
  'paymentMethod',
] as const
const MONEY_FIELDS = ['net', 'vat', 'gross', 'tip'] as const
const EVIDENCE_FIELDS = [...TEXT_FIELDS, ...MONEY_FIELDS] as const

const blank = (what: string) => z.string().describe(`${what}. Empty string if not printed.`)
const maybeMoney = (what: string) => money.nullable().describe(`${what}. null if not printed.`)

export const WireExtraction = z.object({
  documentType: Extraction.shape.documentType,
  language: Extraction.shape.language,
  currency: Extraction.shape.currency,
  amountsAre: Extraction.shape.amountsAre,
  vendorName: blank('Issuing company or shop'),
  vendorAddress: blank('Full postal address on one line, comma separated'),
  vendorVatId: blank('VAT ID (USt-IdNr.) without spaces, e.g. DE123456789'),
  vendorTaxNumber: blank('Tax number (Steuernummer) as printed'),
  recipientName: blank('Billed company or person'),
  recipientAddress: blank('Full postal address on one line, comma separated'),
  invoiceNumber: blank('Invoice or receipt number'),
  issueDate: blank('Date the document was issued, ISO YYYY-MM-DD'),
  serviceDate: blank('Delivery or service date or period as printed (Leistungsdatum)'),
  dueDate: blank('Payment due date, ISO YYYY-MM-DD, only if printed or stated as a fixed date'),
  iban: blank('IBAN without spaces'),
  bic: blank('BIC'),
  paymentMethod: blank('How it was or should be paid, e.g. transfer, card, cash'),
  net: maybeMoney('Total net amount'),
  vat: maybeMoney('Total VAT amount'),
  gross: maybeMoney('Total amount payable before any tip'),
  tip: maybeMoney('Tip or Trinkgeld'),
  lineItems: Extraction.shape.lineItems,
  vatBreakdown: Extraction.shape.vatBreakdown,
  reverseCharge: Extraction.shape.reverseCharge,
  bookingAccount: z.string().describe('Suggested SKR03 expense account number, e.g. 4930'),
  bookingAccountName: z.string().describe('German name of that SKR03 account'),
  bookingReasonDe: z.string().describe('One short German sentence explaining the account choice'),
  bookingReasonEn: z.string().describe('The same sentence in English'),
  evidence: z
    .array(
      z.object({
        field: z.enum(EVIDENCE_FIELDS),
        text: z.string().describe('The exact printed text the value was read from, verbatim'),
        confidence,
      }),
    )
    .describe('One entry for every field above that has a value.'),
})

export type WireExtraction = z.infer<typeof WireExtraction>

export function fromWire(w: WireExtraction): Extraction {
  const evidence = new Map(w.evidence.map((e) => [e.field, e]))
  const meta = (field: (typeof EVIDENCE_FIELDS)[number]) => {
    const e = evidence.get(field)
    return {
      source: e && e.text.trim() !== '' ? e.text : null,
      confidence: e?.confidence ?? ('high' as const),
    }
  }
  const text = (field: (typeof TEXT_FIELDS)[number]): Sourced<string> => {
    const v = w[field].trim()
    return { value: v === '' ? null : v, ...meta(field) }
  }
  const amount = (field: (typeof MONEY_FIELDS)[number]): Sourced<number> => ({
    value: w[field],
    ...meta(field),
  })

  return {
    documentType: w.documentType,
    language: w.language,
    currency: w.currency,
    amountsAre: w.amountsAre,
    vendor: {
      name: text('vendorName'),
      address: text('vendorAddress'),
      vatId: text('vendorVatId'),
      taxNumber: text('vendorTaxNumber'),
    },
    recipient: { name: text('recipientName'), address: text('recipientAddress') },
    invoiceNumber: text('invoiceNumber'),
    issueDate: text('issueDate'),
    serviceDate: text('serviceDate'),
    dueDate: text('dueDate'),
    lineItems: w.lineItems,
    vatBreakdown: w.vatBreakdown,
    totals: { net: amount('net'), vat: amount('vat'), gross: amount('gross'), tip: amount('tip') },
    payment: { iban: text('iban'), bic: text('bic'), method: text('paymentMethod') },
    reverseCharge: w.reverseCharge,
    booking: {
      account: w.bookingAccount,
      accountName: w.bookingAccountName,
      reason: { de: w.bookingReasonDe, en: w.bookingReasonEn },
    },
  }
}
