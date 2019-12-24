import { TextComponent, render, RenderNode } from '@xmcl/text-component';
import { createComponent, createElement } from '@vue/composition-api';
import { useI18n } from './hooks';

export default createComponent({
    props: {
        source: Object,
        localized: String,
        args: { type: Object, default: () => { Object.create(null); } },
        styled: { type: String, default: 'true' },
    },
    setup(props) {
        const { $t } = useI18n();
        return () => {
            if (!props.source) return createElement('div');
            const src = props.source as TextComponent;
            const hint = render(src);
            function generate(node: RenderNode): ReturnType<typeof createElement> {
                return createElement('span', { style: node.style }, [$t(node.component.text), node.children.map(generate)]);
            }
            return generate(hint);
        };
    },
});
