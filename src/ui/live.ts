import Anthropic from '@anthropic-ai/sdk'
import { extract, ExtractionError, type ExtractionRun, type MediaType } from '../core/extract'

export type LiveErrorKey =
  'auth' | 'rate' | 'refusal' | 'truncated' | 'unparsed' | 'tooBig' | 'type' | 'needKey' | 'other'

export interface LiveError {
  key: LiveErrorKey
  detail?: string
}

export async function fileToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Calls the API straight from the browser with the visitor's own key. There is no
 * backend in between, so the key never touches anything but api.anthropic.com.
 */
export async function readLive(
  apiKey: string,
  blob: Blob,
  mediaType: MediaType,
): Promise<ExtractionRun> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  return extract(client, { mediaType, data: await fileToBase64(blob) })
}

export function classifyError(err: unknown): LiveError {
  if (err instanceof Anthropic.AuthenticationError) return { key: 'auth' }
  if (err instanceof Anthropic.PermissionDeniedError) return { key: 'auth' }
  if (err instanceof Anthropic.RateLimitError) return { key: 'rate' }
  if (err instanceof ExtractionError) return { key: err.reason }
  if (err instanceof Anthropic.APIError)
    return { key: 'other', detail: `${err.status ?? ''} ${err.message}`.trim() }
  return { key: 'other', detail: err instanceof Error ? err.message : String(err) }
}
