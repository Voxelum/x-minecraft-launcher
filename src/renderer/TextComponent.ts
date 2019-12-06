import { TextComponentFrame, TextComponent } from '@xmcl/minecraft-launcher-core';
import { createComponent, createElement } from '@vue/composition-api';
import { useI18n } from './hooks';

export default createComponent({
    props: {
        source: Object,
        localized: String,
        args: { type: Object, default: () => { Object.create(null); } },
        styled: { type: String, default: 'true' },
    },
    setup(props, context) {
        const { t } = useI18n();
        return () => {
            if (!props.source) return createElement('div');
            const src = props.source as TextComponentFrame;
            const hint = TextComponent.render(TextComponent.from(src));
            function generate(node: TextComponent.RenderNode): ReturnType<typeof createElement> {
                return createElement('span', { attrs: { style: node.style } }, [t(node.text), node.children.map(generate)]);
            }
            return generate(hint);
        };
    },
});
