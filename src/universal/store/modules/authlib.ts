import { ModuleOption } from "../root";

interface Actions {
    ensureAuthlibInjection: () => string;
    doesAuthlibInjectionExisted: () => boolean;
}

export type AuthLibModule = ModuleOption<{}, {}, {}, Actions>;

export default {};
