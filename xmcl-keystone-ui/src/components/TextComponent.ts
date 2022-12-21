import { TextComponent, render, RenderNode, fromFormattedString } from '@xmcl/text-component'
import { defineComponent, h } from 'vue'

import { optional, required, withDefault } from '../util/props'

export default defineComponent({
  props: {
    source: required<string | TextComponent>([String, Object]),
    args: withDefault(Object, () => Object.create(null)),
    styled: withDefault(String, () => 'true'),
    editable: withDefault(Boolean, () => false),
    localize: withDefault(Boolean, () => false),
  },
  setup(props, context) {
    const { t } = useI18n()
    return () => {
      if (!props.source) return h('div')

      let src = typeof props.source === 'string' ? fromFormattedString(props.localize ? t(props.source) : props.source) : props.source
      if (props.source && typeof props.source === 'object' && props.source.text && Object.keys(props.source).length === 1) {
        src = fromFormattedString(props.localize ? t(props.source.text) : props.source.text)
      }
      const hint = render(src)
      const simpleText = hint.children.length === 0
      function generate(node: RenderNode): ReturnType<typeof h> {
        return h('span', {
          style: node.style as any,
          attrs: { contenteditable: props.editable && simpleText },
          on: {
            input: (e: InputEvent) => {
              if (simpleText && e.target instanceof HTMLElement) {
                context.emit('edit', e.target.innerText)
              }
            },
          },
        }, [props.localize ? t(node.component.text) : node.component.text, node.children.map(generate)])
      }
      return generate(hint)
    }
  },
})
