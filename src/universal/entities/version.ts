import { requireNonnull } from '@universal/util/assert';
import type { Version } from '@xmcl/core';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { RuntimeVersions } from './instance.schema';

export type Status = 'remote' | 'local' | 'loading';

/**
 * An interface to reference a resolved version in 
 * <minecraft folder>/versions/<version-id>/<version-id>.json
 * 
 * This is more lightweight than @xmcl/minecraft-launcher-core's Version by Version.parse.
 */
export interface LocalVersion extends RuntimeVersions {
    /**
     * The ideal id this version, which is computed by 
     * function universal/utils/versions.js#getExpectVersion
     */
    id?: string;
    /**
     * The real folder id of the version, which is the <verison-id> in
     * 
     * <minecraft folder>/versions/<version-id>/<version-id>.json
     */
    folder: string;
}

export interface PartialVersionResolver {
    (version: Version): string;
}

export const resolveForgeVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('net.minecraftforge:forge:'))
    ?.name.split(':')[2]?.split('-')?.[1] || '';

export const resolveLiteloaderVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('com.mumfrey:liteloader:'))
    ?.name.split(':')[2] || '';

export const resolveFabricLoaderVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:fabric-loader:'))
    ?.name.split(':')[2] || '';

export const resolveFabricYarnVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:yarn:'))
    ?.name.split(':')[2] || '';

export const resolveMinecraftVersion: PartialVersionResolver = (v) => (v.inheritsFrom ? '' : v.id);

export function resolveRuntimeVersion(partialVersion: Version, runtime: RuntimeVersions) {
    const minecraft = resolveMinecraftVersion(partialVersion);
    const forge = resolveForgeVersion(partialVersion);
    const liteloader = resolveLiteloaderVersion(partialVersion);
    const fabricLoader = resolveFabricLoaderVersion(partialVersion);
    const yarn = resolveFabricYarnVersion(partialVersion);

    runtime.minecraft = runtime.minecraft || minecraft;
    runtime.forge = forge || runtime.forge;
    runtime.liteloader = liteloader || runtime.liteloader;
    runtime.fabricLoader = fabricLoader || runtime.fabricLoader;
    runtime.yarn = yarn || runtime.yarn;
}

export function isCompatible(range: string, version: string) {
    if (range === '[*]') return true;
    const vRange = VersionRange.createFromVersionSpec(range);
    requireNonnull(vRange);
    return vRange.containsVersion(ArtifactVersion.of(version));
}

export function getExpectVersion(minecraft: string, forge?: string, liteloader?: string, fabric?: string) {
    let expectedId = minecraft;
    if (typeof forge === 'string' && forge.length > 0) expectedId += `-forge${forge}`;
    if (typeof liteloader === 'string' && liteloader.length > 0) expectedId += `-liteloader${liteloader}`;
    if (typeof fabric === 'string' && fabric.length > 0) expectedId += `-fabric${fabric}`;
    return expectedId;
}

export function isReleaseVersion(version: string) {
    return version.match(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/g);
}
export function isSnapshotPreview(version: string) {
    return version.match(/^[0-9]+\.[0-9]+((\.[0-9])?-pre[0-9]+)?$/g)
        || version.match(/^[0-9]+\.[0-9]+(\.[0-9])? Pre-Release [0-9]+$/g)
        || version.match(/^[0-9]+w[0-9]+[abcd]$/);
}
export function isBetaVersion(version: string) {
    return version.match(/^b[0-9]+\.[0-9]+(\.[0-9])?(_[0-9]+)?$/g);
}
export function isAlphaVersion(version: string) {
    return version.match(/^a[0-9]+\.[0-9]+(\.[0-9])?(_[0-9]+)?$/g);
}

export function getMinecraftVersionFormat(version: string): 'release' | 'snapshot' | 'beta' | 'alpha' | 'unknown' {
    return isReleaseVersion(version) ? 'release'
        : isSnapshotPreview(version) ? 'snapshot'
            : isBetaVersion(version) ? 'beta'
                : isAlphaVersion(version) ? 'alpha'
                    : 'unknown';
}

export function compareRelease(versionA: string, versionB: string): number {
    let [major, minor, patch] = versionA.split('.').map(s => Number.parseInt(s, 10));
    let [majorB, minorB, patchB] = versionB.split('.').map(s => Number.parseInt(s, 10));
    if (major === majorB) {
        if (minor === minorB) {
            if (patch === patchB) {
                return 0;
            }
            return patch - patchB;
        }
        return minor - minorB;
    }
    return major - majorB;
}

export function compareSnapshot(versionA: string, versionB: string) {
    let [majorA, restA] = versionA.split('w');
    let [majorB, restB] = versionB.split('w');

    if (majorA === majorB) {
        let minorA = Number.parseInt(restA.slice(0, 2), 10);
        let minorB = Number.parseInt(restB.slice(0, 2), 10);
        if (minorA === minorB) {
            let codeA = restA.slice(2, 3);
            let codeB = restA.slice(2, 3);
            return codeA.localeCompare(codeB);
        }
        return minorA - minorB;
    }
    return Number.parseInt(majorA, 10) - Number.parseInt(majorB, 10);
}

export const LATEST_RELEASE = {
    id: '1.16.2',
    type: 'release',
    url: 'https://launchermeta.mojang.com/v1/packages/c847788ace47090745ba174a13eff17a95221c81/1.16.2.json',
    time: '2020-08-24T14:58:49+00:00',
    releaseTime: '2020-08-11T10:13:46+00:00',
};
