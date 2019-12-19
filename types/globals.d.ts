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

// type TaskHandle = string;
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

declare module 'static/protocol.json' {
    type ProtocolToVersion = {
        [protocol: string]: string[];
    };
    const protocolToVersion: ProtocolToVersion;
    export = protocolToVersion;
}

declare module 'universal/utils/packFormatMapping.json' {
    type PackFormatToVersioRange = {
        [range: string]: string;
    };
    const formatToRange: PackFormatToVersioRange;
    export = formatToRange;
}

declare namespace NodeJS {
    interface Global {
        __static: string;
    }
}

declare const __static: string;

// declare module 'long' {
//     export = Long.default
// }
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
