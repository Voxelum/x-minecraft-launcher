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
          return h('div', [
            h('div', [
              h('span', { staticClass: 'font-bold' }, [
                '🚷 ',
                t('errors.DownloadAggregateError'),
              ]),
              '📁 ',
              h('a', { attrs: { href: `file-link:///${m.destination}` } }, m.destination),
            ]),
            ...m.errors.map(resolve),
          ])
        }
        if (m.name === 'ChecksumNotMatchError') {
          return h('div', { staticClass: 'border-l pl-2' }, [
            h('div', ['🔗 ', h('a', { attrs: { href: m.url } }, m.url)]),
            '📌 ',
            t('errors.ChecksumNotMatchError', { expect: m.expect, actual: m.actual }),
          ])
        }
        if (m.name === 'HeadersTimeoutError') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            t('errors.HeadersTimeoutError'),
          ])
        }
        if (m.name === 'ConnectTimeoutError') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            t('errors.ConnectTimeoutError'),
          ])
        }
        if (m.name === 'BodyTimeoutError') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            t('errors.BodyTimeoutError'),
          ])
        }
        if (m.name === 'SocketError') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            t('errors.SocketError'),
          ])
        }
        if (m.name === 'DownloadAbortError') {
          return h('div')
        }
        if (m.name === 'MultipleError') {
          return h('div')
        }
        return h('div', m.name)
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
