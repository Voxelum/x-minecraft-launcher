/**
 * Represent the forge config file
 */
export interface ForgeConfig {
  [category: string]: {
    comment?: string
    properties: Array<ForgeConfig.Property<any>>
  }
}

export class CorruptedForgeConfigError extends Error {
  name = 'CorruptedForgeConfigError'

  constructor(
    readonly reason: string,
    readonly line: string,
  ) {
    super(`CorruptedForgeConfigError by ${reason}: ${line}`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ForgeConfig {
  export type Type = 'I' | 'D' | 'S' | 'B'
  export interface Property<T = number | boolean | string | number[] | boolean[] | string[]> {
    readonly type: Type
    readonly name: string
    readonly comment?: string
    value: T
  }

  /**
   * Convert a forge config to string
   */
  export function stringify(config: ForgeConfig) {
    let content = '# Configuration file\n\n\n'
    const propIndent = '    '
    const arrIndent = '        '
    Object.keys(config).forEach((cat) => {
      content += `${cat} {\n\n`
      config[cat].properties.forEach((prop) => {
        if (prop.comment) {
          const lines = prop.comment.split('\n')
          for (const l of lines) {
            content += `${propIndent}# ${l}\n`
          }
        }
        if (prop.value instanceof Array) {
          content += `${propIndent}${prop.type}:${prop.name} <\n`
          prop.value.forEach((v) => {
            content += `${arrIndent}${v}\n`
          })
          content += `${propIndent}>\n`
        } else {
          content += `${propIndent}${prop.type}:${prop.name}=${prop.value}\n`
        }
        content += '\n'
      })
      content += '}\n\n'
    })
    return content
  }

  /**
   * Parse a forge config string into `Config` object
   * @param body The forge config string
   */
  export function parse(body: string): ForgeConfig {
    const lines = body
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length !== 0)
    let category: string | undefined
    let pendingCategory: string | undefined

    const parseVal = (type: Type, value: any) => {
      const map: { [key: string]: (s: string) => any } = {
        I: Number.parseInt,
        D: Number.parseFloat,
        S: (s: string) => s,
        B: (s: string) => s === 'true',
      }
      const handler = map[type]
      return handler(value)
    }
    const config: ForgeConfig = {}
    let inlist = false
    let comment: string | undefined
    let last: any

    const readProp = (type: Type, line: string) => {
      line = line.substring(line.indexOf(':') + 1, line.length)
      const pair = line.split('=')
      if (pair.length === 0 || pair.length === 1) {
        let value
        let name
        if (line.endsWith(' <')) {
          value = []
          name = line.substring(0, line.length - 2)
          inlist = true
        }
        if (!category) {
          throw new CorruptedForgeConfigError('MissingCategory', line)
        }
        config[category].properties.push((last = { name, type, value, comment } as Property))
      } else {
        inlist = false
        if (!category) {
          throw new CorruptedForgeConfigError('MissingCategory', line)
        }
        config[category].properties.push({
          name: pair[0],
          value: parseVal(type, pair[1]),
          type,
          comment,
        } as Property)
      }
      comment = undefined
    }
    for (const line of lines) {
      if (inlist) {
        if (!last) {
          throw new CorruptedForgeConfigError('CorruptedList', line)
        }
        if (line === '>') {
          inlist = false
        } else if (line.endsWith(' >')) {
          last.value.push(parseVal(last.type, line.substring(0, line.length - 2)))
          inlist = false
        } else {
          last.value.push(parseVal(last.type, line))
        }
        continue
      }
      switch (line.charAt(0)) {
        case '#':
          if (!comment) {
            comment = line.substring(1, line.length).trim()
          } else {
            comment = comment.concat('\n', line.substring(1, line.length).trim())
          }
          break
        case 'I':
        case 'D':
        case 'S':
        case 'B':
          readProp(line.charAt(0) as Type, line)
          break
        case '<':
          break
        case '{':
          if (pendingCategory) {
            category = pendingCategory
            config[category] = { comment, properties: [] }
            comment = undefined
          } else {
            throw new CorruptedForgeConfigError('MissingCategory', line)
          }
          break
        case '}':
          category = undefined
          break
        default:
          if (!category) {
            if (line.endsWith('{')) {
              category = line.substring(0, line.length - 1).trim()
              config[category] = { comment, properties: [] }
              comment = undefined
            } else {
              pendingCategory = line
            }
          } else {
            throw new CorruptedForgeConfigError('Duplicated', line)
          }
      }
    }
    return config
  }
}
