import { createResourceBuilder, getResourceFromBuilder } from '.';

describe('#createResourceBuilder', () => {
    test('should return the empty resource', () => {
        let builder = createResourceBuilder();
        expect(builder).toContain({
            name: '',
            path: '',
            hash: '',
            ext: '',
            domain: '',
            type: '',
            metadata: {},
        });
        expect(builder.source.uri).toEqual([]);
        expect(typeof builder.source.date).toEqual('string');
        expect(Object.keys(builder.source)).toEqual(['url', 'date']);
    });
    test('should assign source', () => {
        let builder = createResourceBuilder({ custom: { key: 'value' } });
        expect(builder).toContain({
            name: '',
            path: '',
            hash: '',
            ext: '',
            domain: '',
            type: '',
            metadata: {},
        });
        expect(builder.source.uri).toEqual([]);
        expect(typeof builder.source.date).toEqual('string');
        expect(builder.source.custom).toEqual({ key: 'value' });
        expect(Object.keys(builder.source)).toEqual(['url', 'date', 'custom']);
    });
});

test('#getResourceFromBuilder', () => {
    let builder = createResourceBuilder();
    builder.icon = new Uint8Array([]);
    let resource = getResourceFromBuilder(builder);
    expect(Reflect.get(resource, 'icon')).toBeUndefined();
    expect(builder).toMatchObject(resource);
});
