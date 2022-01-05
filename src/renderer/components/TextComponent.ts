import { TextComponent, render, RenderNode, fromFormattedString } from '@xmcl/text-component'
import { defineComponent, h } from '@vue/composition-api'
import { useI18n } from '../hooks'
import { optional, withDefault } from '../util/props'

export default defineComponent({
  props: {
    source: [String, Object],
    localized: optional(String),
    args: { type: Object, default: () => { Object.create(null) } },
    styled: { type: String, default: 'true' },
    editable: withDefault(Boolean, () => false)
  },
  setup(props, context) {
    const { $t } = useI18n()
    return () => {
      if (!props.source) return h('div')

      let src = typeof props.source === 'string' ? fromFormattedString($t(props.source)) : props.source as TextComponent
      if (props.source && props.source.text && Object.keys(props.source).length === 1) {
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
              if (simpleText) {
                context.emit('edit', e.target.innerText)
              }
            } 
          }
        }, [$t(node.component.text), node.children.map(generate)])
      }
      return generate(hint)
    }
  },
})
