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
import { FabricSemanticVersion as SemanticVersion } from './semver'

export enum VersionComparisonOperator {
  GREATER_EQUAL = '>=',
  LESS_EQUAL = '<=',
  GREATER = '>',
  LESS = '<',
  EQUAL = '=',
  SAME_TO_NEXT_MINOR = '~',
  SAME_TO_NEXT_MAJOR = '^',
}

const operatorFunctions = {
  [VersionComparisonOperator.GREATER_EQUAL]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) >= 0,
  [VersionComparisonOperator.LESS_EQUAL]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) <= 0,
  [VersionComparisonOperator.GREATER]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) > 0,
  [VersionComparisonOperator.LESS]: (a: SemanticVersion, b: SemanticVersion) => a.compareTo(b) < 0,
  [VersionComparisonOperator.EQUAL]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) === 0,
  [VersionComparisonOperator.SAME_TO_NEXT_MINOR]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) >= 0 &&
    a.getVersionComponent(0) === b.getVersionComponent(0) &&
    a.getVersionComponent(1) === b.getVersionComponent(1),
  [VersionComparisonOperator.SAME_TO_NEXT_MAJOR]: (a: SemanticVersion, b: SemanticVersion) =>
    a.compareTo(b) >= 0 && a.getVersionComponent(0) === b.getVersionComponent(0),
}

const operatorMinMax = {
  [VersionComparisonOperator.SAME_TO_NEXT_MINOR]: (version: SemanticVersion) => ({
    min: version,
    max: {
      getVersionComponent: (i: number) =>
        i === 1 ? version.getVersionComponent(1) + 1 : version.getVersionComponent(i),
    },
  }),
  [VersionComparisonOperator.SAME_TO_NEXT_MAJOR]: (version: SemanticVersion) => ({
    min: version,
    max: {
      getVersionComponent: (i: number) =>
        i === 0 ? version.getVersionComponent(0) + 1 : version.getVersionComponent(i),
    },
  }),
  default: (version: SemanticVersion) => ({ min: version, max: version }),
}

export function testVersion(
  operator: VersionComparisonOperator,
  a: SemanticVersion,
  b: SemanticVersion,
): boolean {
  if (isSemanticVersion(a) && isSemanticVersion(b)) {
    return operatorFunctions[operator](a, b)
  } else {
    return a.getFriendlyString() === b.getFriendlyString()
  }
}

export function getMinMaxVersion(operator: VersionComparisonOperator, version: SemanticVersion) {
  // @ts-ignore
  return operatorMinMax[operator]?.(version) ?? operatorMinMax.default(version)
}

function isSemanticVersion(version: SemanticVersion): version is SemanticVersion {
  return 'compareTo' in version && 'getVersionComponent' in version
}
