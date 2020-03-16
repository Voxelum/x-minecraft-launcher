import { isNullOrUndefine } from './assert';

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
export function diff(target: any, option: any): boolean {
    if (target === undefined && option === undefined) {
        return false;
    }
    if (target === undefined || option === undefined) {
        return true;
    }
    return !Object.entries(target).every(([k, v]) => deepEquals(option[k], v));
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
export function shouldPatch(original: any, patch: any): boolean {
    if (isNullOrUndefine(patch)) return false;
    for (const key of Object.keys(patch)) {
        const oValue = original[key];
        const pValue = patch[key];

        if (isNullOrUndefine(pValue) && !isNullOrUndefine(oValue)) {
            // this mean we try to set to undefined/null
            return true;
        }

        if (typeof oValue === 'object') {
            if (oValue instanceof Array && pValue instanceof Array // two array
                && oValue.some((v, i) => v !== pValue[i])) { // exact same, no
                return true;
            }
            if (shouldPatch(oValue, pValue)) {
                return true;
            }
        } else if (pValue !== original[key]) {
            return true;
        }
    }
    return false;
}
export function mixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            Object.defineProperty(derivedCtor.prototype, name, Object.getOwnPropertyDescriptor(baseCtor.prototype, name)!);
        });
    });
}
