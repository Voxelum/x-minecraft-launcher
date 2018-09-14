function mix(target, src) {
    for (const key in target) {
        if (target.hasOwnProperty(key) && src.hasOwnProperty(key)) {
            if (typeof target[key] === 'object' && typeof src[key] === 'object') {
                if (target[key] instanceof Array) {
                    target[key] = src[key];
                } else {
                    mix(target[key], src[key]);
                }
            } else {
                target[key] = src[key];
            }
        }
    }
}
export function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
}
function flat(state) {
    if (state === undefined) throw new Error('Cannot flat undefined');
    if (typeof state === 'function') return state();
    return copy(state);
}
export default function mixin(template, option) {
    const state = flat(template.state);
    if (option) mix(state, option);

    const storeOption$ = Object.assign({}, template);
    storeOption$.state = state;

    if (template.modules) { // try mixin sub-modules' states 
        for (const moduleId in template.modules) {
            if (template.modules.hasOwnProperty(moduleId)) {
                const subState = template.modules[moduleId].state;
                if (option[moduleId] && typeof option[moduleId] === 'object' && subState !== undefined) {
                    const flated = flat(subState);
                    mix(flated, option[moduleId]);
                    storeOption$.modules[moduleId].state = flated;
                }
            }
        }
    }

    return storeOption$;
}
