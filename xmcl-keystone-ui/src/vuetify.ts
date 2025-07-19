import CurseforgeIcon from '@/components/CurseforgeIcon.vue'
import FTBIcon from '@/components/FTBIcon.vue'
import ImageIcon from '@/components/ImageIcon.vue'
import JarFileIcon from '@/components/JarFileIcon.vue'
import ModrinthIcon from '@/components/ModrinthIcon.vue'
import PackageFileIcon from '@/components/PackageFileIcon.vue'
import ZipFileIcon from '@/components/ZipFileIcon.vue'
import { IconProps, IconSet, createVuetify } from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import { aliases, md } from 'vuetify/iconsets/md'
import ru from 'vuetify/lib/locale/ru'
import zhHans from 'vuetify/lib/locale/zh-Hans'
import { BuiltinImages } from './constant'

const xmcl: IconSet = {
  component: (props: IconProps) => {
    if (props.icon === 'ftb') return h(FTBIcon)
    if (props.icon === 'curseforge') return h(CurseforgeIcon)
    if (props.icon === 'zip') return h(ZipFileIcon)
    if (props.icon === 'jar') return h(JarFileIcon)
    if (props.icon === 'package') return h(PackageFileIcon)
    if (props.icon === 'modrinth') return h(ModrinthIcon)
    if (props.icon === 'forge') return h('img', { src: BuiltinImages.forge })
    if (props.icon === 'fabric') return h('img', { src: BuiltinImages.fabric })
    if (props.icon === 'quilt') return h('img', { src: BuiltinImages.quilt })
    if (props.icon === 'minecraft') return h(ImageIcon, { src: BuiltinImages.minecraft })
    if (props.icon === 'neoForged') return h(ImageIcon, { src: BuiltinImages.neoForged })
    if (props.icon === 'ftb') return h(FTBIcon)
    if (props.icon === 'optifine') return h(ImageIcon)
    if (props.icon === 'iris') return h(ImageIcon)
    return null
  },
}
export const vuetify = createVuetify({
  locale: {
    messages: {
      zhHans,
      ru,
    },
    locale: 'en',
  },
  icons: {
    // values: {
    //   ftb: {
    //     component: FTBIcon,
    //   },
    //   curseforge: {
    //     component: CurseforgeIcon,
    //   },
    //   minecraft: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.minecraft,
    //     },
    //   },
    //   zip: {
    //     component: ZipFileIcon,
    //   },
    //   jar: {
    //     component: JarFileIcon,
    //   },
    //   package: {
    //     component: PackageFileIcon,
    //   },
    //   modrinth: {
    //     component: ModrinthIcon,
    //   },
    //   forge: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.forge,
    //     },
    //   },
    //   fabric: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.fabric,
    //     },
    //   },
    //   quilt: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.quilt,
    //     },
    //   },
    //   neoForged: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.neoForged,
    //     },
    //   },
    //   optifine: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.optifine,
    //     },
    //   },
    //   iris: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.iris,
    //     },
    //   },
    //   oculus: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.oculus,
    //     },
    //   },
    //   mmc: {
    //     component: ImageIcon,
    //     props: {
    //       src: BuiltinImages.mmc,
    //     },
    //   },
    // },
    defaultSet: 'md',
    aliases,
    sets: {
      md,
      xmcl,
    },
  },
  theme: {
    themes: {
      light: {},
      system: {},
      dark: {
        dark: true,
        colors: {
          primary: '#4caf50',
          accent: '#00e676',
        },
      },
    },
  },
})
