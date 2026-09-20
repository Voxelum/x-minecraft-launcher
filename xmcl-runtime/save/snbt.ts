/**
 * Parse Stringified NBT (SNBT) format used by Minecraft and mods such as FTB Quests.
 */
export function parseSnbt(input: string): any {
  let pos = 0
  const len = input.length

  function skipWhitespaceAndComments() {
    while (pos < len) {
      const ch = input[pos]
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === ',') {
        pos++
        continue
      }
      if (ch === '#' || (ch === '/' && input[pos + 1] === '/')) {
        while (pos < len && input[pos] !== '\n') {
          pos++
        }
        continue
      }
      if (ch === '/' && input[pos + 1] === '*') {
        pos += 2
        while (pos < len && !(input[pos] === '*' && input[pos + 1] === '/')) {
          pos++
        }
        pos += 2
        continue
      }
      break
    }
  }

  function parseString(): string {
    const quote = input[pos]
    pos++ // skip quote
    let res = ''
    while (pos < len) {
      const ch = input[pos]
      if (ch === '\\') {
        pos++
        if (pos < len) {
          const esc = input[pos]
          if (esc === 'n') res += '\n'
          else if (esc === 't') res += '\t'
          else if (esc === 'r') res += '\r'
          else res += esc
          pos++
        }
      } else if (ch === quote) {
        pos++
        break
      } else {
        res += ch
        pos++
      }
    }
    return res
  }

  function parseUnquoted(): string {
    const start = pos
    while (pos < len) {
      const ch = input[pos]
      if (
        ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' ||
        ch === ',' || ch === ':' || ch === '{' || ch === '}' ||
        ch === '[' || ch === ']' || ch === '#' || ch === '/'
      ) {
        break
      }
      pos++
    }
    return input.substring(start, pos)
  }

  function parseValue(): any {
    skipWhitespaceAndComments()
    if (pos >= len) return undefined

    const ch = input[pos]
    if (ch === '{') {
      return parseCompound()
    }
    if (ch === '[') {
      return parseList()
    }
    if (ch === '"' || ch === "'") {
      return parseString()
    }

    const token = parseUnquoted()
    if (token === 'true') return true
    if (token === 'false') return false
    if (token === 'null') return null

    // Check if number with optional type suffix (b, s, l, f, d, B, S, L, F, D)
    const numMatch = /^([+-]?(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?))[bslfdBSLFD]?$/.exec(token)
    if (numMatch) {
      const numStr = numMatch[1]
      if (numStr.startsWith('0x') || numStr.startsWith('-0x') || numStr.startsWith('+0x')) {
        const hexVal = parseInt(numStr, 16)
        if (!Number.isNaN(hexVal)) return hexVal
      }
      const num = Number(numStr)
      if (!Number.isNaN(num)) {
        return num
      }
    }

    return token
  }

  function parseCompound(): Record<string, any> {
    pos++ // skip '{'
    const obj: Record<string, any> = {}

    while (pos < len) {
      skipWhitespaceAndComments()
      if (pos >= len || input[pos] === '}') {
        if (pos < len) pos++ // skip '}'
        break
      }

      let key: string
      const ch = input[pos]
      if (ch === '"' || ch === "'") {
        key = parseString()
      } else {
        key = parseUnquoted()
      }

      skipWhitespaceAndComments()
      if (pos < len && input[pos] === ':') {
        pos++ // skip ':'
      }

      const val = parseValue()
      obj[key] = val
    }

    return obj
  }

  function parseList(): any[] {
    pos++ // skip '['
    skipWhitespaceAndComments()

    // Check array type prefixes like [B;, [I;, [L;
    if (pos + 1 < len && (input[pos] === 'B' || input[pos] === 'I' || input[pos] === 'L') && input[pos + 1] === ';') {
      pos += 2 // skip 'B;' or 'I;' or 'L;'
    }

    const list: any[] = []
    while (pos < len) {
      skipWhitespaceAndComments()
      if (pos >= len || input[pos] === ']') {
        if (pos < len) pos++ // skip ']'
        break
      }
      const val = parseValue()
      list.push(val)
    }

    return list
  }

  skipWhitespaceAndComments()
  return parseValue()
}
