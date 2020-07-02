import { Resource } from '@universal/util/resource';
import { ArtifactVersion, VersionRange } from 'maven-artifact-version';
import { requireNonnull } from './assert';

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

export function getModIdentifier(modObject: Resource<any>) {
    if (modObject.type === 'forge' && modObject.metadata instanceof Array) {
        const meta = modObject.metadata[0];
        if (meta.modid && meta.version) {
            return `forge://${meta.modid}/${meta.version}`;
        }
    }
    if (modObject.type === 'liteloader') {
        const meta = modObject.metadata;
        if (meta.name && meta.version) {
            return `liteloader://${meta.name}/${meta.version}`;
        }
    }
    if (typeof modObject.source.curseforge === 'object') {
        const { fileId, projectId } = modObject.source.curseforge;
        if (fileId && projectId) {
            return `curseforge://${projectId}/${fileId}`;
        }
        if (fileId) {
            return `curseforge://${fileId}`;
        }
    }
    return `resource://${modObject.hash}`;
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
