/**
 * Renders the fictional sample documents in scripts/samples to public/samples:
 * a PNG preview for every document, plus a PDF for the formal invoices, which is
 * what the recorder sends to Claude. Uses a locally installed Edge or Chrome.
 *   npm run samples
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean)
const browser = candidates.find((p) => existsSync(p))
if (!browser) {
  console.error('No Chromium-based browser found. Set BROWSER_PATH.')
  process.exit(1)
}

const SAMPLES = [
  { id: '01-papierhaus', size: '794,1123', pdf: true },
  { id: '02-trattoria', size: '384,606', pdf: false },
  { id: '03-elektro', size: '794,1123', pdf: true },
  { id: '04-fernhill', size: '794,1123', pdf: true },
  { id: '05-tankstelle', size: '640,860', pdf: false },
]

const out = resolve('public/samples')
mkdirSync(out, { recursive: true })
const profile = join(tmpdir(), 'beleglese-render')

for (const s of SAMPLES) {
  const url = pathToFileURL(resolve('scripts/samples', `${s.id}.html`)).href
  const common = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
  ]
  execFileSync(browser, [
    ...common,
    `--window-size=${s.size}`,
    '--force-device-scale-factor=1.5',
    `--screenshot=${join(out, `${s.id}.png`)}`,
    url,
  ])
  if (s.pdf) {
    execFileSync(browser, [
      ...common,
      '--no-pdf-header-footer',
      `--print-to-pdf=${join(out, `${s.id}.pdf`)}`,
      url,
    ])
  }
  console.log(`rendered ${s.id}`)
}
