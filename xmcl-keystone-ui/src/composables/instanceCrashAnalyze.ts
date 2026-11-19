export type CrashCauseKind = 'oom' | 'javaVersion' | 'missingMod' | 'mixin' | 'graphics'

export interface CrashAnalysisResult {
  fileName: string
  causes: CrashCauseKind[]
  details: string[]
  needsMoreMemory: boolean
  suggestedJavaMajor?: number
}

interface CrashPatternRule {
  kind: CrashCauseKind
  pattern: RegExp
  extract?: (content: string, match: RegExpMatchArray) => string | undefined
}

const CLASS_VERSION_TO_JAVA: Record<number, number> = {
  52: 8,
  55: 11,
  60: 16,
  61: 17,
  65: 21,
  68: 24,
}

const CRASH_RULES: CrashPatternRule[] = [
  {
    kind: 'oom',
    pattern: /java\.lang\.OutOfMemoryError(?::\s*([^\r\n]+))?/i,
    extract: (_content, match) => match[1] ? `OutOfMemoryError: ${match[1].trim()}` : 'OutOfMemoryError',
  },
  {
    kind: 'javaVersion',
    pattern: /UnsupportedClassVersionError[^\r\n]*class file version\s+(\d+)/i,
    extract: (_content, match) => {
      const major = CLASS_VERSION_TO_JAVA[Number(match[1])]
      return major ? `Requires Java ${major} (class version ${match[1]})` : `UnsupportedClassVersionError (${match[1]})`
    },
  },
  {
    kind: 'missingMod',
    pattern: /(?:Missing or unsupported mandatory dependencies|ModResolutionException|Could not find required mod)[^\r\n]*/i,
    extract: (_content, match) => match[0].trim().slice(0, 96),
  },
  {
    kind: 'mixin',
    pattern: /(?:MixinTransformerError|MixinApplyError|InvalidMixinException)(?::\s*([^\r\n]+))?/i,
    extract: (_content, match) => (match[1] ? `Mixin: ${match[1].trim()}` : 'Mixin crash').slice(0, 96),
  },
  {
    kind: 'graphics',
    pattern: /(?:EXCEPTION_ACCESS_VIOLATION|GLFW error \d+|Pixel format not accelerated)/i,
    extract: (_content, match) => match[0].trim(),
  },
]

export function analyzeCrashReport(fileName: string, content: string): CrashAnalysisResult {
  const matched = CRASH_RULES
    .map(rule => ({ rule, match: content.match(rule.pattern) }))
    .filter((entry): entry is { rule: CrashPatternRule; match: RegExpMatchArray } => Boolean(entry.match))

  const causes = matched.map(entry => entry.rule.kind)
  const details = matched
    .map(entry => entry.rule.extract?.(content, entry.match) ?? entry.match[0].trim())
    .filter(Boolean)

  const javaMatch = matched.find(entry => entry.rule.kind === 'javaVersion')?.match
  const suggestedJavaMajor = javaMatch ? CLASS_VERSION_TO_JAVA[Number(javaMatch[1])] : undefined

  return {
    fileName,
    causes,
    details,
    needsMoreMemory: causes.includes('oom'),
    suggestedJavaMajor,
  }
}
