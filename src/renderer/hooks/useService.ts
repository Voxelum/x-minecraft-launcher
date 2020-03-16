import { BuiltinServices } from '@main/service';
import { SERVICES_KEY } from '@/constant';
import { inject } from '@vue/composition-api';

export function useServices(): BuiltinServices {
    const seriv = inject(SERVICES_KEY);
    if (!seriv) throw new Error('Cannot find Services. Maybe it is not loaded?');
    return seriv;
}

export function useService<N extends keyof BuiltinServices>(name: N): BuiltinServices[N] {
    return useServices()[name];
}

export function useServiceOnly<N extends keyof BuiltinServices, T extends keyof BuiltinServices[N]>(name: N, ...keys: T[]): Pick<BuiltinServices[N], T> {
    return useServices()[name];
}
