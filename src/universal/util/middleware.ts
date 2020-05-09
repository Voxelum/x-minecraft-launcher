import Vue from 'vue';

export function remove(container: any, key: string | number) {
    Vue.delete(container, key);
}

export function set(container: any, key: string | number) {
    Vue.set(container, key, container[key]);
}
