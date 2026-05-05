/*
 * Copyright 2016 FabricMC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export class FabricSemanticVersion {
  private static readonly DOT_SEPARATED_ID = /^[-0-9A-Za-z]+(\.[-0-9A-Za-z]+)*$/
  private static readonly UNSIGNED_INTEGER = /^(0|[1-9][0-9]*)$/
  private static readonly COMPONENT_WILDCARD = -1

  private components: number[]
  private prerelease: string | undefined
  private build: string | undefined
  private friendlyName: string

  constructor(version: string, storeX: boolean = false) {
    const buildDelimPos = version.indexOf('+')
    let build: string | undefined
    let prerelease: string | undefined

    if (buildDelimPos >= 0) {
      build = version.substring(buildDelimPos + 1)
      version = version.substring(0, buildDelimPos)
    }

    const dashDelimPos = version.indexOf('-')
    if (dashDelimPos >= 0) {
      prerelease = version.substring(dashDelimPos + 1)
      version = version.substring(0, dashDelimPos)
    }

    if (prerelease && !FabricSemanticVersion.DOT_SEPARATED_ID.test(prerelease)) {
      throw new Error(`Invalid prerelease string '${prerelease}'!`)
    }

    if (version.endsWith('.')) {
      throw new Error('Negative version number component found!')
    } else if (version.startsWith('.')) {
      throw new Error('Missing version component!')
    }

    const componentStrings = version.split('.')
    if (componentStrings.length < 1) {
      throw new Error('Did not provide version numbers!')
    }

    const components: number[] = []
    let firstWildcardIdx = -1

    for (let i = 0; i < componentStrings.length; i++) {
      const compStr = componentStrings[i]

      if (storeX) {
        if (compStr === 'x' || compStr === 'X' || compStr === '*') {
          if (prerelease) {
            throw new Error('Pre-release versions are not allowed to use X-ranges!')
          }
          components[i] = FabricSemanticVersion.COMPONENT_WILDCARD
          if (firstWildcardIdx < 0) firstWildcardIdx = i
          continue
        } else if (i > 0 && components[i - 1] === FabricSemanticVersion.COMPONENT_WILDCARD) {
          throw new Error('Interjacent wildcard (1.x.2) are disallowed!')
        }
      }

      if (compStr.trim() === '') {
        throw new Error('Missing version number component!')
      }

      try {
        components[i] = parseInt(compStr, 10)
        if (components[i] < 0) {
          throw new Error(`Negative version number component '${compStr}'!`)
        }
      } catch (e) {
        throw new Error(`Could not parse version number component '${compStr}'!`)
      }
    }

    if (
      storeX &&
      components.length === 1 &&
      components[0] === FabricSemanticVersion.COMPONENT_WILDCARD
    ) {
      throw new Error("Versions of form 'x' or 'X' not allowed!")
    }

    // Strip extra wildcards (1.x.x -> 1.x)
    if (firstWildcardIdx > 0 && components.length > firstWildcardIdx + 1) {
      components.splice(firstWildcardIdx + 1)
    }

    this.components = components
    this.prerelease = prerelease
    this.build = build

    const fnBuilder: string[] = []
    for (let i = 0; i < this.components.length; i++) {
      if (i > 0) fnBuilder.push('.')
      if (this.components[i] === FabricSemanticVersion.COMPONENT_WILDCARD) {
        fnBuilder.push('x')
      } else {
        fnBuilder.push(this.components[i].toString())
      }
    }

    if (this.prerelease) {
      fnBuilder.push('-', this.prerelease)
    }

    if (this.build) {
      fnBuilder.push('+', this.build)
    }

    this.friendlyName = fnBuilder.join('')
  }

  public getVersionComponentCount(): number {
    return this.components.length
  }

  public getVersionComponent(pos: number): number {
    if (pos < 0) {
      throw new Error('Tried to access negative version number component!')
    } else if (pos >= this.components.length) {
      return this.components[this.components.length - 1] ===
        FabricSemanticVersion.COMPONENT_WILDCARD
        ? FabricSemanticVersion.COMPONENT_WILDCARD
        : 0
    } else {
      return this.components[pos]
    }
  }

  public getVersionComponents(): number[] {
    return [...this.components]
  }

  public getPrereleaseKey(): string | undefined {
    return this.prerelease
  }

  public getBuildKey(): string | undefined {
    return this.build
  }

  public getFriendlyString(): string {
    return this.friendlyName
  }

  public equals(o: any): boolean {
    if (!(o instanceof FabricSemanticVersion)) {
      return false
    } else {
      const other = o as FabricSemanticVersion
      if (!this.equalsComponentsExactly(other)) {
        return false
      }
      return this.prerelease === other.prerelease && this.build === other.build
    }
  }

  public toString(): string {
    return this.getFriendlyString()
  }

  public hasWildcard(): boolean {
    return this.components.some((i) => i === FabricSemanticVersion.COMPONENT_WILDCARD)
  }

  public equalsComponentsExactly(other: FabricSemanticVersion): boolean {
    const maxLength = Math.max(this.getVersionComponentCount(), other.getVersionComponentCount())
    for (let i = 0; i < maxLength; i++) {
      if (this.getVersionComponent(i) !== other.getVersionComponent(i)) {
        return false
      }
    }
    return true
  }

  public compareTo(other: FabricComparableVersion): number {
    if (!(other instanceof FabricSemanticVersion)) {
      return this.getFriendlyString().localeCompare(other.getFriendlyString())
    }

    const o = other as FabricSemanticVersion

    for (
      let i = 0;
      i < Math.max(this.getVersionComponentCount(), o.getVersionComponentCount());
      i++
    ) {
      const first = this.getVersionComponent(i)
      const second = o.getVersionComponent(i)

      if (
        first === FabricSemanticVersion.COMPONENT_WILDCARD ||
        second === FabricSemanticVersion.COMPONENT_WILDCARD
      ) {
        continue
      }

      const compare = first - second
      if (compare !== 0) return compare
    }

    const prereleaseA = this.getPrereleaseKey()
    const prereleaseB = o.getPrereleaseKey()

    if (prereleaseA || prereleaseB) {
      if (prereleaseA && prereleaseB) {
        const prereleaseATokens = prereleaseA.split('.')
        const prereleaseBTokens = prereleaseB.split('.')

        for (let i = 0; i < prereleaseATokens.length; i++) {
          if (i < prereleaseBTokens.length) {
            const partA = prereleaseATokens[i]
            const partB = prereleaseBTokens[i]

            if (FabricSemanticVersion.UNSIGNED_INTEGER.test(partA)) {
              if (FabricSemanticVersion.UNSIGNED_INTEGER.test(partB)) {
                const compare = partA.length - partB.length
                if (compare !== 0) return compare
              } else {
                return -1
              }
            } else {
              if (FabricSemanticVersion.UNSIGNED_INTEGER.test(partB)) {
                return 1
              }
            }

            const compare = partA.localeCompare(partB)
            if (compare !== 0) return compare
          } else {
            return 1
          }
        }

        return prereleaseBTokens.length > prereleaseATokens.length ? -1 : 0
      } else if (prereleaseA) {
        return o.hasWildcard() ? 0 : -1
      } else {
        return this.hasWildcard() ? 0 : 1
      }
    } else {
      return 0
    }
  }
}

interface FabricComparableVersion {
  getFriendlyString(): string
}

export function parseSemanticVersion(version: string, storeX = true): FabricSemanticVersion {
  return new FabricSemanticVersion(version, storeX)
}
