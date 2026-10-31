import type { MediaType } from '../core/extract'

/** What a careful human reads off the document. Fields left out are not scored. */
export interface Truth {
  vendorName: string
  vendorVatId?: string | null
  invoiceNumber?: string | null
  issueDate: string
  dueDate?: string | null
  currency: string
  net?: number | null
  vat?: number | null
  gross: number
  iban?: string | null
  reverseCharge: boolean
  lineAmounts: number[]
  vatRates: number[]
}

export interface Sample {
  id: string
  /** Preview image under public/. */
  image: string
  /** File sent to Claude by the recorder: the PDF for formal invoices, else the image. */
  input: string
  mediaType: MediaType
  title: { de: string; en: string }
  kind: { de: string; en: string }
  /** What this document is meant to show. */
  point: { de: string; en: string }
  truth: Truth
}

export const SAMPLES: Sample[] = [
  {
    id: '01-papierhaus',
    image: 'samples/01-papierhaus.png',
    input: 'samples/01-papierhaus.pdf',
    mediaType: 'application/pdf',
    title: { de: 'Papierhaus Lindner', en: 'Papierhaus Lindner' },
    kind: { de: 'Rechnung, PDF', en: 'Invoice, PDF' },
    point: {
      de: 'Saubere Rechnung über 250 €: alle Pflichtangaben nach § 14 UStG müssen da sein.',
      en: 'A clean invoice over €250: every field § 14 UStG requires has to be present.',
    },
    truth: {
      vendorName: 'Papierhaus Lindner GmbH',
      vendorVatId: 'DE284619375',
      invoiceNumber: 'RE-2026-0412',
      issueDate: '2026-10-08',
      dueDate: '2026-10-22',
      currency: 'EUR',
      net: 319.2,
      vat: 60.65,
      gross: 379.85,
      iban: 'DE89370400440532013000',
      reverseCharge: false,
      lineAmounts: [24.5, 77.8, 27.9, 189],
      vatRates: [19],
    },
  },
  {
    id: '02-trattoria',
    image: 'samples/02-trattoria.png',
    input: 'samples/02-trattoria.png',
    mediaType: 'image/png',
    title: { de: 'Trattoria Sole', en: 'Trattoria Sole' },
    kind: { de: 'Bewirtungsbeleg, Kassenbon', en: 'Restaurant receipt' },
    point: {
      de: 'Zwei Steuersätze auf einem Bon, Bruttopreise und Trinkgeld, das nicht in die Summe gehört.',
      en: 'Two VAT rates on one receipt, gross prices and a tip that does not belong in the total.',
    },
    truth: {
      vendorName: 'Trattoria Sole',
      vendorVatId: null,
      invoiceNumber: '0387',
      issueDate: '2026-10-17',
      dueDate: null,
      currency: 'EUR',
      gross: 53.3,
      iban: null,
      reverseCharge: false,
      lineAmounts: [19, 18.9, 12.8, 2.6],
      vatRates: [7, 19],
    },
  },
  {
    id: '03-elektro',
    image: 'samples/03-elektro.png',
    input: 'samples/03-elektro.pdf',
    mediaType: 'application/pdf',
    title: { de: 'Elektro Brandt', en: 'Elektro Brandt' },
    kind: { de: 'Handwerkerrechnung, PDF', en: 'Tradesman invoice, PDF' },
    point: {
      de: 'Die Positionen ergeben 499,40 €, die Rechnung sagt 509,40 €. Der Fehler steht auf dem Beleg.',
      en: 'The lines add up to €499.40, the invoice says €509.40. The mistake is on the document.',
    },
    truth: {
      vendorName: 'Elektro Brandt e.K.',
      vendorVatId: 'DE315072641',
      invoiceNumber: '2026-1187',
      issueDate: '2026-10-30',
      dueDate: '2026-11-13',
      currency: 'EUR',
      net: 509.4,
      vat: 96.79,
      gross: 606.19,
      iban: 'DE02120300000000202051',
      reverseCharge: false,
      lineAmounts: [238, 182, 44.4, 35],
      vatRates: [19],
    },
  },
  {
    id: '04-fernhill',
    image: 'samples/04-fernhill.png',
    input: 'samples/04-fernhill.pdf',
    mediaType: 'application/pdf',
    title: { de: 'Fernhill Cloud', en: 'Fernhill Cloud' },
    kind: { de: 'SaaS-Rechnung, Englisch', en: 'SaaS invoice, English' },
    point: {
      de: 'Ausländischer Anbieter ohne Umsatzsteuer: Reverse Charge, die Steuer schuldet der Empfänger.',
      en: 'A foreign supplier without VAT: reverse charge, the recipient owes the tax.',
    },
    truth: {
      vendorName: 'Fernhill Cloud Software Ltd',
      vendorVatId: 'IE4815162LH',
      invoiceNumber: 'FH-2026-10-0931',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      currency: 'EUR',
      net: 303,
      vat: 0,
      gross: 303,
      iban: null,
      reverseCharge: true,
      lineAmounts: [288, 15],
      vatRates: [0],
    },
  },
  {
    id: '05-tankstelle',
    image: 'samples/05-tankstelle.png',
    input: 'samples/05-tankstelle.png',
    mediaType: 'image/png',
    title: { de: 'Autohof Grünewald', en: 'Autohof Grünewald' },
    kind: { de: 'Tankquittung, Handyfoto', en: 'Fuel receipt, phone photo' },
    point: {
      de: 'Schräg fotografiert, leicht unscharf, mit Knick. So kommen echte Belege an.',
      en: 'Shot at an angle, slightly blurred, with a crease. This is how real receipts arrive.',
    },
    truth: {
      vendorName: 'Autohof Grünewald',
      vendorVatId: 'DE268431758',
      invoiceNumber: '58213',
      issueDate: '2026-10-24',
      dueDate: null,
      currency: 'EUR',
      net: 67.61,
      vat: 12.84,
      gross: 80.45,
      iban: null,
      reverseCharge: false,
      lineAmounts: [75.46, 4.99],
      vatRates: [19],
    },
  },
]
