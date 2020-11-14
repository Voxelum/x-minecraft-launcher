<template>
  <v-tooltip :close-delay="0" right>
    <template v-slot:activator="{ on }">
      <v-speed-dial
        open-on-hover
        class="more-button"
        direction="top"
        transition="slide-y-reverse-transition"
      >
        <template v-slot:activator>
          <v-btn
            flat
            icon
            to="/base-setting"
            dark
            :loading="refreshing"
            v-on="on"
            @click="$emit('show', 'normal')"
          >
            <v-icon dark>more_vert</v-icon>
          </v-btn>
        </template>
        <v-btn
          flat
          icon
          dark
          :loading="refreshing"
          to="/advanced-setting"
          v-on="on"
          @mouseenter="enter($t('profile.launchingDetail'))"
        >
          <v-icon dark>settings_applications</v-icon>
        </v-btn>
        <v-btn
          flat
          icon
          dark
          :loading="refreshing"
          to="/mod-setting"
          v-on="on"
          @mouseenter="enter($tc('mod.name', 2) )"
        >
          <v-icon dark style="margin-left: 24px">extensions</v-icon>
        </v-btn>
        <v-btn
          flat
          icon
          dark
          :loading="refreshing"
          to="/resource-pack-setting"
          v-on="on"
          @click="$emit('show', 'resourcepacks')"
          @mouseenter="enter($tc('resourcepack.name', 2) )"
        >
          <v-icon dark>palette</v-icon>
        </v-btn>
        <v-btn
          flat
          icon
          dark
          :loading="refreshing"
          to="/save"
          v-on="on"
          @click="$emit('show', 'saves')"
          @mouseenter="enter($tc('save.name', 2) )"
        >
          <v-icon dark>map</v-icon>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ text }}
  </v-tooltip>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs } from '@vue/composition-api';
import { useI18n } from '@/hooks';

export default defineComponent({
  props: {
    refreshing: Boolean,
  },
  setup() {
    const { $t } = useI18n();
    const data = reactive({ text: $t('profile.modpack.export') });
    const enter = (text: string) => {
      setTimeout(() => { data.text = text; }, 100);
    };
    return {
      ...toRefs(data),
      enter,
    };
  },
});
</script>
