import throttle from 'lodash.throttle';

export function createhDynamicThrottle<T extends (...args: any[]) => any>(f: T, keyExtractor: (...param: Parameters<T>) => string, time: number): T {
    let memos: Record<string, T> = {};
    let result: T = (((...params: any[]) => {
        let key = keyExtractor(...params as any);
        if (memos[key]) {
            return memos[key](...params) as any;
        }
        let func = throttle(f, time);
        memos[key] = func;
        return func() as any;
    }) as any as T);
    return result;
}
