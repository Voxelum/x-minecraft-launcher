import { basename, extname } from 'path';
import { parse } from 'url';
import { DomainedSourceCollection, ResourceBuilder, ResourceHost, ResourceRegistryEntry } from '.';

/**
 * Decorate the builder from resource host.
 * @param builder The resource builder
 * @param resourceHosts The resource hosts
 * @param url The known url
 */
export async function decorateBuilderFromHost(builder: ResourceBuilder, resourceHosts: ResourceHost[], url: string, typeHint?: string) {
    let resolvedUrl: string | undefined;
    let source: DomainedSourceCollection | undefined;
    let type: string | undefined = typeHint;

    let parsedUrl = parse(url);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'http:') {
        resolvedUrl = parsedUrl.href;
        source = {};
    } else {
        for (let host of resourceHosts) {
            let result = await host.query(parsedUrl);
            if (result) {
                source = result.source;
                type = result.type ?? type;
                resolvedUrl = result.url;
                break;
            }
        }
    }

    if (!resolvedUrl) {
        return false;
    }

    builder.type = type ?? builder.type;
    builder.source.uri.push(url);
    if (url !== resolvedUrl) {
        builder.source.uri.push(resolvedUrl);
    }

    source = source ?? {};
    Object.assign(builder.source, source);
    return true;
}

/**
 * Decoarte the resource builder with real routing urls and hash. 
 * @param builder 
 * @param urls The urls goes through to download
 * @param hash The hash of the resource
 */
export function decorateBulderWithUrlsAndHash(builder: ResourceBuilder, urls: string[], hash: string) {
    let base = urls[urls.length - 1];
    let ext = extname(base);
    builder.name = basename(base, ext);
    builder.hash = hash;
    builder.ext = ext;
    for (let u of urls) {
        if (builder.source.uri.indexOf(u) === -1) {
            builder.source.uri.push(u);
        }
    }
}

export function decorateBuilderWithPathAndHash(builder: ResourceBuilder, path: string, hash: string) {
    builder.hash = hash;
    builder.ext = extname(path);
    builder.name = basename(path, builder.ext);
    builder.source.file = {
        path,
    };
}

/**
* Decorate the resource metadata resource parsed result
*/
export function decorateBuilderFromMetadata(builder: ResourceBuilder, resource: ResourceRegistryEntry<any> & { metadata: any; icon: Uint8Array | undefined }) {
    let { domain, metadata, icon, type, getSuggestedName, getUri } = resource;
    builder.domain = domain;
    builder.metadata = metadata;
    builder.type = type;

    let suggested = getSuggestedName(metadata);
    if (suggested) {
        builder.name = suggested;
    }

    builder.icon = icon;
    builder.source.uri.push(getUri(metadata, builder.hash));
}
