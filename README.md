# Beleglese

Receipts and invoices in, checked booking data out. Claude reads the document; ordinary code then checks what it read.

## How it works

1. **Read.** The document goes to Claude (Opus 5.5) as a PDF or image. A Zod schema enforced through structured outputs fixes the shape of the answer: supplier, VAT ID, dates, line items, VAT table, totals, IBAN, reverse charge and a suggested SKR03 account. Every field carries the verbatim text it was read from and a confidence level. The prompt asks Claude to transcribe, not to correct, so a mistake on the document stays visible.
2. **Check.** Deterministic TypeScript verifies the result: line items against the printed total, VAT per rate, net plus VAT against gross, German VAT rates, the IBAN mod-97 checksum, the USt-IdNr check digit, date logic, the mandatory fields of § 14 UStG (or § 33 UStDV for invoices up to 250 euros) and reverse charge. The result is stamped onto the document: a verdict and a Kontierungsstempel with the suggested account.
3. **Measure.** Five fictional sample documents come with hand-checked expected values. The accuracy tab scores every field of every recorded run against them, along with cost and latency.

The samples cover a clean invoice, a restaurant receipt with two VAT rates and a tip, a tradesman's invoice whose lines do not add up to its printed total, an English SaaS invoice under reverse charge, and a fuel receipt photographed at an angle. All companies, numbers and people in them are made up.

## Running it

```bash
npm install
npm run dev
```

Visitors see recorded runs and can read their own documents with their own API key. The key stays in the browser tab and is sent only to api.anthropic.com.

To record fresh runs of the samples (a few cents, needs `ANTHROPIC_API_KEY`):

```bash
npm run record
```

`npm run samples` re-renders the sample documents from `scripts/samples` with a local Edge or Chrome. `npm test` runs the Vitest suite for the checks and the scoring.

## Stack

React 19, TypeScript (strict), Vite, Vitest, the Anthropic TypeScript SDK with structured outputs and server-side refusal fallbacks, IBM Plex served locally.

## License

MIT © Friedrich Malz
