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
import { FabricSemanticVersion } from './semver'
import { VersionComparisonOperator, testVersion, getMinMaxVersion } from './operators'

export interface VersionRange {
  test(version: FabricSemanticVersion): boolean
  getTerms(): PredicateTerm[]
  getInterval(): VersionInterval
}

interface PredicateTerm {
  getOperator(): VersionComparisonOperator
  getReferenceVersion(): FabricSemanticVersion
}

interface VersionInterval {
  min: FabricSemanticVersion | undefined
  max: FabricSemanticVersion | undefined
  isMinInclusive: boolean
  isMaxInclusive: boolean
}

class AnyVersionPredicate implements VersionRange {
  static readonly INSTANCE = new AnyVersionPredicate()

  test(): boolean {
    return true
  }

  getTerms(): PredicateTerm[] {
    return []
  }

  getInterval(): VersionInterval {
    return { min: undefined, max: undefined, isMinInclusive: true, isMaxInclusive: true }
  }

  toString(): string {
    return '*'
  }
}

class SingleVersionPredicate implements VersionRange, PredicateTerm {
  constructor(
    private readonly operator: VersionComparisonOperator,
    private readonly refVersion: FabricSemanticVersion,
  ) {}

  test(version: FabricSemanticVersion): boolean {
    return testVersion(this.operator, version, this.refVersion)
  }

  getTerms(): PredicateTerm[] {
    return [this]
  }

  getInterval(): VersionInterval {
    const { min, max } = getMinMaxVersion(this.operator, this.refVersion)
    return {
      min,
      max,
      isMinInclusive:
        this.operator === VersionComparisonOperator.GREATER_EQUAL ||
        this.operator === VersionComparisonOperator.EQUAL,
      isMaxInclusive:
        this.operator === VersionComparisonOperator.LESS_EQUAL ||
        this.operator === VersionComparisonOperator.EQUAL,
    }
  }

  getOperator(): VersionComparisonOperator {
    return this.operator
  }

  getReferenceVersion(): FabricSemanticVersion {
    return this.refVersion
  }

  toString(): string {
    return `${this.operator}${this.refVersion}`
  }
}

class MultiVersionPredicate implements VersionRange {
  constructor(private readonly predicates: SingleVersionPredicate[]) {}

  test(version: FabricSemanticVersion): boolean {
    return this.predicates.every((predicate) => predicate.test(version))
  }

  getTerms(): PredicateTerm[] {
    return this.predicates
  }

  getInterval(): VersionInterval {
    return this.predicates.reduce(
      (acc, predicate) => {
        const interval = predicate.getInterval()
        return {
          min:
            acc.min === undefined
              ? interval.min
              : interval.min === undefined
                ? acc.min
                : testVersion(VersionComparisonOperator.GREATER_EQUAL, acc.min, interval.min)
                  ? acc.min
                  : interval.min,
          max:
            acc.max === undefined
              ? interval.max
              : interval.max === undefined
                ? acc.max
                : testVersion(VersionComparisonOperator.LESS_EQUAL, acc.max, interval.max)
                  ? acc.max
                  : interval.max,
          isMinInclusive: acc.isMinInclusive && interval.isMinInclusive,
          isMaxInclusive: acc.isMaxInclusive && interval.isMaxInclusive,
        }
      },
      {
        min: undefined,
        max: undefined,
        isMinInclusive: true,
        isMaxInclusive: true,
      } as VersionInterval,
    )
  }

  toString(): string {
    return this.predicates.map((p) => p.toString()).join(' ')
  }
}

/**
 * Parse the version range string.
 * @param rangeString The version range string
 * @returns The version range
 */
export function parseVersionRange(rangeString: string): VersionRange {
  const terms = rangeString
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*')

  if (terms.length === 0) {
    return AnyVersionPredicate.INSTANCE
  }

  const predicates = terms.map((term) => {
    let operator = VersionComparisonOperator.EQUAL
    for (const op of Object.values(VersionComparisonOperator)) {
      if (term.startsWith(op)) {
        operator = op
        term = term.slice(op.length)
        break
      }
    }

    try {
      const version = new FabricSemanticVersion(term, true) // Assume a parseVersion function exists
      return new SingleVersionPredicate(operator, version)
    } catch (e) {
      if (e instanceof Error && e.message === "Versions of form 'x' or 'X' not allowed!") {
        const version = new FabricSemanticVersion(term, false)
        return new SingleVersionPredicate(operator, version)
      }
      throw e
    }
  })

  return predicates.length === 1 ? predicates[0] : new MultiVersionPredicate(predicates)
}
