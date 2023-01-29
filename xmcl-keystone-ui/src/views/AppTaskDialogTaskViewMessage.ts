import { defineComponent, h } from 'vue'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import { required } from '@/util/props'
import { useLocaleError } from '@/composables/error'

export default defineComponent({
  props: {
    value: required<string | object>([String, Object]),
  },
  setup(props, context) {
    const { t } = useI18n()
    const { showItemInDirectory } = useService(BaseServiceKey)
    const tError = useLocaleError()
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
              h('a', { attrs: { }, on: { click() { showItemInDirectory(m.description) } } }, m.destination),
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
        if (m.name === 'SocketError' || m.code === 'ECONNRESET') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            t('errors.SocketError'),
          ])
        }
        if (m.name === 'HTTPException') {
          return h('div', [
            tError(m),
          ])
        }
        if (m.name === 'ResponseStatusCodeError') {
          const url = m.options ? new URL(m.options.path, m.options.origin).toString() : m.url ?? ''
          return h('div', [
            h('div', ['🔗 ', h('a', { attrs: { href: url } }, url)]),
            `HTTP ${m.status}`,
          ])
        }
        if (m.name === 'DownloadAbortError') {
          return h('div')
        }
        if (m.name === 'MultipleError') {
          return h('div')
        }
        if (m.name === 'Error' && typeof m.message === 'string') {
          return h('div', m.message)
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
