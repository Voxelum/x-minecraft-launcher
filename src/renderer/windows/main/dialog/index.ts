import { defineComponent, createElement as h } from '@vue/composition-api';

const files = require.context('.', false, /\.vue$/);

const components = files.keys().map((key) => {
    const name = key.replace(/(\.\/|\.vue)/g, '');
    const aCode = 'A'.charCodeAt(0);
    const zCode = 'Z'.charCodeAt(0);
    let realName = '';

    for (let i = 0; i < name.length; ++i) {
        const c = name.charCodeAt(i);
        if (c >= aCode && c <= zCode) {
            if (i !== 0) {
                realName += `-${name.charAt(i).toLowerCase()}`;
            } else {
                realName += name.charAt(i).toLowerCase();
            }
        } else {
            realName += name.charAt(i);
        }
    }

    const comp = files(key).default;
    return { [realName]: comp };
}).reduce((obj, v) => Object.assign(obj, v), {});

export default defineComponent({
    components,
    setup() {
        return () => h('div', { staticStyle: { 'z-index': 10 } }, components.map(c => h(c)));
    },
});
