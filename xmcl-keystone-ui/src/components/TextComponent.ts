import { TextComponent, render, RenderNode, fromFormattedString } from '@xmcl/text-component'
import { defineComponent, h } from '@vue/composition-api'
import { useI18n } from '../composables'
import { optional, required, withDefault } from '../util/props'

export default defineComponent({
  props: {
    source: required<string | TextComponent>([String, Object]),
    localized: optional(String),
    args: withDefault(Object, () => Object.create(null)),
    styled: withDefault(String, () => 'true'),
    editable: withDefault(Boolean, () => false),
  },
  setup(props, context) {
    const { $t } = useI18n()
    return () => {
      if (!props.source) return h('div')

      let src = typeof props.source === 'string' ? fromFormattedString($t(props.source)) : props.source
      if (props.source && typeof props.source === 'object' && props.source.text && Object.keys(props.source).length === 1) {
        src = fromFormattedString($t(props.source.text))
      }
      const hint = render(src)
      const simpleText = hint.children.length === 0
      function generate(node: RenderNode): ReturnType<typeof h> {
        return h('span', {
          style: node.style,
          attrs: { contenteditable: props.editable && simpleText },
          on: {
            input: (e: InputEvent) => {
              if (simpleText && e.target instanceof HTMLElement) {
                context.emit('edit', e.target.innerText)
              }
            },
          },
        }, [$t(node.component.text), node.children.map(generate)])
      }
      return generate(hint)
    }
  },
})
