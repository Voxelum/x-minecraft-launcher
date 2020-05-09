import { VueConstructor } from 'vue';
import Vuetify from 'vuetify';
import colors from 'vuetify/es5/util/colors';
import 'vuetify/dist/vuetify.css';
import '@/assets/google.font.css';

export function useVuetify(app: VueConstructor) {
    app.app(Vuetify, {
        icons: {
            curseforge: {
                component: CurseforgeIcon,
            },
        },
        theme: {
            primary: colors.green,
            // secondary: colors.green,
            accent: colors.green.accent3,
        },
    });
}
