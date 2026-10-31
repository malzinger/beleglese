import type { Check, MandatoryField } from '../core/checks'
import type { FieldKey } from '../core/evaluate'

export type Lang = 'de' | 'en'

export function detectLang(): Lang {
  const param = new URLSearchParams(location.search).get('lang')
  if (param === 'de' || param === 'en') return param
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function money(n: number | null | undefined, currency: string, lang: Lang): string {
  if (n === null || n === undefined) return '–'
  return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'EUR',
  }).format(n)
}

export function num(n: number | null | undefined, lang: Lang): string {
  if (n === null || n === undefined) return '–'
  return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', {
    maximumFractionDigits: 3,
  }).format(n)
}

export function date(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '–'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-')
  return lang === 'de' ? `${d}.${m}.${y}` : `${d}/${m}/${y}`
}

const MANDATORY: Record<Lang, Record<MandatoryField, string>> = {
  de: {
    vendorName: 'Name Aussteller',
    vendorAddress: 'Anschrift Aussteller',
    recipientName: 'Name Empfänger',
    recipientAddress: 'Anschrift Empfänger',
    taxId: 'Steuernummer oder USt-IdNr.',
    invoiceNumber: 'Rechnungsnummer',
    issueDate: 'Ausstellungsdatum',
    serviceDate: 'Leistungsdatum',
    lineItems: 'Leistungsbeschreibung',
    vatBreakdown: 'Steuersatz und Steuerbetrag',
    gross: 'Bruttobetrag',
  },
  en: {
    vendorName: 'supplier name',
    vendorAddress: 'supplier address',
    recipientName: 'recipient name',
    recipientAddress: 'recipient address',
    taxId: 'tax number or VAT ID',
    invoiceNumber: 'invoice number',
    issueDate: 'issue date',
    serviceDate: 'date of supply',
    lineItems: 'description of goods or services',
    vatBreakdown: 'VAT rate and amount',
    gross: 'gross amount',
  },
}

const de = {
  claim: 'Belege rein, Buchungsdaten raus.',
  stack: 'Belegstapel',
  ownDoc: 'Eigener Beleg',
  source: 'Quellcode',
  tabs: { doc: 'Beleg', accuracy: 'Genauigkeit' },
  verdict: { ok: 'Geprüft', review: 'Prüfen', notice: 'Hinweis' },
  verdictLong: {
    ok: 'Alle Prüfungen bestanden.',
    review: 'Mindestens eine Prüfung schlägt fehl. Bitte ansehen, bevor gebucht wird.',
    notice: 'Plausibel, mit Hinweisen.',
  },
  stamp: {
    account: 'Konto',
    text: 'Bezeichnung',
    amount: 'Betrag',
    date: 'Belegdatum',
    vat: 'USt',
  },
  checksTitle: 'Prüfungen',
  checksNote: 'Claude liest, der Code rechnet nach.',
  skipped: 'nicht anwendbar',
  sections: {
    vendor: 'Aussteller',
    doc: 'Beleg',
    items: 'Positionen',
    totals: 'Summen',
    payment: 'Zahlung',
    booking: 'Kontierungsvorschlag (SKR03)',
  },
  f: {
    name: 'Name',
    address: 'Anschrift',
    vatId: 'USt-IdNr.',
    taxNumber: 'Steuernummer',
    recipient: 'Empfänger',
    type: 'Belegart',
    number: 'Nummer',
    issueDate: 'Datum',
    serviceDate: 'Leistung',
    dueDate: 'Fällig',
    net: 'Netto',
    vat: 'Umsatzsteuer',
    gross: 'Brutto',
    tip: 'Trinkgeld',
    iban: 'IBAN',
    bic: 'BIC',
    method: 'Zahlart',
    reverseCharge: 'Reverse Charge',
    amountsAre: { net: 'Positionen netto', gross: 'Positionen brutto' },
  },
  docTypes: {
    invoice: 'Rechnung',
    receipt: 'Quittung',
    credit_note: 'Gutschrift',
    other: 'Sonstiges',
  },
  itemCols: { desc: 'Bezeichnung', qty: 'Menge', price: 'Preis', rate: 'USt', amount: 'Betrag' },
  confidence: { medium: 'unsicher gelesen', low: 'geraten oder schwer lesbar' },
  showSources: 'Quellen zeigen',
  sourceLabel: 'gelesen aus',
  yes: 'ja',
  no: 'nein',
  run: (model: string, inTok: number, outTok: number, cost: string, sec: string) =>
    `${model} · ${inTok.toLocaleString('de-DE')} Tokens rein, ${outTok.toLocaleString('de-DE')} raus · ${cost} · ${sec} s`,
  recorded: (when: string) => `aufgezeichnet ${when}`,
  live: 'live',
  fallback: 'über Ersatzmodell beantwortet',
  noRun: 'Für diesen Beleg gibt es noch keinen aufgezeichneten Lauf.',
  readLive: 'Live auslesen',
  reading: 'Claude liest den Beleg',
  // Own document panel
  keyTitle: 'Mit eigenem API-Schlüssel',
  keyHelp:
    'Der Schlüssel bleibt in diesem Tab und geht nur direkt an api.anthropic.com. Ein Lauf kostet wenige Cent.',
  keyPlaceholder: 'sk-ant-…',
  dropTitle: 'Beleg hier ablegen',
  dropHelp: 'PDF, PNG, JPG oder WebP, bis 10 MB',
  choose: 'Datei wählen',
  extract: 'Auslesen',
  close: 'Schließen',
  needKey: 'Erst einen API-Schlüssel eintragen.',
  errors: {
    auth: 'Der API-Schlüssel wurde abgelehnt.',
    rate: 'Zu viele Anfragen. Bitte kurz warten.',
    refusal: 'Claude hat die Anfrage abgelehnt.',
    truncated: 'Die Antwort wurde abgeschnitten.',
    unparsed: 'Die Antwort ließ sich nicht lesen.',
    tooBig: 'Die Datei ist größer als 10 MB.',
    type: 'Dieses Dateiformat wird nicht unterstützt.',
    other: 'Das hat nicht geklappt:',
  },
  // Accuracy tab
  accTitle: 'Wie gut liest Claude?',
  accIntro:
    'Jeder Beispielbeleg hat Soll-Werte, die von Hand vom Dokument abgelesen wurden. Verglichen wird Feld für Feld: Beträge auf den Cent, Daten exakt, Namen und Nummern tolerant gegenüber Schreibweise.',
  accFields: 'Felder richtig',
  accDoc: 'Beleg',
  accScore: 'Treffer',
  accCost: 'Kosten',
  accTime: 'Dauer',
  accTotal: 'Gesamt',
  accMisses: 'Abweichungen',
  accPerfect: 'keine',
  accExpected: 'Soll',
  accActual: 'Gelesen',
  accEmpty:
    'Noch keine aufgezeichneten Läufe. Mit npm run record werden alle Beispiele einmal live ausgelesen.',
  accModel: (model: string, when: string) => `Modell ${model}, aufgezeichnet ${when}.`,
  fields: {
    vendorName: 'Aussteller',
    vendorVatId: 'USt-IdNr.',
    invoiceNumber: 'Belegnummer',
    issueDate: 'Datum',
    dueDate: 'Fälligkeit',
    currency: 'Währung',
    net: 'Netto',
    vat: 'Steuer',
    gross: 'Brutto',
    iban: 'IBAN',
    reverseCharge: 'Reverse Charge',
    vatRates: 'Steuersätze',
    line: 'Position',
  } satisfies Record<FieldKey, string>,
  checkTitles: {
    lineSum: 'Positionssumme',
    vatMath: 'Steuerberechnung',
    totalMath: 'Gesamtbetrag',
    vatRates: 'Steuersätze',
    iban: 'IBAN',
    vatId: 'USt-IdNr.',
    dates: 'Datum',
    mandatory: 'Pflichtangaben',
    reverseCharge: 'Reverse Charge',
  } satisfies Record<Check['id'], string>,
  check(c: Check, cur: string): string {
    const m = (n?: number) => money(n, cur, 'de')
    switch (c.id) {
      case 'lineSum':
        return c.status === 'pass'
          ? `Die Positionen ergeben ${m(c.actual)}.`
          : `Die Positionen ergeben ${m(c.actual)}, auf dem Beleg stehen ${m(c.expected)}.`
      case 'vatMath':
        return c.status === 'pass'
          ? 'Die Steuer passt zu jedem Satz.'
          : `${c.rates?.[0]} %: richtig wären ${m(c.expected)}, ausgewiesen sind ${m(c.actual)}.`
      case 'totalMath':
        return c.status === 'pass'
          ? 'Netto plus Steuer ergibt den Bruttobetrag.'
          : `Netto plus Steuer ergibt ${m(c.actual)}, brutto stehen ${m(c.expected)} da.`
      case 'vatRates':
        return c.status === 'pass'
          ? `Sätze ${c.rates?.join(' und ')} %.`
          : `${c.rates?.join(', ')} % gibt es in Deutschland nicht.`
      case 'iban':
        return c.status === 'pass'
          ? 'Prüfsumme stimmt.'
          : 'Prüfsumme stimmt nicht. Tippfehler auf dem Beleg oder falsch gelesen.'
      case 'vatId':
        return c.status === 'pass'
          ? 'Format und Prüfziffer stimmen.'
          : 'Format oder Prüfziffer stimmt nicht.'
      case 'dates':
        return c.status === 'pass'
          ? 'Datum plausibel.'
          : 'Datum in der Zukunft oder Fälligkeit vor dem Ausstellungsdatum.'
      case 'mandatory': {
        const rule = c.smallInvoice ? 'Kleinbetragsrechnung, § 33 UStDV' : '§ 14 Abs. 4 UStG'
        if (c.status === 'pass') return `Vollständig (${rule}).`
        const missing = (c.missing ?? []).map((f) => MANDATORY.de[f]).join(', ')
        return `Fehlt nach ${rule}: ${missing}.`
      }
      case 'reverseCharge':
        if (c.status === 'pass')
          return 'Steuerschuldnerschaft beim Empfänger, keine Steuer ausgewiesen.'
        if (c.status === 'fail')
          return `Reverse Charge vermerkt, aber ${m(c.actual)} Steuer ausgewiesen.`
        return 'Ausländischer Anbieter ohne Steuer, aber kein Reverse-Charge-Vermerk.'
    }
  },
}

export type Strings = typeof de

const en: Strings = {
  claim: 'Receipts in, booking data out.',
  stack: 'Document stack',
  ownDoc: 'Your own document',
  source: 'Source',
  tabs: { doc: 'Document', accuracy: 'Accuracy' },
  verdict: { ok: 'Checked', review: 'Review', notice: 'Note' },
  verdictLong: {
    ok: 'All checks passed.',
    review: 'At least one check fails. Look at it before booking.',
    notice: 'Plausible, with notes.',
  },
  stamp: { account: 'Account', text: 'Name', amount: 'Amount', date: 'Doc date', vat: 'VAT' },
  checksTitle: 'Checks',
  checksNote: 'Claude reads, the code does the maths.',
  skipped: 'not applicable',
  sections: {
    vendor: 'Supplier',
    doc: 'Document',
    items: 'Line items',
    totals: 'Totals',
    payment: 'Payment',
    booking: 'Suggested account (SKR03)',
  },
  f: {
    name: 'Name',
    address: 'Address',
    vatId: 'VAT ID',
    taxNumber: 'Tax number',
    recipient: 'Billed to',
    type: 'Type',
    number: 'Number',
    issueDate: 'Date',
    serviceDate: 'Supply',
    dueDate: 'Due',
    net: 'Net',
    vat: 'VAT',
    gross: 'Gross',
    tip: 'Tip',
    iban: 'IBAN',
    bic: 'BIC',
    method: 'Paid by',
    reverseCharge: 'Reverse charge',
    amountsAre: { net: 'Line items net', gross: 'Line items gross' },
  },
  docTypes: { invoice: 'Invoice', receipt: 'Receipt', credit_note: 'Credit note', other: 'Other' },
  itemCols: { desc: 'Description', qty: 'Qty', price: 'Price', rate: 'VAT', amount: 'Amount' },
  confidence: { medium: 'read with some doubt', low: 'guessed or hard to read' },
  showSources: 'Show sources',
  sourceLabel: 'read from',
  yes: 'yes',
  no: 'no',
  run: (model: string, inTok: number, outTok: number, cost: string, sec: string) =>
    `${model} · ${inTok.toLocaleString('en-GB')} tokens in, ${outTok.toLocaleString('en-GB')} out · ${cost} · ${sec} s`,
  recorded: (when: string) => `recorded ${when}`,
  live: 'live',
  fallback: 'answered by a fallback model',
  noRun: 'There is no recorded run for this document yet.',
  readLive: 'Read it live',
  reading: 'Claude is reading the document',
  keyTitle: 'With your own API key',
  keyHelp:
    'The key stays in this tab and goes straight to api.anthropic.com. A run costs a few cents.',
  keyPlaceholder: 'sk-ant-…',
  dropTitle: 'Drop a document here',
  dropHelp: 'PDF, PNG, JPG or WebP, up to 10 MB',
  choose: 'Choose file',
  extract: 'Read document',
  close: 'Close',
  needKey: 'Enter an API key first.',
  errors: {
    auth: 'The API key was rejected.',
    rate: 'Too many requests. Wait a moment.',
    refusal: 'Claude declined the request.',
    truncated: 'The answer was cut off.',
    unparsed: 'The answer could not be parsed.',
    tooBig: 'The file is larger than 10 MB.',
    type: 'This file type is not supported.',
    other: 'That did not work:',
  },
  accTitle: 'How well does Claude read?',
  accIntro:
    'Every sample has expected values, read off the document by hand. The comparison is field by field: amounts to the cent, dates exactly, names and numbers tolerant of spelling.',
  accFields: 'fields correct',
  accDoc: 'Document',
  accScore: 'Hits',
  accCost: 'Cost',
  accTime: 'Time',
  accTotal: 'Total',
  accMisses: 'Differences',
  accPerfect: 'none',
  accExpected: 'Expected',
  accActual: 'Read',
  accEmpty: 'No recorded runs yet. npm run record reads every sample once, live.',
  accModel: (model: string, when: string) => `Model ${model}, recorded ${when}.`,
  fields: {
    vendorName: 'Supplier',
    vendorVatId: 'VAT ID',
    invoiceNumber: 'Number',
    issueDate: 'Date',
    dueDate: 'Due date',
    currency: 'Currency',
    net: 'Net',
    vat: 'VAT',
    gross: 'Gross',
    iban: 'IBAN',
    reverseCharge: 'Reverse charge',
    vatRates: 'VAT rates',
    line: 'Line',
  },
  checkTitles: {
    lineSum: 'Line total',
    vatMath: 'VAT maths',
    totalMath: 'Grand total',
    vatRates: 'VAT rates',
    iban: 'IBAN',
    vatId: 'VAT ID',
    dates: 'Dates',
    mandatory: 'Required fields',
    reverseCharge: 'Reverse charge',
  },
  check(c: Check, cur: string): string {
    const m = (n?: number) => money(n, cur, 'en')
    switch (c.id) {
      case 'lineSum':
        return c.status === 'pass'
          ? `The lines add up to ${m(c.actual)}.`
          : `The lines add up to ${m(c.actual)}, the document says ${m(c.expected)}.`
      case 'vatMath':
        return c.status === 'pass'
          ? 'VAT matches every rate.'
          : `${c.rates?.[0]} %: should be ${m(c.expected)}, shows ${m(c.actual)}.`
      case 'totalMath':
        return c.status === 'pass'
          ? 'Net plus VAT gives the gross total.'
          : `Net plus VAT gives ${m(c.actual)}, the gross shows ${m(c.expected)}.`
      case 'vatRates':
        return c.status === 'pass'
          ? `Rates ${c.rates?.join(' and ')} %.`
          : `${c.rates?.join(', ')} % is not a German VAT rate.`
      case 'iban':
        return c.status === 'pass'
          ? 'Checksum is valid.'
          : 'Checksum is wrong. A typo on the document or a misread digit.'
      case 'vatId':
        return c.status === 'pass'
          ? 'Format and check digit are valid.'
          : 'Format or check digit is wrong.'
      case 'dates':
        return c.status === 'pass'
          ? 'Dates are plausible.'
          : 'Date in the future, or due before it was issued.'
      case 'mandatory': {
        const rule = c.smallInvoice ? 'small invoice, § 33 UStDV' : '§ 14(4) UStG'
        if (c.status === 'pass') return `Complete (${rule}).`
        const missing = (c.missing ?? []).map((f) => MANDATORY.en[f]).join(', ')
        return `Missing under ${rule}: ${missing}.`
      }
      case 'reverseCharge':
        if (c.status === 'pass') return 'Recipient owes the VAT, none charged.'
        if (c.status === 'fail') return `Reverse charge noted, but ${m(c.actual)} VAT charged.`
        return 'Foreign supplier without VAT, but no reverse charge note.'
    }
  },
}

export const STRINGS: Record<Lang, Strings> = { de, en }
