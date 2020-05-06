/* eslint-disable */

interface NodeRequire extends NodeRequireFunction {
    resolve: RequireResolve;
    cache: any;
    extensions: NodeExtensions;
    main: NodeModule | undefined;
    context: (path: string, useSubdirectories: boolean, patter: RegExp)
        => {
            (key: string): any;
            keys(): string[];
        };
}

// From https://github.com/andnp/SimplyTyped/blob/master/src/types/objects.ts
type DeepPartial<T> = Partial<{
    [k in keyof T]:
    T[k] extends unknown[] ? Array<DeepPartial<T[k][number]>> :
    T[k] extends Function ? T[k] :
    T[k] extends object ? DeepPartial<T[k]> :
    T[k];
}>;

declare module 'in-gfw' {
    namespace GFW {
        function net(): Promise<boolean>;
        function os(): Promise<boolean>;
    }
    function GFW(): Promise<boolean>;
    export = GFW;
}

declare module 'universal/utils/packFormatMapping.json' {
    type PackFormatToVersioRange = {
        [range: string]: string;
    };
    const formatToRange: PackFormatToVersioRange;
    export = formatToRange;
}

declare module 'vue-virtual-scroll-list' {
    import { Component } from 'vue';
    const component: Component<any, any, any, { size: number; remain: number }>;
    export = component;
}

declare namespace NodeJS {
    interface Global {
        __static: string;
    }
}

declare const __static: string;

// webpack import image to url
declare module '*.png' {
    const value: string;
    export default value;
}

declare module 'vue-particles' {
    const module: import('vue').PluginObject<any>;
    export default module;
}

interface Data {
    [key: string]: unknown;
}

declare module '*.vue' {
    import Vue from 'vue';

    export default Vue;
}
