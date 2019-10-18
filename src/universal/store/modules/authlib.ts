import { Module, Context } from "..";

type C = Context<{}, {}>;

interface Actions {
    doesAuthlibInjectionExisted(context: C): Promise<boolean>;
    ensureAuthlibInjection(context: C): Promise<string>;
}

export type AuthLibModule = Module<"authlib", {}, {}, {}, Actions>;
export default {};