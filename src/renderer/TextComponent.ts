import { TextComponent } from '@xmcl/minecraft-launcher-core';
import { createComponent, createElement } from '@vue/composition-api';

const colorCode = new Array<number>(32);
for (let i = 0; i < 32; i += 1) {
    const j = ((i >> 3) & 1) * 85; // eslint-disable-line no-bitwise
    let k = (((i >> 2) & 1) * 170) + j; // eslint-disable-line no-bitwise
    let l = (((i >> 1) & 1) * 170) + j; // eslint-disable-line no-bitwise
    let i1 = ((i & 1) * 170) + j; // eslint-disable-line no-bitwise
    if (i === 6) k += 85;
    if (i >= 16) {
        k /= 4;
        l /= 4;
        i1 /= 4;
    }
    colorCode[i] = ((k & 255) << 16) | ((l & 255) << 8) | (i1 & 255); // eslint-disable-line no-bitwise
}

function itr(comp: any) {
    const arr = [comp];
    if (comp._siblings.length !== 0) {
        for (const s of comp._siblings) {
            arr.push(...itr(s));
        }
    }
    return arr;
}

export default createComponent({
    props: {
        source: TextComponent,
        localized: String,
        args: { type: Object, default: () => { Object.create(null); } },
        styled: { type: String, default: 'true' },
    },
    setup({ source, styled }, context) {
        const arr = [];
        if (!source) return createElement('div');
        const src: TextComponent = source as any;
        let iterator;
        if (typeof src === 'string') {
            iterator = TextComponent.from(src).iterator;
            // iterator = TextComponent.from(context.root.$t(src, args)).iterator;
        } else if ('iterator' in src) {
            iterator = src.iterator;
        } else if ((src as any)._siblings) {
            iterator = itr(src);
        }
        if (iterator) {
            for (const component of iterator) {
                const attrs: any = {};
                if (styled === 'true') {
                    let style = '';
                    if (component.style.bold) style += 'font-weight:bold;';
                    if (component.style.underlined) style += 'text-decoration:underline;';
                    if (component.style.italic) style += 'font-style:italic;';
                    if (component.style.strikethrough) style += 'text-decoration:line-through;';
                    if (component.style.color) {
                        const code = colorCode[component.style.color.colorIndex];
                        if (code !== undefined) {
                            const r = (code >> 16); // eslint-disable-line no-bitwise
                            const g = ((code >> 8) & 255); // eslint-disable-line no-bitwise
                            const b = (code & 255);// eslint-disable-line no-bitwise
                            style += `color: rgb(${r}, ${g}, ${b});`;
                        }
                    }
                    attrs.style = style;
                }
                arr.push(createElement('span', {
                    attrs,
                }, [component.unformatted]));
            }
        }
        return createElement('p', {}, arr);
    }
});

