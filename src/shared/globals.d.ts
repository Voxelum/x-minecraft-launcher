/* eslint-disable */

// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
type DeepPartial<T> = Partial<{
    [k in keyof T]:
    T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
    T[k] extends object ? DeepPartial<T[k]> :
    T[k];
}>;

declare module '/@/assets/locales/index.json' {
    type Locale = {
        [range: string]: string;
    };
    const locale: Locale;
    export = locale;
}

declare module '*.png' {
    const value: string;
    export default value;
}
