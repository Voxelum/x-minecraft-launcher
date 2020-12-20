export interface OptifineVersion {
    mcversion: string;
    type: string;
    patch: string;
}

export interface OptifineVersionList {
    versions: OptifineVersion[];
    timestamp: string;
}
