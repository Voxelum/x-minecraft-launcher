declare module 'regexpu-core' {
  export default function rewritePattern(
    pattern: string,
    flags: string,
    options: { unicodePropertyEscapes: 'transform' },
  ): string
}
