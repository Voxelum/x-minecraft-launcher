export type ExceptionType =
    'instance.export.versionInComplete' | 'instance.export.librariesIncomplete' | 'instance.export.assetsIncomplete';
export enum Except {
    missingVersion = 'missingVersion',
    missingVersionJar = 'missingVersionJar',
    missingAssetsIndex = 'missingAssetsIndex',
    missingVersionJson = 'missingVersionJson',
}

export interface Execption {
    type: ExceptionType | string;
}

export function exception(errorType: ExceptionType | string, context?: object): Execption {
    return {
        type: errorType,
        ...(context || {})
    };
}

export function assertOrThrow<T extends Execption>(v: unknown, f: () => T): asserts v {
    if (!v) throw f();
}

export async function assertSuccess<Z, T extends Execption>(v: Promise<Z>, f: (e: any) => T) {
    try {
        return await v;
    } catch (e) {
        throw f(e);
    }
}
