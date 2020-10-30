import { assignShallow } from '../src/universal/util/object';

describe('#assignShallow', () => {
    test('should fitin primitive types', () => {
        let state = {
            a: 'str',
            b: 0,
            c: false,
            d: [],
        };
        let value = {
            a: 'vstr',
            b: 10,
            c: true,
            d: [1],
        };
        assignShallow(state, value);
        expect(state).toEqual(value);
    });
    test('should not fit in with wrong types', () => {
        let state = {
            a: 'str',
            b: 0,
            c: false,
            d: [],
        };
        let value = {
            a: 1,
            b: 's',
            c: [],
            d: false,
        };
        assignShallow(state, value);
        expect(state).toEqual({
            a: 'str',
            b: 0,
            c: false,
            d: [],
        });
    });
    test('should not fit in object', () => {
        let state = {
            a: 'str',
            b: 0,
            c: false,
            d: [],
            e: { a: 2 },
        };
        let value = {
            a: 'vstr',
            b: 10,
            c: true,
            d: [1],
            e: { a: 1 },
        };
        assignShallow(state, value);
        expect(state).toEqual({
            a: 'vstr',
            b: 10,
            c: true,
            d: [1],
            e: { a: 2 },
        });
    });
    test('should not fit in extra props', () => {
        let state = {
            a: 'str',
            b: 0,
            c: false,
            d: [],
        };
        let value = {
            a: 'vstr',
            b: 10,
            c: true,
            d: [1],
            e: { a: 1 },
        };
        assignShallow(state, value);
        expect(state).toEqual({
            a: 'vstr',
            b: 10,
            c: true,
            d: [1],
        });
    });
});
