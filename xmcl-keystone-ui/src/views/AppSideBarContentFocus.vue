<template>
  <div class="h-full overflow-auto">
    <v-list
      nav
      dense
      class="ml-1 flex flex-grow-0 flex-col justify-start overflow-auto px-2"
    >
      <v-list-item
        v-shared-tooltip.right="_ => t('home', 2)"
        link
        push
        to="/"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon>
            home
          </v-icon>
        </v-list-item-icon>

        <v-list-item-title v-text="'Text'" />
      </v-list-item>
      <v-list-item
        v-shared-tooltip.right="_ => t('mod.name', 2)"
        link
        push
        to="/mods"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon>
            extension
          </v-icon>
        </v-list-item-icon>

        <v-list-item-title v-text="'Text'" />
      </v-list-item>
      <v-list-item
        v-shared-tooltip.right="_ => t('resourcepack.name', 2)"
        link
        push
        to="/resourcepacks"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon> palette </v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="'Text'" />
      </v-list-item>
      <v-list-item
        v-shared-tooltip.right="_ => t('shaderPack.name', 2)"
        link
        push
        to="/shaderpacks"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon> gradient </v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="'Text'" />
      </v-list-item>
      <v-divider />

      <v-list-item
        id="create-game-button"
        v-shared-tooltip.right="_ => t('AppAddInstanceDialog.createTitle')"
        class="non-moveable"
        @click="showAddInstance()"
      >
        <v-list-item-icon>
          <v-icon>add</v-icon>
        </v-list-item-icon>
        <v-list-item-title>Instances</v-list-item-title>
      </v-list-item>
      <v-spacer />
    </v-list>
  </div>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const router = useRouter()
const expanding = ref(false)
const subRoutes = new Set([
  '/',
  '/base-setting',
  '/mods',
  '/resourcepacks',
  '/shaderpacks',
])
expanding.value = subRoutes.has(router.currentRoute.fullPath)

router.afterEach((to) => {
  if (!subRoutes.has(to.fullPath)) {
    expanding.value = false
  } else {
    expanding.value = true
  }
})
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { t } = useI18n()
</script>
