<template>
  <v-treeview
    v-model="tree"
    :open="open"
    :items="items"
    activatable
    item-key="name"
    open-on-click
    hoverable
  >
    <template #prepend="{ item, open }">
      <v-icon
        v-if="!item.file"
        :color="item.diff ? 'green lighten-2' : ''"
      >
        {{ open ? 'folder_open' : 'folder' }}
      </v-icon>
      <v-icon
        v-else
        :color="item.diff ? 'green lighten-2' : ''"
      >
        {{ files[item.file] }}
      </v-icon>
    </template>
    <template #label="{ item }">
      <span :class="{ diff: item.diff }">{{ item.name }}</span>
    </template>
    <template #append=" { item } ">
      <span
        style="padding-right: 10px;"
        :class="{ diff: item.diff }"
      >{{ item.id ? $t(`intro.struct.${item.id}`) : '' }}</span>
    </template>
  </v-treeview>
</template>

<script lang=ts>
export default {
  props: {
    value: {
      type: Boolean,
      default: () => false,
    },
  },
  data: () => ({
    e1: 0,
    open: ['.minecraft'],
    hovered: {},
    files: {
      jar: 'archive',
      liteloader: 'archive',
      zip: 'archive',
      json: 'description',
      txt: 'description',
    },
    tree: [],
    items: [
      {
        name: '.minecraft',
        id: 'root',
        children: [
          {
            name: 'assets',
            id: 'assets',
          },
          {
            name: 'libraries',
            id: 'libraries',
          },
          {
            name: 'versions',
            id: 'versions',
          },
          {
            name: 'logs',
            id: 'mclogs',
          },
          {
            name: 'mods',
            id: 'mods',
            children: [
              {
                name: '<some-forge-mod>.jar',
                id: 'modJar',
                file: 'jar',
              },
              {
                name: '<some-liteloader-mod>.liteloader',
                id: 'modLite',
                file: 'liteloader',
              },
            ],
          },
          {
            name: 'resourcepacks',
            id: 'resourcepacks',
            children: [
              {
                name: '<some-resource-pack>.zip',
                id: 'resourcepack',
                file: 'zip',
              },
            ],
          },
        ],
      },
    ],
  }),
  watch: {
  },
}
</script>

<style>
.diff {
  color: #81c784;
  font-style: italic;
}
</style>
