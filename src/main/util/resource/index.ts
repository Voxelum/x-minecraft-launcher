import { AnyResource } from '@universal/store/modules/resource';
import { FileSystem } from '@xmcl/system';
import { UrlWithStringQuery } from 'url';

export * from './decorate';
export * from './entry';
export * from './io';
export * from './parse';

export interface ResourceRegistryEntry<T> {
    type: string;
    domain: string;
    ext: string;
    parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>;
    parseMetadata: (data: FileSystem) => Promise<T>;
    getSuggestedName: (metadata: T) => string;
    /**
     * Get ideal uri for this resource
     */
    getUri: (metadata: T, hash: string) => string;
}

export interface DomainedSourceCollection {
    [domain: string]: Record<string, string | number>;
}

export interface ResourceHost {
    /**
     * Query the resource by uri.
     * Throw error if not found.
     * @param uri The uri for the querying resource
     */
    query(uri: UrlWithStringQuery): Promise<{
        /**
         * The resource url
         */
        url: string;
        source: DomainedSourceCollection;
        type: string;
    } | undefined>;
}

export const UNKNOWN_ENTRY: ResourceRegistryEntry<unknown> = {
    type: 'unknown',
    domain: 'unknowns',
    ext: '*',
    parseIcon: () => Promise.resolve(undefined),
    parseMetadata: () => Promise.resolve({}),
    getSuggestedName: () => '',
    getUri: () => '',
};

export interface ResourceBuilder extends AnyResource {
    icon?: Uint8Array;
}

/**
 * Create a resource builder from source.
 */
export function createResourceBuilder(source?: DomainedSourceCollection): ResourceBuilder {
    source = source ?? {};
    return {
        name: '',
        path: '',
        hash: '',
        ext: '',
        domain: '',
        type: '',
        metadata: {},
        source: {
            uri: [],
            date: new Date().toJSON(),
            ...source,
        },
    };
}

export function getResourceFromBuilder(builder: ResourceBuilder): AnyResource {
    const res = { ...builder };
    delete res.icon;
    return res;
}

export function getBuilderFromResource(resource: AnyResource): ResourceBuilder {
    return { ...resource };
}
