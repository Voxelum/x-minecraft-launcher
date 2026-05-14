<template>
  <v-dialog
    v-model="isShown"
    :width="addService ? 700 : 500"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <!-- Login Window Container -->
    <div
      class="flex flex-col w-full transition-all duration-300"
      :class="addService ? 'h-[80vh] max-h-[800px]' : 'h-[680px]'"
    >
      <transition name="fade-transition" mode="out-in">
        <div
          v-if="addService"
          :key="2"
          class="w-full h-full flex flex-col overflow-hidden"
        >
          <UserCardAddYggdrasilService
            class="w-full flex-1 min-h-0"
            @back="onBackFromAddService"
          />
        </div>
        <div
          v-else
          :key="1"
          class="flex flex-col w-full h-full relative overflow-y-auto invisible-scroll"
        >
            <div
              class="w-full h-full flex justify-center items-start pt-6 px-6 pb-6"
            >
              <UserLoginForm
                :inside="false"
                :options="options"
                class="w-full max-w-md h-full"
                @login="onLogin()"
                @add-service="onAddService"
              />
            </div>
          </div>
      </transition>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import UserCardAddYggdrasilService from "./UserCardAddYggdrasilService.vue";
import UserLoginForm from "./UserLoginForm.vue";

const props = defineProps<{ value: boolean }>();
const emit = defineEmits(["input"]);

const isShown = computed({
  get: () => props.value,
  set: (val) => emit("input", val),
});


const options = ref(undefined as any);
const addService = ref(false);

const onLogin = () => {
  options.value = undefined;
  isShown.value = false;
};

const onAddService = () => {
  addService.value = true;
};

const onBackFromAddService = () => {
  addService.value = false;
};

watch(isShown, (v) => {
  if (!v) {
    addService.value = false;
    options.value = undefined;
  }
});
</script>

