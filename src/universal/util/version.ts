import { VersionRange, ArtifactVersion } from 'maven-artifact-version';
import { Resource } from '@universal/store/modules/resource';
import { requireNonnull } from './assert';

export function isCompatible(range: string, version: string) {
    if (range === '[*]') return true;
    const vRange = VersionRange.createFromVersionSpec(range);
    requireNonnull(vRange);
    return vRange.containsVersion(ArtifactVersion.of(version));
}

export function getExpectVersion(minecraft: string, forge?: string, liteloader?: string) {
    let expectedId = minecraft;
    if (typeof forge === 'string' && forge.length > 0) expectedId += `-forge${minecraft}-${forge}`;
    if (typeof liteloader === 'string' && liteloader.length > 0) expectedId += `-liteloader${liteloader}`;
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
