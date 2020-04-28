import { decorateBuilderFromHost, decorateBulderWithUrlsAndHash, decorateBuilderWithPathAndHash, decorateBuilderFromMetadata } from './decorate';
import { createResourceBuilder, ResourceRegistryEntry } from '.';

describe('#decorateBuilderFromHost', () => {
    test('should resolve from http', async () => {
        let builder = createResourceBuilder();
        let result = await decorateBuilderFromHost(builder, [], 'http://test.com/test-resource', 'type');
        expect(result).toBe(true);
        expect(builder.type).toEqual('type');
        expect(builder.source.uri).toEqual(['http://test.com/test-resource']);
    });
    test('should resolve from https', async () => {
        let builder = createResourceBuilder();
        let result = await decorateBuilderFromHost(builder, [], 'https://test.com/test-resource', 'type');
        expect(result).toBe(true);
        expect(builder.type).toEqual('type');
        expect(builder.source.uri).toEqual(['https://test.com/test-resource']);
    });
    test('should resolve from file', async () => {
        let builder = createResourceBuilder();
        let result = await decorateBuilderFromHost(builder, [], 'file://test.com/test-resource', 'type');
        expect(result).toBe(true);
        expect(builder.type).toEqual('type');
        expect(builder.source.uri).toEqual(['file://test.com/test-resource']);
    });
    test('should use default type', async () => {
        let builder = createResourceBuilder();
        builder.type = 'default';
        let result = await decorateBuilderFromHost(builder, [], 'http://test.com/test-resource');
        expect(result).toBe(true);
        expect(builder.type).toEqual('default');
    });

    test('should resolve custom protocol from host', async () => {
        let builder = createResourceBuilder();
        let result = await decorateBuilderFromHost(builder, [
            {
                async query() {
                    return {
                        url: 'https://resolved/url',
                        source: { custom: { key: 'value' } },
                        type: 'mod',
                    };
                },
            },
        ], 'custom://test.com/test-resource');
        expect(result).toBe(true);
        expect(builder.source.uri).toEqual(['custom://test.com/test-resource', 'https://resolved/url']);
        expect(builder.type).toEqual('mod');
        expect(builder.source.custom).toEqual({ key: 'value' });
    });
    test('should return false if it cannot resolve custom protocol', async () => {
        let builder = createResourceBuilder();
        let result = await decorateBuilderFromHost(builder, [], 'custom://test.com/test-resource');
        expect(result).toBe(false);
        expect(builder.source.uri).toEqual([]);
    });
});

describe('#decorateBulderWithUrlsAndHash', () => {
    test('should decorate the builder with url and hash', () => {
        let builder = createResourceBuilder();
        decorateBulderWithUrlsAndHash(builder, ['a.abc', 'b.exe'], 'hash');
        expect(builder.ext).toBe('exe');
        expect(builder.hash).toEqual('hash');
        expect(builder.name).toEqual('b');
        expect(builder.source.uri).toEqual(['a.abc', 'b.exe']);
    });
    test('should not include dup url twice', () => {
        let builder = createResourceBuilder();
        builder.source.uri.push('b.exe');
        decorateBulderWithUrlsAndHash(builder, ['a.abc', 'b.exe'], 'hash');
        expect(builder.ext).toBe('abc');
        expect(builder.hash).toEqual('hash');
        expect(builder.name).toEqual('a');
        expect(builder.source.uri).toEqual(['b.exe', 'a.abc']);
    });
});

describe('#decorateBuilderWithPathAndHash', () => {
    test('should decoarte the path and hash', () => {
        let builder = createResourceBuilder();
        decorateBuilderWithPathAndHash(builder, '/custom/path.abc', 'hash');
        expect(builder.ext).toBe('abc');
        expect(builder.hash).toEqual('hash');
        expect(builder.name).toEqual('path');
        expect(builder.source.uri).toEqual([]);
        expect(builder.source.file).toEqual('/custom/path.abc');
    });
});

describe('#decorateBuilderFromMetadata', () => {
    test('should assign metadata to resource', () => {
        let builder = createResourceBuilder();
        let resource: ResourceRegistryEntry<any> & { metadata: any; icon: Uint8Array | undefined } = {
            type: 'mod',
            getSuggestedName() { return 'suggested'; },
            domain: 'mods',
            icon: new Uint8Array(0),
            getUri() { return 'resource://uri'; },
            metadata: { key: 'value' },
            ext: '.jar',
            async parseIcon() { return undefined; },
            async parseMetadata() { },
        };
        decorateBuilderFromMetadata(builder, resource);
        expect(builder.icon).toBe(resource.icon);
        expect(builder.type).toBe(resource.type);
        expect(builder.domain).toBe(resource.domain);
        expect(builder.metadata).toBe(resource.metadata);
        expect(builder.name).toBe(resource.getSuggestedName({}));
        expect(builder.source.uri).toBe(['resource://uri']);
    });
});
