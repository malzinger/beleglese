import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { Extraction } from './schema'

export const MODEL = 'claude-opus-5-5'
/** USD per million tokens for MODEL, used to show what a run cost. */
const PRICE = { input: 4, output: 20, cacheRead: 0.2 }

export type MediaType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'

export interface DocumentInput {
  mediaType: MediaType
  /** Base64 without a data: prefix. */
  data: string
}

export interface ExtractionRun {
  model: string
  extraction: Extraction
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  fallbackUsed: boolean
  recordedAt: string
}

export class ExtractionError extends Error {
  constructor(readonly reason: 'refusal' | 'truncated' | 'unparsed') {
    super(`Extraction failed: ${reason}`)
  }
}

const SYSTEM = `You read German and international receipts and invoices for bookkeeping.

Transcribe what is printed. Do not compute, complete or correct values: if a total is not printed, return null, and if the printed numbers do not add up, return them as printed anyway. A separate program checks the arithmetic, and it can only catch mistakes on the document if you report the document faithfully.

For every sourced field, copy the exact printed text into source. Use confidence low when the text is hard to read or the value is inferred rather than printed.

Normalise numbers to plain decimals (1.234,50 becomes 1234.5) and dates to YYYY-MM-DD.

Suggest the one SKR03 expense account a German bookkeeper would most likely post this document to.`

export async function extract(client: Anthropic, doc: DocumentInput): Promise<ExtractionRun> {
  const file =
    doc.mediaType === 'application/pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: doc.mediaType, data: doc.data },
        } as const)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: doc.mediaType, data: doc.data },
        } as const)

  const started = performance.now()
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'medium', format: betaZodOutputFormat(Extraction) },
    messages: [
      {
        role: 'user',
        content: [file, { type: 'text', text: 'Extract this document.' }],
      },
    ],
  })
  const latencyMs = Math.round(performance.now() - started)

  if (response.stop_reason === 'refusal') throw new ExtractionError('refusal')
  if (response.stop_reason === 'max_tokens') throw new ExtractionError('truncated')
  const extraction = response.parsed_output
  if (!extraction) throw new ExtractionError('unparsed')

  const { usage } = response
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const inputTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0)
  const costUsd =
    (inputTokens * PRICE.input + cacheRead * PRICE.cacheRead + usage.output_tokens * PRICE.output) /
    1_000_000

  return {
    model: response.model,
    extraction,
    inputTokens: inputTokens + cacheRead,
    outputTokens: usage.output_tokens,
    costUsd,
    latencyMs,
    fallbackUsed: (usage.iterations ?? []).some((entry) => entry.type === 'fallback_message'),
    recordedAt: new Date().toISOString(),
  }
}
