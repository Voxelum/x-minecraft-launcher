import { homedir } from 'os'

/**
 * Credential-shaped patterns scrubbed from every telemetry payload
 * before it leaves the machine.
 */
const CRED_PATTERNS = [
  /access_token[=:]\s*\S+/gi,
  /refresh_token[=:]\s*\S+/gi,
  /Authorization:\s*Bearer\s+\S+/gi,
  /client_secret[=:]\s*\S+/gi,
]

/**
 * Redact a telemetry payload text against an explicit home directory.
 * The user's home directory is replaced with `~` (both `\` and `/`
 * separators) and credential-shaped tokens are replaced with
 * `[redacted]`. Exported for unit tests.
 */
export function redactWithHome(text: string, home: string): string {
  if (!text) return text
  let out = text
  if (home && home !== '/' && home !== '\\') {
    const homeForward = home.split('\\').join('/')
    const homeBackslash = home.split('/').join('\\')
    out = out.split(home).join('~')
    if (homeForward !== home) out = out.split(homeForward).join('~')
    if (homeBackslash !== home) out = out.split(homeBackslash).join('~')
  }
  for (const pattern of CRED_PATTERNS) {
    out = out.replace(pattern, '[redacted]')
  }
  return out
}

/**
 * Redact an error stack trace before it is attached to telemetry:
 * replaces the user's home directory with `~` (Windows and POSIX forms)
 * and scrubs credential-shaped tokens.
 */
export function redactStack(stack: string): string {
  return redactWithHome(stack ?? '', homedir())
}

/**
 * Redact a free-form telemetry text (exception message, span status
 * message) with the same rules as {@link redactStack}.
 */
export function redactText(text: string | undefined): string | undefined {
  return text ? redactWithHome(text, homedir()) : text
}
