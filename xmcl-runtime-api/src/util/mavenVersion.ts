/* eslint-disable no-case-declarations */
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export interface ArtifactVersion {
  majorVersion?: number

  minorVersion?: number

  incrementalVersion?: number

  buildNumber?: number

  qualifier?: string

  readonly comparable: ComparableVersion

  compareTo(version: ArtifactVersion): number
}

function isDigitsPoint(p: string) {
  return '0123456789'.indexOf(p) !== -1
}

function isDigits(cs: string | undefined) {
  if (!cs) return false
  if (cs.length === 0) {
    return false
  }
  const sz = cs.length
  for (let i = 0; i < sz; i++) {
    if (!isDigitsPoint(cs.charAt(i))) {
      return false
    }
  }
  return true
}

export function parseVersion(version: string): ArtifactVersion {
  const comparable = new ComparableVersion(version)

  const index = version.indexOf('-')

  let buildNumber: number | undefined, qualifier: string | undefined, majorVersion: number | undefined, minorVersion: number | undefined, incrementalVersion: number | undefined
  let part1: string
  let part2

  if (index < 0) {
    part1 = version
  } else {
    part1 = version.substring(0, index)
    part2 = version.substring(index + 1)
  }

  if (part2 !== undefined) {
    if (part2.length === 1 || !part2.startsWith('0')) {
      buildNumber = tryParseInt(part2)
      if (buildNumber === undefined) {
        qualifier = part2
      }
    } else {
      qualifier = part2
    }
  }

  if ((part1.indexOf('.') === -1) && !part1.startsWith('0')) {
    majorVersion = tryParseInt(part1)
    if (majorVersion === undefined) {
      // qualifier is the whole version, including "-"
      qualifier = version
      buildNumber = undefined
    }
  } else {
    let fallback = false

    const tok = part1.split('.')
    if (tok.length !== 0) {
      majorVersion = getNextIntegerToken(tok)
      if (majorVersion === undefined) {
        fallback = true
      }
    } else {
      fallback = true
    }
    if (tok.length !== 0) {
      minorVersion = getNextIntegerToken(tok)
      if (minorVersion === undefined) {
        fallback = true
      }
    }
    if (tok.length !== 0) {
      incrementalVersion = getNextIntegerToken(tok)
      if (incrementalVersion === undefined) {
        fallback = true
      }
    }
    if (tok.length !== 0) {
      qualifier = tok.shift()
      fallback = isDigits(qualifier)
    }

    // string tokenizer won't detect these and ignores them
    if (part1.indexOf('..') !== -1 || part1.startsWith('.') || part1.endsWith('.')) {
      fallback = true
    }

    if (fallback) {
      // qualifier is the whole version, including "-"
      qualifier = version
      majorVersion = undefined
      minorVersion = undefined
      incrementalVersion = undefined
      buildNumber = undefined
    }
  }
  return {
    buildNumber,
    qualifier,
    majorVersion,
    minorVersion,
    incrementalVersion,
    comparable,
    compareTo(otherVersion) {
      return comparable.compareTo(otherVersion.comparable)
    },
  }
}
function getNextIntegerToken(tok: string[]) {
  const s = tok.shift() as string
  if ((s.length > 1) && s.startsWith('0')) {
    return undefined
  }
  return tryParseInt(s)
}

function tryParseInt(s: string): number | undefined {
  // for performance, check digits instead of relying later on catching NumberFormatException
  if (!isDigits(s)) {
    return undefined
  }
  const longValue = Number.parseInt(s)
  if (longValue > Number.MAX_VALUE) {
    return undefined
  }
  return longValue
}

enum Type {
  INT, STRING, LIST,
}
interface Item {
  isNull(): boolean
  compareTo(item: Item | undefined): number
  readonly type: Type
}

class IntItem implements Item {
  constructor(readonly value: number) { }

  isNull(): boolean {
    return this.value === 0
  }

  type = Type.INT
  compareTo(item: Item): number {
    if (item === undefined) {
      return (this.value === 0) ? 0 : 1 // 1.0 === 1, 1.1 > 1
    }

    switch (item.type) {
      case Type.INT:
        const itemValue = (item as IntItem).value
        return this.value - itemValue
        // return (this.value < itemValue) ? -1 : ((this.value === itemValue) ? 0 : 1)

      case Type.STRING:
        return 1 // 1.1 > 1-sp

      case Type.LIST:
        return 1 // 1.1 > 1-1

      default:
        throw new Error('invalid item: ' + item)
    }
  }
}
class ListItem implements Item {
  private value = [] as Item[]
  isNull(): boolean {
    return this.value.length === 0
  }

  type = Type.LIST
  push(item: Item) {
    this.value.push(item)
  }

  compareTo(item: Item): number {
    if (item === undefined) {
      if (this.value.length === 0) {
        return 0 // 1-0 = 1- (normalize) = 1
      }
      const first = this.value[0]
      return first.compareTo(undefined)
    }
    switch (item.type) {
      case Type.INT:
        return -1 // 1-1 < 1.0.x

      case Type.STRING:
        return 1 // 1-1 > 1-sp

      case Type.LIST:
        const left = [...this.value]
        const right = [...(item as ListItem).value]

        while (left.length !== 0 || right.length !== 0) {
          const l = left.length !== 0 ? left.shift() : undefined
          const r = right.length !== 0 ? right.shift() : undefined

          // if this is shorter, then invert the compare and mul with -1
          const result = l === undefined ? (r === undefined ? 0 : -1 * r.compareTo(l)) : l.compareTo(r)

          if (result !== 0) {
            return result
          }
        }

        return 0

      default:
        throw new Error('invalid item: ' + item)
    }
  }

  normalize(): void {
    for (let i = this.value.length - 1; i >= 0; i--) {
      const lastItem = this.value[i]
      if (lastItem.isNull()) {
        // remove null trailing items: 0, "", empty list
        this.value.splice(i, 1)
      } else if (!(lastItem instanceof ListItem)) {
        break
      }
    }
  }
}
class StringItem implements Item {
  isNull(): boolean {
    return StringItem.compre(StringItem.comparableQualifier(this.value), (StringItem.RELEASE_VERSION_INDEX)) === 0
  }

  private static readonly QUALIFIERS: string[] = ['alpha', 'beta', 'milestone', 'rc', 'snapshot', '', 'sp']
  private static readonly RELEASE_VERSION_INDEX = StringItem.QUALIFIERS.indexOf('').toString()
  static readonly ALIASES: { [key: string]: string } = { ga: '', final: '', release: '', cr: 'rc' }
  private static compre(a: string, b: string): number {
    return a > b ? 1 : a === b ? 0 : -1
  }

  static comparableQualifier(qualifier: string): string {
    const i = StringItem.QUALIFIERS.indexOf(qualifier)
    return i === -1 ? (StringItem.QUALIFIERS.length + '-' + qualifier) : i.toString()
  }

  type = Type.STRING

  compareTo(item: Item): number {
    if (!item) {
      // 1-rc < 1, 1-ga > 1
      return StringItem.compre(StringItem.comparableQualifier(this.value), StringItem.RELEASE_VERSION_INDEX)
    }
    switch (item.type) {
      case Type.INT:
        return -1 // 1.any < 1.1 ?

      case Type.STRING:
        return StringItem.compre(StringItem.comparableQualifier(this.value), StringItem.comparableQualifier((item as StringItem).value))

      case Type.LIST:
        return -1 // 1.any < 1-1

      default:
        throw new Error('invalid item: ' + item)
    }
  }

  constructor(readonly value: string, followedByDigit: boolean) {
    if (followedByDigit && value.length === 1) {
      // a1 = alpha-1, b1 = beta-1, m1 = milestone-1
      switch (value.charAt(0)) {
        case 'a':
          value = 'alpha'
          break
        case 'b':
          value = 'beta'
          break
        case 'm':
          value = 'milestone'
          break
        default:
      }
    }
    this.value = StringItem.ALIASES[value] || value
  }
}
export class ComparableVersion {
  private readonly items = new ListItem()
  constructor(readonly version: string) {
    const items = this.items

    version = version.toLowerCase()

    let list = items

    const stack: Item[] = []
    stack.push(list)

    let isDigit = false
    let startIndex = 0

    for (let i = 0; i < version.length; i++) {
      const c = version.charAt(i)

      if (c === '.') {
        if (i === startIndex) {
          list.push(new IntItem(0))
        } else {
          list.push(ComparableVersion.parseItem(isDigit, version.substring(startIndex, i)))
        }
        startIndex = i + 1
      } else if (c === '-') {
        if (i === startIndex) {
          list.push(new IntItem(0))
        } else {
          list.push(ComparableVersion.parseItem(isDigit, version.substring(startIndex, i)))
        }
        startIndex = i + 1

        list.push(list = new ListItem())
        stack.push(list)
      } else if (isDigitsPoint(c)) {
        if (!isDigit && i > startIndex) {
          list.push(new StringItem(version.substring(startIndex, i), true))
          startIndex = i

          list.push(list = new ListItem())
          stack.push(list)
        }

        isDigit = true
      } else {
        if (isDigit && i > startIndex) {
          list.push(ComparableVersion.parseItem(true, version.substring(startIndex, i)))
          startIndex = i

          list.push(list = new ListItem())
          stack.push(list)
        }

        isDigit = false
      }
    }

    if (version.length > startIndex) {
      list.push(ComparableVersion.parseItem(isDigit, version.substring(startIndex)))
    }

    while (stack.length !== 0) {
      list = stack.pop() as ListItem

      list.normalize()
    }
  }

  private static stripLeadingZeroes(buf: string): string {
    if (buf === undefined || buf.length === 0) {
      return '0'
    }
    for (let i = 0; i < buf.length; ++i) {
      const c = buf.charAt(i)
      if (c !== '0') {
        return buf.substring(i)
      }
    }
    return buf
  }

  private static parseItem(isDigit: boolean, buf: string): Item {
    if (isDigit) {
      buf = ComparableVersion.stripLeadingZeroes(buf)
      return new IntItem(Number.parseInt(buf))
    }
    return new StringItem(buf, false)
  }

  compareTo(o: ComparableVersion) {
    return this.items.compareTo(o.items)
  }
}

class Restriction {
  public static readonly EVERYTHING: Restriction = new Restriction(undefined, false, undefined, false)

  public constructor(readonly lowerBound: ArtifactVersion | undefined, readonly lowerBoundInclusive: boolean, readonly upperBound: ArtifactVersion | undefined,
    readonly upperBoundInclusive: boolean) {
  }

  public containsVersion(version: ArtifactVersion): boolean {
    if (this.lowerBound !== undefined) {
      const comparison = this.lowerBound.compareTo(version)

      if ((comparison === 0) && !this.lowerBoundInclusive) {
        return false
      }
      if (comparison > 0) {
        return false
      }
    }
    if (this.upperBound !== undefined) {
      const comparison = this.upperBound.compareTo(version)

      if ((comparison === 0) && !this.upperBoundInclusive) {
        return false
      }
      if (comparison < 0) {
        return false
      }
    }

    return true
  }
}

export class VersionRange {
  static from = VersionRange.createFromVersionSpec
  constructor(readonly recommendedVersion: ArtifactVersion | undefined, readonly restrictions: Restriction[]) {
  }

  /**
   * <p>
   * Create a version range from a string representation
   * </p>
   * Some spec examples are:
   * <ul>
   * <li><code>1.0</code> Version 1.0</li>
   * <li><code>[1.0,2.0)</code> Versions 1.0 (included) to 2.0 (not included)</li>
   * <li><code>[1.0,2.0]</code> Versions 1.0 to 2.0 (both included)</li>
   * <li><code>[1.5,)</code> Versions 1.5 and higher</li>
   * <li><code>(,1.0],[1.2,)</code> Versions up to 1.0 (included) and 1.2 or higher</li>
   * </ul>
   *
   * @param spec string representation of a version or version range
   * @return a new {@link VersionRange} object that represents the spec
   * @throws Error
   *
   */
  static createFromVersionSpec(spec: string): VersionRange | undefined {
    if (spec === undefined) {
      return undefined
    }

    const restrictions: Restriction[] = []
    let process = spec
    let version: ArtifactVersion | undefined
    let upperBound: ArtifactVersion | undefined
    let lowerBound: ArtifactVersion | undefined

    while (process.startsWith('[') || process.startsWith('(')) {
      const index1 = process.indexOf(')')
      const index2 = process.indexOf(']')

      let index = index2
      if (index2 < 0 || index1 < index2) {
        if (index1 >= 0) {
          index = index1
        }
      }

      if (index < 0) {
        throw new Error('Unbounded range: ' + spec)
      }

      const restriction = VersionRange.parseRestriction(process.substring(0, index + 1))
      if (lowerBound === undefined) {
        lowerBound = restriction.lowerBound
      }
      if (upperBound !== undefined) {
        const lo = restriction.lowerBound
        if (lo === undefined || lo.compareTo(upperBound) < 0) {
          throw new Error('Ranges overlap: ' + spec)
        }
      }
      restrictions.push(restriction)
      upperBound = restriction.upperBound

      process = process.substring(index + 1).trim()

      if (process.length > 0 && process.startsWith(',')) {
        process = process.substring(1).trim()
      }
    }

    if (process.length > 0) {
      if (restrictions.length > 0) {
        throw new Error(
          'Only fully-qualified sets allowed in multiple set scenario: ' + spec)
      } else {
        version = parseVersion(process)
        restrictions.push(Restriction.EVERYTHING)
      }
    }

    return new VersionRange(version, restrictions)
  }

  private static parseRestriction(spec: string): Restriction {
    const lowerBoundInclusive = spec.startsWith('[')
    const upperBoundInclusive = spec.endsWith(']')

    const process = spec.substring(1, spec.length - 1).trim()

    let restriction

    const index = process.indexOf(',')

    if (index < 0) {
      if (!lowerBoundInclusive || !upperBoundInclusive) {
        throw new Error('Single version must be surrounded by []: ' + spec)
      }

      const version = parseVersion(process)

      restriction = new Restriction(version, lowerBoundInclusive, version, upperBoundInclusive)
    } else {
      const lowerBound = process.substring(0, index).trim()
      const upperBound = process.substring(index + 1).trim()
      if (lowerBound === upperBound) {
        throw new Error('Range cannot have identical boundaries: ' + spec)
      }

      let lowerVersion
      if (lowerBound.length > 0) {
        lowerVersion = parseVersion(lowerBound)
      }
      let upperVersion
      if (upperBound.length > 0) {
        upperVersion = parseVersion(upperBound)
      }

      if (upperVersion !== undefined && lowerVersion !== undefined && upperVersion.compareTo(lowerVersion) < 0) {
        throw new Error('Range defies version ordering: ' + spec)
      }

      restriction = new Restriction(lowerVersion, lowerBoundInclusive, upperVersion, upperBoundInclusive)
    }

    return restriction
  }

  // public String toString() {
  //     if (recommendedVersion !== null) {
  //         return recommendedVersion.toString();
  //     }
  //     else {
  //         StringBuilder buf = new StringBuilder();
  //         for (Iterator < Restriction > i = restrictions.iterator(); i.hasNext(); )
  //         {
  //             Restriction r = i.next();

  //             buf.append(r.toString());

  //             if (i.hasNext()) {
  //                 buf.append(',');
  //             }
  //         }
  //         return buf.toString();
  //     }
  // }

  public containsVersion(version: ArtifactVersion): boolean {
    for (const restriction of this.restrictions) {
      if (restriction.containsVersion(version)) {
        return true
      }
    }
    return false
  }
}
