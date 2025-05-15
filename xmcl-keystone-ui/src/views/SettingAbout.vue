<template>
  <section class="mb-5 about">
    <v-subheader>
      {{ t('setting.about') }}
    </v-subheader>

    <v-card flat class="mb-6 card">
      <v-card-title class="d-flex align-center">
        <v-img 
          src="/icons/dark@256x256.png" 
          alt="XMCL Logo" 
          max-width="64" 
          class="mr-4"
        ></v-img>
        <div>
          <div class="text-h5">X Minecraft Launcher</div>
          <div class="text-subtitle-1">{{ t('setting.version') }} {{ version }}</div>
        </div>
      </v-card-title>

      <v-card-text>
        <v-subheader>{{ t('setting.links') }}</v-subheader>
        <v-btn
          text
          color="primary"
          href="https://xmcl.app"
          target="_blank"
          class="mr-2"
        >
          <v-icon left>public</v-icon>
          {{ t('setting.website') }}
        </v-btn>
        <v-btn
          text
          color="primary"
          href="https://github.com/Voxelum/x-minecraft-launcher"
          target="_blank"
          class="mr-2"
        >
          <v-icon left>code</v-icon>
          GitHub
        </v-btn>
        <v-btn
          text
          color="primary"
          href="https://discord.gg/W5XVwYY7GQ"
          target="_blank"
          class="mr-2"
        >
          <v-icon left>chat</v-icon>
          Discord
        </v-btn>
        <v-btn
          text
          color="primary"
          href="https://kook.top/gqjSHh"
          target="_blank"
        >
          <v-icon left>chat</v-icon>
          Kook
        </v-btn>

        <v-subheader>{{ t('setting.sponsors') }}</v-subheader>
        <div class="sponsors">
          <div>
            <a href="https://signpath.io/" target="_blank" class="mr-4">
              <v-btn
              text
              color="primary"
              class="mb-2"
            >
              <v-icon left>verified</v-icon>
                SignPath.io
              </v-btn>
            </a>
            <div class="text-caption mb-4">{{ t('setting.sponsorSignPath') }}</div>
          </div>
          
          <div>
            <a href="https://deno.com/deploy" target="_blank" class="mr-4">
              <v-img
                src="https://deno.com/images/deno_logo_4.gif"
                max-width="120"
                contain
                class="mb-2"
              ></v-img>
            </a>
            <div class="text-caption mb-4">{{ t('setting.sponsorDeno') }}</div>
          </div>
            
          <div>
            <a href="https://bmcl.dev" target="_blank" class="mr-4">
              <v-btn
                text
                color="primary"
                class="mb-2"
              >
                <v-icon left>api</v-icon>
                BMCL API
              </v-btn>
            </a>
            <div class="text-caption mb-4">{{ t('setting.sponsorBmcl') }}</div>
          </div>
        </div>

        <v-subheader>{{ t('setting.supportUs') }}</v-subheader>
        <v-btn
          text
          color="primary"
          href="https://afdian.com/@ci010"
          target="_blank"
          class="mr-2"
        >
          <v-icon left>payment</v-icon>
          {{ t('setting.donateAfdian') }}
        </v-btn>
        <v-btn
          text
          color="primary"
          href="https://patreon.com/xmcl"
          target="_blank"
          class="mr-2"
        >
          <v-icon left>payment</v-icon>
          {{ t('setting.donatePatreon') }}
        </v-btn>

        <div class="mt-4">
          <div class="text-body-2 font-weight-medium">LICENSE</div>
          <div class="text-caption">MIT</div>
        </div>
      </v-card-text>
    </v-card>
  </section>
</template>

<script lang="ts" setup>
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'

const env = injection(kEnvironment)

const { t } = useI18n()
const version = computed(() => env.value?.version ?? '')
</script>
<style scoped>
@media (min-width: 1660px) {
  .about {
    grid-column: span 2 / span 2;
  }

  .card {
    display: flex;
    gap: 2rem;
  }

  .sponsors {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>