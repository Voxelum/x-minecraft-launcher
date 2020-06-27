import { basename, extname } from 'path';
import { unescape } from 'querystring';
import { parse } from 'url';
import { SourceInfomation, ResourceBuilder, ResourceHost, ResourceRegistryEntry } from '.';
import { getSuggestedFilename } from '../fs';

/**
 * Decorate the builder from resource host.
 * @param builder The resource builder
 * @param resourceHosts The resource hosts
 * @param url The known url
 */
export async function decorateBuilderFromHost(builder: ResourceBuilder, resourceHosts: ResourceHost[], url: string, typeHint?: string) {
    let resolvedUrl: string | undefined;
    let source: SourceInfomation | undefined;
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

export function decorateBuilderSourceUrls(builder: ResourceBuilder, urls: string[]) {
    for (let u of urls) {
        if (!u) continue;
        if (builder.source.uri.indexOf(u) === -1) {
            builder.source.uri.push(u);
        }
    }
}
export function decorateBuilderFromStat(builder: ResourceBuilder, stat: { ino: number; size: number }) {
    builder.size = stat.size;
    builder.ino = stat.ino;
}

export function decorateBuilderWithPathAndHash(builder: ResourceBuilder, path: string, hash: string) {
    builder.hash = hash;
    builder.ext = extname(path);
    builder.name = getSuggestedFilename(basename(path, builder.ext));
}


/**
* Decorate the resource metadata resource parsed result
*/
export function decorateBuilderFromMetadata(builder: ResourceBuilder, resource: ResourceRegistryEntry<any> & { metadata: any; icon: Uint8Array | undefined }) {
    let { domain, metadata, icon, type, getSuggestedName, getUri } = resource;
    builder.domain = domain ?? 'unknown';
    builder.metadata = metadata ?? {};
    builder.type = type ?? 'unknown';

    let suggested = getSuggestedName(metadata);
    if (suggested) {
        builder.name = suggested;
    }

    builder.icon = icon;
    builder.source.uri.push(getUri(metadata, builder.hash));
}
