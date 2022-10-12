import { defineComponent, h } from '@vue/composition-api'
import { useI18n } from '/@/composables'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    value: required<string | object>([String, Object]),
  },
  setup(props, context) {
    const { t } = useI18n()
    return () => {
      const resolve = (m: any) => {
        if (m.name === 'DownloadAggregateError') {
          return h('div', { staticClass: 'text-red' }, [
            h('div', `${m.urls}`),
            ...m.errors.map(resolve),
          ])
        }
        if (m.name === 'ChecksumNotMatchError') {
          return h('div', `Checksum not match. Expect ${m.expect}. Actual ${m.actual}`)
        }
        return h('div', '')
      }
      if (typeof props.value === 'string') {
        return h('div', [props.value])
      } else if (props.value instanceof Array) {
        return h('div', props.value.map(resolve))
      } else {
        return resolve(props.value)
      }
    }
  },
})
