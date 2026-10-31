/**
 * Runs the real extraction on every sample document and stores the results, so visitors
 * see genuine Claude output without needing an API key. Needs ANTHROPIC_API_KEY (or an
 * `ant auth login` profile) and costs a few cents.
 *   npm run record            all samples
 *   npm run record 03-elektro one sample
 */
import Anthropic from '@anthropic-ai/sdk'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extract, type ExtractionRun } from '../src/core/extract'
import { score } from '../src/core/evaluate'
import { SAMPLES } from '../src/samples'

const OUT = 'src/samples/runs.json'
const only = process.argv[2]
const runs: Record<string, ExtractionRun> = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : {}

const client = new Anthropic()

for (const sample of SAMPLES) {
  if (only && sample.id !== only) continue
  const data = readFileSync(`public/${sample.input}`).toString('base64')
  const run = await extract(client, { mediaType: sample.mediaType, data })
  runs[sample.id] = run
  const rows = score(run.extraction, sample.truth)
  const misses = rows.filter((r) => !r.ok)
  console.log(
    `${sample.id}: ${rows.length - misses.length}/${rows.length} fields, ` +
      `${run.inputTokens} in / ${run.outputTokens} out, $${run.costUsd.toFixed(4)}, ${run.latencyMs} ms`,
  )
  for (const m of misses)
    console.log(`  miss ${m.field}${m.index ?? ''}: want ${m.expected}, got ${m.actual}`)
  writeFileSync(OUT, `${JSON.stringify(runs, null, 2)}\n`)
}
