import { createI18n } from '/@main/util/i18n'
import en from './en.json'
import zh from './zh-CN.json'
import ru from './ru.json'

export default createI18n({ en, 'zh-CN': zh, ru }, 'en')
