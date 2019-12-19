export function deepEquals(a: any, b: any): boolean {
    const ta = typeof a;
    const tb = typeof b;
    if (ta !== tb) return false;
    if (ta === 'object') {
        if (a instanceof Array && b instanceof Array) {
            if (a.length !== b.length) return false;
            return a.every((v, i) => deepEquals(v, b[i]));
        }
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every(k => deepEquals(a[k], b[k]));
    }
    return a === b;
}
export function isNullOrUndefine(object: any): object is undefined {
    return object === undefined || object === null;
}
export function notNull<T>(object: T | undefined | null): object is T {
    return object === undefined || object === null;
}
export function willBaselineChange(baseline: any, option: any): boolean {
    if (isNullOrUndefine(option)) return false;
    for (const key of Object.keys(option)) {
        const stateValue = baseline[key];
        const optionValue = option[key];

        if (!isNullOrUndefine(optionValue)) {
            if (typeof stateValue === 'object') {
                if (stateValue instanceof Array && optionValue instanceof Array
                    && stateValue.some((v, i) => v !== optionValue[i])) {
                    return true;
                }
                if (typeof optionValue === 'object' && willBaselineChange(stateValue, optionValue)) {
                    return true;
                }
            }
            if (typeof stateValue === typeof optionValue && optionValue !== baseline[key]) {
                return true;
            }
        }
    }
    return false;
}
export function diff(target: any, option: any): boolean {
    if (target === undefined && option === undefined) {
        return false;
    }
    if (target === undefined || option === undefined) {
        return true;
    }
    return !Object.entries(target).every(([k, v]) => deepEquals(option[k], v));
}
export function requireNumber(object: any, message: string) {
    if (typeof object !== 'number') throw new Error(message || 'Require a number!');
}
export function requireObject(object: unknown, message?: string): asserts object is object {
    if (typeof object !== 'object') throw new Error(message || 'Require a object!');
}
export function requireString(object: unknown, message?: any): asserts object is string {
    if (typeof object !== 'string') throw new Error(message || `Require a string! But get ${typeof object} ${JSON.stringify(object)}`);
}
export function requireBool(object: unknown, message?: any): asserts object is boolean {
    if (typeof object !== 'boolean') throw new Error(message || `Require a boolean! But get ${typeof object} ${JSON.stringify(object)}`);
}
export function requireNonnull(object: unknown, message?: any): asserts object {
    if (typeof object === 'undefined' || object === null) throw new Error(message || 'Require object existed!');
}
export function requireType(object: any, type: any, message: any) {
    if (!(object instanceof type)) {
        throw new Error(message || `Require object ${object} be the type ${type}`);
    }
}
export function fitin(state: any, option: any) {
    if (isNullOrUndefine(option)) return;
    for (const key of Object.keys(option)) {
        const stateValue = state[key];
        const optionValue = option[key];

        if (!isNullOrUndefine(optionValue)) {
            const expectType = typeof stateValue;
            if (expectType === 'object') {
                if (stateValue instanceof Array
                    && optionValue instanceof Array) {
                    state[key] = optionValue;
                } else if (typeof optionValue === 'object') {
                    fitin(stateValue, optionValue);
                }
                // eslint-disable-next-line valid-typeof
            } else if (expectType === typeof optionValue) {
                state[key] = optionValue;
            }
        }
    }
}
