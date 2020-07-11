import Vue, { VueConstructor } from 'vue';
import VueCompositionApi, { h } from '@vue/composition-api';

Vue.use(VueCompositionApi);

export * from '@vue/composition-api';
export const nextTick = Vue.nextTick;

export const remove = Vue.delete;
export const set = Vue.set;

export { h };

export type App = VueConstructor;

type ConstructorWrap<X> = X extends (new (param: infer P) => infer T) ? (param: P) => T : never;

export const createApp: ConstructorWrap<typeof Vue> = (p) => new Vue(p);
