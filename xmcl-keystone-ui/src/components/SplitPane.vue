<template>
  <div
    :style="{ cursor, userSelect }"
    class="vue-splitter-container clearfix"
    @mouseup="onMouseUp"
    @mousemove="onMouseMove"
  >
    <div
      class="splitter-pane splitter-paneL"
      :class="{
        vertical: split === 'vertical',
        horizontal: split === 'horizontal',
      }"
      :style="{
        [data.type]: visibleRight ? data.percent + '%' : '100%',
        display: flexLeft ? 'flex' : 'initial',
        flexDirection: flexLeft ? 'column' : 'initial',
        overflow: flexLeft ? 'auto' : 'initial',
      }"
    >
      <slot name="left" />
    </div>

    <template v-if="visibleRight">
      <div
        class="splitter-pane-resizer"
        :class="{
          vertical: split === 'vertical',
          horizontal: split === 'horizontal'
        }"
        :style="{ [data.resizeType]: data.percent + '%'}"
        @mousedown="onMouseDown"
        @click="onClick"
      />

      <div
        class="splitter-pane splitter-paneR"
        :class="{
          vertical: split === 'vertical',
          horizontal: split === 'horizontal'
        }"
        :style="{ [data.type]: 100 - data.percent + '%'}"
      >
        <slot name="right" />
      </div>
    </template>

    <div
      v-if="data.active"
      class="vue-splitter-container-mask"
    />
  </div>
</template>

<script lang=ts setup>

const props = withDefaults(defineProps<{
  minPercent?: number
  defaultPercent?: number
  split?: 'vertical' | 'horizontal'
  className?: string
  flexLeft?: boolean
  visibleRight?: boolean
}>(), {
  minPercent: 10,
  defaultPercent: 50,
  split: 'vertical',
  className: '',
  flexLeft: false,
  visibleRight: true,
})
const data = reactive({
  active: false,
  hasMoved: false,
  height: null,
  percent: props.defaultPercent,
  type: props.split === 'vertical' ? 'width' : 'height',
  resizeType: props.split === 'vertical' ? 'left' : 'top',
})

const emit = defineEmits(['resize'])
const userSelect = computed(() => data.active ? 'none' : undefined)
const cursor = computed(() => data.active ? (props.split === 'vertical' ? 'col-resize' : 'row-resize') : '')

watch(() => props.defaultPercent, (newValue, oldValue) => {
  data.percent = newValue
})

function onClick() {
  if (!data.hasMoved) {
    data.percent = 50
    emit('resize', data.percent)
  }
}
function onMouseDown() {
  data.active = true
  data.hasMoved = false
}
function onMouseUp() {
  data.active = false
}
function onMouseMove(e: MouseEvent) {
  if (e.buttons === 0 || e.which === 0) {
    data.active = false
  }
  if (data.active) {
    let offset = 0
    let target = e.currentTarget as HTMLElement | undefined
    if (props.split === 'vertical') {
      while (target) {
        offset += target.offsetLeft
        target = target.offsetParent as HTMLElement
      }
    } else {
      while (target) {
        offset += target.offsetTop
        target = target.offsetParent as HTMLElement
      }
    }

    target = e.currentTarget as HTMLElement
    const currentPage = props.split === 'vertical' ? e.pageX : e.pageY
    const targetOffset = props.split === 'vertical' ? target.offsetWidth : target.offsetHeight
    const percent = Math.floor(((currentPage - offset) / targetOffset) * 10000) / 100
    if (percent > props.minPercent && percent < 100 - props.minPercent) {
      data.percent = percent
    }
    emit('resize', data.percent)
    data.hasMoved = true
  }
}
</script>

<style scoped>
.clearfix:after {
  visibility: hidden;
  display: block;
  font-size: 0;
  content: " ";
  clear: both;
  height: 0;
}
.vue-splitter-container {
  height: 100%;
  position: relative;
}
.vue-splitter-container-mask {
  z-index: 9999;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.splitter-pane.vertical.splitter-paneL {
  position: absolute;
  left: 0px;
  height: 100%;
  padding-right: 3px;
}
.splitter-pane.vertical.splitter-paneR {
  position: absolute;
  right: 0px;
  height: 100%;
  padding-left: 3px;
}
.splitter-pane.horizontal.splitter-paneL {
  position: absolute;
  top: 0px;
  width: 100%;
}
.splitter-pane.horizontal.splitter-paneR {
  position: absolute;
  bottom: 0px;
  width: 100%;
  padding-top: 3px;
}

.splitter-pane-resizer {
  -moz-box-sizing: border-box;
  -webkit-box-sizing: border-box;
  box-sizing: border-box;
  background-color: #000;
  position: absolute;
  opacity: .2;
  z-index: 1;
  -moz-background-clip: padding;
  -webkit-background-clip: padding;
  background-clip: padding-box;
}

.dark .splitter-pane-resizer {
  background-color: #fff;
}
.splitter-pane-resizer.horizontal {
  height: 11px;
  margin: -5px 0;
  border-top: 5px solid var(--color-border);
  border-bottom: 5px solid var(--color-border);
  cursor: row-resize;
  width: 100%;
}

.splitter-pane-resizer.vertical {
  width: 11px;
  height: 100%;
  margin-left: -5px;
  border-left: 5px solid var(--color-border);
  border-right: 5px solid var(--color-border);
  cursor: col-resize;
}

.dark .splitter-pane-resizer.vertical:hover, .splitter-pane-resizer.vertical:active {
  border-left: 5px solid hsla(0,0%,100%,.8);
  border-right: 5px solid hsla(0,0%,100%,.8);
}

.dark .splitter-pane-resizer.horizontal:hover, .splitter-pane-resizer.horizontal:active {
  border-top: 5px solid hsla(0,0%,100%,.8);
  border-bottom: 5px solid hsla(0,0%,100%,.8);
}
</style>
