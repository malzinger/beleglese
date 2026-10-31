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
