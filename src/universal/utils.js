export function aStr(a) {
    if (typeof a !== 'string') throw new Error('Require String');
}

export function aNum(a) {
    if (typeof a !== 'number') throw new Error('Require Number');
}

export function aBool(a) {
    if (typeof a !== 'boolean') throw new Error('Require Boolean');
}

export function aStrArr(a) {
    if (!(a instanceof Array)) throw new Error('Require String Array');
    for (const i of a) if (typeof i !== 'string') throw new Error('Require String Array');
}

export function aInstance(a, instance) {
    if (!(a instanceof instance)) throw new Error(`Require ${instance}`);
}

