import { PropType, PropOptions } from '@vue/composition-api';

export function required<T>(type: PropType<T>) {
    return { type, required: true } as const;
}

export function withDefault<T>(type: PropType<T>, defaultValue: (() => T)) {
    return { type, default: defaultValue } as const;
}
