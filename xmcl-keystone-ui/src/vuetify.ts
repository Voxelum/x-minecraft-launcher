import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import FTBIcon from '@/components/FTBIcon.vue'
import ImageIcon from '@/components/ImageIcon.vue'
import JarFileIcon from '@/components/JarFileIcon.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import PackageFileIcon from '@/components/PackageFileIcon.vue'
import ZipFileIcon from '@/components/ZipFileIcon.vue'
import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'
import ru from 'vuetify/src/locale/ru'
import zhHans from 'vuetify/src/locale/zh-Hans'
import { BuiltinImages } from './constant'

Vue.use(Vuetify)

export const vuetify = new Vuetify({
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
      ftb: {
        component: FTBIcon,
      },
      curseforge: {
        component: CurseforgeIcon,
      },
      minecraft: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.minecraft,
        },
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
        component: ImageIcon,
        props: {
          src: BuiltinImages.forge,
        },
      },
      fabric: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.fabric,
        },
      },
      quilt: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.quilt,
        },
      },
      neoForged: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.neoForged,
        },
      },
      optifine: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.optifine,
        },
      },
      iris: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.iris,
        },
      },
      mmc: {
        component: ImageIcon,
        props: {
          src: BuiltinImages.mmc,
        },
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
