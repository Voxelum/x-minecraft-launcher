import { InjectionKey } from '@vue/composition-api'
import Vuetify, { Framework } from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'
import CurseforgeIcon from '/@/components/CurseforgeIcon.vue'
import FabricIcon from '/@/components/FabricIcon.vue'
import ForgeIcon from '/@/components/ForgeIcon.vue'
import JarFileIcon from '/@/components/JarFileIcon.vue'
import ModrinthIcon from '/@/components/ModrinthIcon.vue'
import PackageFileIcon from '/@/components/PackageFileIcon.vue'
import ZipFileIcon from '/@/components/ZipFileIcon.vue'
import zhHans from 'vuetify/src/locale/zh-Hans'
import ru from 'vuetify/src/locale/ru'

const vuetify = new Vuetify({
  lang: {
    locales: {
      zhHans,
      ru,
    },
    current: 'en',
  },
  icons: {
    iconfont: 'md',
    values: {
      curseforge: {
        component: CurseforgeIcon,
      },
      zip: {
        component: ZipFileIcon,
      },
      jar: {
        component: JarFileIcon,
      },
      package: {
        component: PackageFileIcon,
      },
      modrinth: {
        component: ModrinthIcon,
      },
      forge: {
        component: ForgeIcon,
      },
      fabric: {
        component: FabricIcon,
      },
    },
  },
  theme: {
    themes: {
      dark: {
        primary: colors.green,
        accent: colors.green.accent3,
      },
    },
  },
})

export default vuetify
