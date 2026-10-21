<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    transition="dialog-bottom-transition"
    class="screenshot-editor-dialog select-none"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="flex flex-col h-full w-full bg-[#1e1e1e] text-white overflow-hidden">
      <!-- Top Header / Main Toolbar -->
      <div class="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-white/10 z-20 shrink-0 gap-2">
        <!-- Left: Title & File info -->
        <div class="flex items-center gap-3 min-w-[180px]">
          <v-icon color="primary">brush</v-icon>
          <div class="flex flex-col truncate">
            <span class="text-sm font-semibold truncate">{{ t('screenshots.editorTitle') }}</span>
            <span v-if="screenshot" class="text-xs text-white/50 truncate">{{ screenshot.name }}</span>
          </div>
        </div>

        <!-- Center: Tools -->
        <div class="flex items-center gap-1 bg-[#1a1a1a] p-1 rounded-lg border border-white/5 overflow-x-auto">
          <!-- Move & Transform (Ctrl+T or V) -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'move' || isTransforming ? 'tonal' : 'text'"
            :color="currentTool === 'move' || isTransforming ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolMove')"
            @click="setTool('move')"
          >
            <v-icon size="20">open_with</v-icon>
          </v-btn>

          <!-- Pan / Hand -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'pan' ? 'tonal' : 'text'"
            :color="currentTool === 'pan' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolPan')"
            @click="setTool('pan')"
          >
            <v-icon size="20">pan_tool</v-icon>
          </v-btn>

          <!-- Pen / Brush -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'pen' ? 'tonal' : 'text'"
            :color="currentTool === 'pen' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolPen')"
            @click="setTool('pen')"
          >
            <v-icon size="20">edit</v-icon>
          </v-btn>

          <!-- Highlighter -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'highlighter' ? 'tonal' : 'text'"
            :color="currentTool === 'highlighter' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolHighlighter')"
            @click="setTool('highlighter')"
          >
            <v-icon size="20">highlight</v-icon>
          </v-btn>

          <!-- Arrow -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'arrow' ? 'tonal' : 'text'"
            :color="currentTool === 'arrow' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolArrow')"
            @click="setTool('arrow')"
          >
            <v-icon size="20">north_east</v-icon>
          </v-btn>

          <!-- Rectangle -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'rect' ? 'tonal' : 'text'"
            :color="currentTool === 'rect' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolRect')"
            @click="setTool('rect')"
          >
            <v-icon size="20">crop_square</v-icon>
          </v-btn>

          <!-- Circle -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'circle' ? 'tonal' : 'text'"
            :color="currentTool === 'circle' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolCircle')"
            @click="setTool('circle')"
          >
            <v-icon size="20">radio_button_unchecked</v-icon>
          </v-btn>

          <!-- Line -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'line' ? 'tonal' : 'text'"
            :color="currentTool === 'line' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolLine')"
            @click="setTool('line')"
          >
            <v-icon size="20">horizontal_rule</v-icon>
          </v-btn>

          <!-- Text -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'text' ? 'tonal' : 'text'"
            :color="currentTool === 'text' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolText')"
            @click="setTool('text')"
          >
            <v-icon size="20">title</v-icon>
          </v-btn>

          <!-- Blur / Pixelate -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'blur' ? 'tonal' : 'text'"
            :color="currentTool === 'blur' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolBlur')"
            @click="setTool('blur')"
          >
            <v-icon size="20">grid_on</v-icon>
          </v-btn>

          <!-- Crop -->
          <v-btn
            icon
            size="small"
            :variant="currentTool === 'crop' ? 'tonal' : 'text'"
            :color="currentTool === 'crop' ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.toolCrop')"
            @click="initCrop"
          >
            <v-icon size="20">crop</v-icon>
          </v-btn>
        </div>

        <!-- Right: Actions & Save -->
        <div class="flex items-center gap-2">
          <!-- Undo / Redo -->
          <v-btn
            icon
            size="small"
            variant="text"
            :disabled="historyIndex <= 0"
            v-shared-tooltip.bottom="() => `${t('screenshots.undo')} (Ctrl+Z)`"
            @click="undo"
          >
            <v-icon size="20">undo</v-icon>
          </v-btn>

          <v-btn
            icon
            size="small"
            variant="text"
            :disabled="historyIndex >= history.length - 1"
            v-shared-tooltip.bottom="() => `${t('screenshots.redo')} (Ctrl+Y)`"
            @click="redo"
          >
            <v-icon size="20">redo</v-icon>
          </v-btn>

          <v-btn
            icon
            size="small"
            variant="text"
            v-shared-tooltip.bottom="() => t('screenshots.clear')"
            @click="clearAnnotations"
          >
            <v-icon size="20">layers_clear</v-icon>
          </v-btn>

          <!-- Toggle Layers Panel -->
          <v-btn
            icon
            size="small"
            :variant="showLayersPanel ? 'tonal' : 'text'"
            :color="showLayersPanel ? 'primary' : undefined"
            v-shared-tooltip.bottom="() => t('screenshots.layers')"
            @click="showLayersPanel = !showLayersPanel"
          >
            <v-badge
              :content="layers.length"
              :model-value="layers.length > 1"
              color="primary"
              location="top end"
              offset-x="2"
              offset-y="2"
            >
              <v-icon size="20">layers</v-icon>
            </v-badge>
          </v-btn>

          <v-divider vertical class="mx-1 h-6 self-center" />

          <!-- Copy to clipboard -->
          <v-btn
            icon
            size="small"
            variant="text"
            v-shared-tooltip.bottom="() => t('screenshots.copy')"
            @click="copyToClipboard"
          >
            <v-icon size="20">content_copy</v-icon>
          </v-btn>

          <!-- Save as copy -->
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="save"
            :loading="saving"
            @click="save(true)"
          >
            {{ t('screenshots.saveCopy') }}
          </v-btn>

          <!-- Overwrite -->
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            prepend-icon="check"
            :loading="saving"
            @click="save(false)"
          >
            {{ t('screenshots.saveOverwrite') }}
          </v-btn>

          <v-btn
            icon
            size="small"
            variant="text"
            class="ml-2"
            @click="close"
          >
            <v-icon size="22">close</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Secondary Toolbar (Settings for active tool) -->
      <div
        v-if="currentTool !== 'pan' && currentTool !== 'crop'"
        class="flex flex-wrap items-center justify-between px-6 py-2 bg-[#2a2a2b] border-b border-white/5 text-xs z-10 shrink-0 gap-4"
      >
        <!-- Transform Mode Toolbar -->
        <div v-if="isTransforming" class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-1.5 text-primary font-semibold">
            <v-icon size="16">open_with</v-icon>
            <span>{{ t('screenshots.transformLayer') }}</span>
          </div>

          <div v-if="activeLayer" class="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/10">
            <span class="text-white/60">Layer:</span>
            <span class="font-medium text-white flex items-center gap-1">
              <v-icon size="14" color="primary">{{ getLayerIcon(activeLayer) }}</v-icon>
              {{ activeLayer.name }}
            </span>
          </div>

          <span class="text-white/40 text-[11px] hidden md:inline">
            Drag selection to move • Drag handles to resize • Enter to commit
          </span>

          <div class="flex items-center gap-1">
            <v-btn
              size="small"
              variant="text"
              color="white"
              @click="cancelTransform"
            >
              {{ t('screenshots.cancelTransform') }}
            </v-btn>
            <v-btn
              size="small"
              color="primary"
              variant="flat"
              prepend-icon="check"
              @click="commitTransform"
            >
              {{ t('screenshots.applyTransform') }}
            </v-btn>
          </div>
        </div>

        <!-- Normal Tool Settings (Colors, Width, Text options) -->
        <template v-else>
          <!-- Left: Colors & Shape fills -->
          <div class="flex items-center gap-3">
            <!-- Color Picker -->
            <div class="flex items-center gap-2">
              <span class="text-white/60 font-semibold">{{ t('screenshots.color') }}:</span>
              <div class="flex items-center gap-1.5">
                <div
                  v-for="c in colorPalette"
                  :key="c"
                  class="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110"
                  :class="strokeColor === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#2a2a2b] scale-110 shadow-md' : 'opacity-80 hover:opacity-100 border border-white/20'"
                  :style="{ backgroundColor: c }"
                  @click="strokeColor = c"
                />
                <!-- Native Color Swatch / Button without 3D border -->
                <label class="relative w-6 h-6 rounded-full overflow-hidden border border-white/30 cursor-pointer hover:border-primary transition shrink-0 block" title="Custom color">
                  <input
                    type="color"
                    v-model="strokeColor"
                    class="absolute -inset-2 w-10 h-10 opacity-0 cursor-pointer"
                  />
                  <div class="w-full h-full rounded-full" :style="{ backgroundColor: strokeColor }" />
                </label>
              </div>
            </div>

            <!-- Fill shape for rect / circle -->
            <div v-if="currentTool === 'rect' || currentTool === 'circle'" class="flex items-center gap-1 cursor-pointer ml-2">
              <input
                id="fillShape"
                type="checkbox"
                v-model="fillShape"
                class="cursor-pointer rounded accent-primary"
              />
              <label for="fillShape" class="cursor-pointer text-white/80 select-none">Fill</label>
            </div>
          </div>

          <!-- Center: Tool specifics (Stroke width 1-1000 with Live Preview OR Text options) -->
          <div class="flex items-center gap-4 flex-wrap">
            <!-- Stroke width selector (1 to 1000) with Live Size Preview for drawing tools -->
            <div v-if="currentTool !== 'text' && currentTool !== 'blur'" class="flex items-center gap-2">
              <span class="text-white/60 font-semibold">{{ t('screenshots.strokeWidth') }}:</span>
              <!-- Vuetify Slider -->
              <v-slider
                v-model="strokeWidth"
                :min="1"
                :max="100"
                :step="1"
                hide-details
                density="compact"
                color="primary"
                class="w-28"
              />
              <!-- Flat launcher-style numeric input without bevel -->
              <div class="flex items-center bg-white/10 rounded-lg px-2 py-0.5 border border-white/10 focus-within:border-primary">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  v-model.number="strokeWidth"
                  class="w-10 text-center bg-transparent border-0 outline-none font-mono text-xs text-white p-0"
                />
                <span class="text-white/40 text-[10px] ml-0.5">px</span>
              </div>

              <!-- Visual Brush Preview Dot/Circle in Toolbar -->
              <div class="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center bg-black/40 overflow-hidden ml-1" title="Brush Size Preview">
                <div
                  class="rounded-full flex-shrink-0 transition-all duration-75"
                  :style="{
                    width: `${Math.min(Math.max(strokeWidth, 2), 20)}px`,
                    height: `${Math.min(Math.max(strokeWidth, 2), 20)}px`,
                    backgroundColor: strokeColor
                  }"
                />
              </div>
            </div>

            <!-- Text options (Font family, size 1-1000 with Preview, Bold, Italic, Background) -->
            <div v-if="currentTool === 'text'" class="flex items-center gap-3 flex-wrap">
              <!-- Font Family -->
              <div class="flex items-center gap-1.5">
                <span class="text-white/60 font-semibold">{{ t('screenshots.fontFamily') }}:</span>
                <select
                  v-model="fontFamily"
                  class="bg-white/10 text-white rounded-lg border border-white/10 px-2 py-1 text-xs outline-none cursor-pointer hover:bg-white/15 focus:border-primary transition max-w-[170px] truncate"
                >
                  <option
                    v-for="f in systemFonts"
                    :key="f"
                    :value="f"
                    class="bg-[#252526] text-white"
                    :style="{ fontFamily: f }"
                  >
                    {{ f }}
                  </option>
                </select>
              </div>

              <!-- Font Size selector (1 to 1000) with Live Preview -->
              <div class="flex items-center gap-2">
                <span class="text-white/60 font-semibold">{{ t('screenshots.fontSize') }}:</span>
                <v-slider
                  v-model="fontSize"
                  :min="8"
                  :max="160"
                  :step="1"
                  hide-details
                  density="compact"
                  color="primary"
                  class="w-24"
                />
                <div class="flex items-center bg-white/10 rounded-lg px-2 py-0.5 border border-white/10 focus-within:border-primary">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    v-model.number="fontSize"
                    class="w-10 text-center bg-transparent border-0 outline-none font-mono text-xs text-white p-0"
                  />
                  <span class="text-white/40 text-[10px] ml-0.5">px</span>
                </div>

                <!-- Visual Font Size Preview in Toolbar -->
                <div class="flex items-center gap-1 ml-1" title="Font Size Preview">
                  <div class="h-6 px-2 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                    <span
                      class="font-bold flex-shrink-0"
                      :style="{
                        fontSize: `${Math.min(Math.max(fontSize, 10), 18)}px`,
                        fontFamily: getCssFontFamily(fontFamily),
                        color: strokeColor
                      }"
                    >
                      Aa
                    </span>
                  </div>
                </div>
              </div>

              <!-- Bold / Italic -->
              <div class="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                <v-btn
                  size="x-small"
                  :variant="isBold ? 'tonal' : 'text'"
                  :color="isBold ? 'primary' : undefined"
                  class="font-bold min-w-[28px]"
                  @click="isBold = !isBold"
                >
                  B
                </v-btn>
                <v-btn
                  size="x-small"
                  :variant="isItalic ? 'tonal' : 'text'"
                  :color="isItalic ? 'primary' : undefined"
                  class="italic font-serif min-w-[28px]"
                  @click="isItalic = !isItalic"
                >
                  I
                </v-btn>
              </div>

              <!-- Text Background Mode -->
              <div class="flex items-center gap-1">
                <span class="text-white/60 font-semibold">{{ t('screenshots.textBg') }}:</span>
                <div class="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
                  <v-btn
                    size="x-small"
                    :variant="textBgMode === 'none' ? 'tonal' : 'text'"
                    :color="textBgMode === 'none' ? 'primary' : undefined"
                    class="text-[11px]"
                    @click="textBgMode = 'none'"
                  >
                    None
                  </v-btn>
                  <v-btn
                    size="x-small"
                    :variant="textBgMode === 'shadow' ? 'tonal' : 'text'"
                    :color="textBgMode === 'shadow' ? 'primary' : undefined"
                    class="text-[11px]"
                    @click="textBgMode = 'shadow'"
                  >
                    Shadow
                  </v-btn>
                  <v-btn
                    size="x-small"
                    :variant="textBgMode === 'box' ? 'tonal' : 'text'"
                    :color="textBgMode === 'box' ? 'primary' : undefined"
                    class="text-[11px]"
                    @click="textBgMode = 'box'"
                  >
                    Box
                  </v-btn>
                </div>
              </div>

              <!-- Quick Add text button -->
              <v-btn
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="add"
                @click="initTextPlacement"
              >
                {{ t('screenshots.textApply') }}
              </v-btn>
            </div>
          </div>
        </template>

      <!-- Right: Zoom controls -->
        <div class="flex items-center gap-1">
          <v-btn
            icon
            size="x-small"
            variant="text"
            v-shared-tooltip.bottom="() => t('screenshots.zoomOut')"
            @click="zoomOut"
          >
            <v-icon size="16">remove</v-icon>
          </v-btn>
          <span class="px-1 text-white/70 min-w-[40px] text-center font-mono">{{ Math.round(zoom * 100) }}%</span>
          <v-btn
            icon
            size="x-small"
            variant="text"
            v-shared-tooltip.bottom="() => t('screenshots.zoomIn')"
            @click="zoomIn"
          >
            <v-icon size="16">add</v-icon>
          </v-btn>
          <v-btn
            icon
            size="x-small"
            variant="text"
            v-shared-tooltip.bottom="() => t('screenshots.resetZoom')"
            @click="resetZoom"
          >
            <v-icon size="16">fit_screen</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Crop Toolbar (Active only when Crop tool is selected) -->
      <div
        v-if="currentTool === 'crop'"
        class="flex items-center justify-between px-6 py-2 bg-yellow-950/40 border-b border-yellow-500/20 text-xs z-10 shrink-0"
      >
        <div class="flex items-center gap-2 text-yellow-300">
          <v-icon size="18">crop</v-icon>
          <span>Drag bounding box to select crop area.</span>
        </div>
        <div class="flex items-center gap-2">
          <v-btn
            size="small"
            variant="text"
            color="white"
            @click="cancelCrop"
          >
            {{ t('screenshots.cancelCrop') }}
          </v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            prepend-icon="check"
            @click="applyCrop"
          >
            {{ t('screenshots.applyCrop') }}
          </v-btn>
        </div>
      </div>

      <!-- Main Canvas Workspace Area (with dockable Layers panel) -->
      <div class="relative flex-1 flex overflow-hidden">
        <!-- Main Canvas Workspace Viewport -->
        <div
          ref="viewportRef"
          class="relative flex-1 overflow-hidden flex items-center justify-center bg-[#141414]"
          :style="{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            cursor: canvasCursor
          }"
          @wheel.prevent="onWheel"
          @mouseleave="onMouseLeaveWorkspace"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @dblclick="onDoubleClickCanvas"
        >
          <!-- Canvas wrapper with transform for Pan & Zoom -->
          <div
            class="relative shadow-2xl origin-center inline-block will-change-transform"
            :style="{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`
            }"
          >
            <!-- Base Canvas (Committed drawing) -->
            <canvas
              ref="canvasRef"
              class="block max-w-none bg-black rounded shadow"
            />

            <!-- Overlay Canvas (Real-time GPU Preview Layer - zero lag) -->
            <canvas
              ref="overlayCanvasRef"
              class="absolute inset-0 pointer-events-none rounded"
            />

            <!-- Transform / Move Bounding Box & Handles (Photoshop style Ctrl+T) -->
            <div
              v-if="transformBox && isTransforming"
              class="absolute pointer-events-auto border-2 border-primary select-none z-30"
              :class="{
                'handle-small': transformBox.width < 50 || transformBox.height < 40
              }"
              :style="{
                left: `${transformBox.x}px`,
                top: `${transformBox.y}px`,
                width: `${transformBox.width}px`,
                height: `${transformBox.height}px`,
                cursor: isDraggingTransform ? 'grabbing' : 'move'
              }"
              @mousedown.stop="onStartMoveTransform"
              @dblclick.stop="onDoubleClickTransformBox"
            >
              <!-- Floating Move Pill at top center (always accessible, especially when box is small!) -->
              <div
                class="transform-pill"
                v-shared-tooltip.top="() => 'Drag to move'"
                @mousedown.stop="onStartMoveTransform"
              >
                <v-icon size="11" color="white" class="mr-1">open_with</v-icon>
                <span>{{ Math.round(transformBox.width) }}×{{ Math.round(transformBox.height) }}</span>
              </div>

              <!-- Center move icon indicator (only if box is large enough so it doesn't obstruct small shapes) -->
              <div
                v-if="transformBox.width >= 56 && transformBox.height >= 56"
                class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20"
              >
                <v-icon size="24" color="primary">open_with</v-icon>
              </div>

              <!-- 4 Corner resize handles -->
              <div class="transform-handle top-left" @mousedown.stop="onStartResizeTransform($event, 'tl')" />
              <div class="transform-handle top-right" @mousedown.stop="onStartResizeTransform($event, 'tr')" />
              <div class="transform-handle bottom-left" @mousedown.stop="onStartResizeTransform($event, 'bl')" />
              <div class="transform-handle bottom-right" @mousedown.stop="onStartResizeTransform($event, 'br')" />

              <!-- 4 Edge resize handles (only when box is wide/tall enough to prevent overlap) -->
              <template v-if="transformBox.width >= 60 && transformBox.height >= 50">
                <div class="transform-handle top-mid" @mousedown.stop="onStartResizeTransform($event, 'tm')" />
                <div class="transform-handle bottom-mid" @mousedown.stop="onStartResizeTransform($event, 'bm')" />
                <div class="transform-handle left-mid" @mousedown.stop="onStartResizeTransform($event, 'lm')" />
                <div class="transform-handle right-mid" @mousedown.stop="onStartResizeTransform($event, 'rm')" />
              </template>
            </div>

            <!-- Text Editing Box Overlay (Interactive movable text box) -->
            <div
              v-if="textOverlayState.active"
              class="absolute z-30 flex flex-col rounded-lg border-2 border-primary bg-black/90 shadow-2xl p-2 min-w-[200px]"
              :style="{
                left: `${textOverlayState.x}px`,
                top: `${textOverlayState.y}px`,
                transformOrigin: 'top left'
              }"
              @mousedown.stop
              @click.stop
            >
              <!-- Header bar for moving / committing text -->
              <div
                class="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-white/20 cursor-move text-white/80"
                @mousedown="startDragTextOverlay"
              >
                <div class="flex items-center gap-1 text-[11px] text-white/60">
                  <v-icon size="14">drag_indicator</v-icon>
                  <span>{{ fontFamily.split(',')[0].replace(/['"]/g, '') }} • {{ fontSize }}px</span>
                </div>
                <div class="flex items-center gap-1">
                  <v-btn
                    size="x-small"
                    color="primary"
                    variant="flat"
                    prepend-icon="check"
                    class="font-bold px-2"
                    @click="commitText"
                  >
                    {{ t('screenshots.textApply') }}
                  </v-btn>
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    color="white"
                    @click="cancelText"
                  >
                    <v-icon size="14">close</v-icon>
                  </v-btn>
                </div>
              </div>

              <!-- Multiline Text Input -->
              <textarea
                ref="textInputRef"
                v-model="textOverlayState.text"
                rows="2"
                class="w-full bg-transparent outline-none resize text-white p-1 rounded font-sans"
                :style="{
                  color: strokeColor,
                  fontSize: `${Math.min(fontSize, 120)}px`,
                  fontFamily: getCssFontFamily(fontFamily),
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal',
                  lineHeight: '1.2'
                }"
                :placeholder="t('screenshots.textPlaceholder')"
                @keydown.enter.exact.prevent="commitText"
                @keydown.esc.prevent="cancelText"
              />
              <div class="text-[10px] text-white/40 pt-1 text-right">
                Enter to place • Esc to cancel
              </div>
            </div>

            <!-- Crop Overlay -->
            <div
              v-if="currentTool === 'crop' && cropRect"
              class="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
              :style="{
                left: `${Math.min(cropRect.x1, cropRect.x2)}px`,
                top: `${Math.min(cropRect.y1, cropRect.y2)}px`,
                width: `${Math.abs(cropRect.x2 - cropRect.x1)}px`,
                height: `${Math.abs(cropRect.y2 - cropRect.y1)}px`
              }"
            />
          </div>
        </div>

        <!-- Right: Layers Panel (Photoshop style) -->
        <div
          v-if="showLayersPanel"
          class="w-72 bg-[#202021] border-l border-white/10 flex flex-col z-20 shrink-0 select-none shadow-2xl"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-3 py-2 bg-[#282829] border-b border-white/10 text-xs font-semibold">
            <div class="flex items-center gap-1.5">
              <v-icon size="16" color="primary">layers</v-icon>
              <span>{{ t('screenshots.layers') }} ({{ layers.length }})</span>
            </div>
            <div class="flex items-center gap-1">
              <v-btn
                icon
                size="x-small"
                variant="text"
                v-shared-tooltip.bottom="() => t('screenshots.layerAdd')"
                @click="addNewLayer"
              >
                <v-icon size="16">add</v-icon>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                v-shared-tooltip.bottom="() => t('screenshots.layerDuplicate')"
                :disabled="!activeLayer"
                @click="duplicateActiveLayer"
              >
                <v-icon size="16">content_copy</v-icon>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                v-shared-tooltip.bottom="() => t('screenshots.layerDelete')"
                :disabled="layers.length <= 1 || activeLayer?.type === 'base'"
                @click="deleteActiveLayer"
              >
                <v-icon size="16">delete</v-icon>
              </v-btn>
              <v-btn
                icon
                size="x-small"
                variant="text"
                @click="showLayersPanel = false"
              >
                <v-icon size="16">close</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Active Layer Properties (Opacity & Transform shortcut) -->
          <div v-if="activeLayer" class="p-3 bg-[#1e1e1e] border-b border-white/10 text-xs flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-white/60 font-semibold">{{ t('screenshots.layerOpacity') }}:</span>
              <div class="flex items-center gap-2">
                <v-slider
                  v-model="activeLayerOpacityPercent"
                  :min="0"
                  :max="100"
                  :step="1"
                  density="compact"
                  color="primary"
                  hide-details
                  class="w-24"
                />
                <span class="text-white/80 font-mono w-8 text-right">{{ Math.round(activeLayer.opacity * 100) }}%</span>
              </div>
            </div>

            <!-- Free Transform Button -->
            <div class="flex items-center justify-between pt-1">
              <v-btn
                size="x-small"
                variant="tonal"
                color="primary"
                prepend-icon="open_with"
                class="w-full text-xs font-semibold"
                @click="startTransform(activeLayer.id)"
              >
                {{ t('screenshots.transformLayer') }} (Ctrl+T)
              </v-btn>
            </div>
          </div>

          <!-- Layers List (from Top to Bottom) -->
          <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            <div
              v-for="(layer, index) in reversedLayers"
              :key="layer.id"
              class="flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs group"
              :class="layer.id === activeLayerId ? 'bg-primary/20 border-primary text-white shadow-sm' : 'bg-black/20 border-white/5 text-white/70 hover:bg-white/5 hover:text-white'"
              @click="selectLayer(layer.id)"
              @dblclick.stop="onDoubleClickLayer(layer)"
            >
              <!-- Left: Visibility Eye + Icon + Name -->
              <div class="flex items-center gap-1.5 min-w-0 flex-1">
                <!-- Visibility toggle button -->
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :color="layer.visible ? 'white' : 'grey'"
                  class="opacity-70 hover:opacity-100"
                  @click.stop="toggleLayerVisibility(layer.id)"
                >
                  <v-icon size="16">{{ layer.visible ? 'visibility' : 'visibility_off' }}</v-icon>
                </v-btn>

                <!-- Layer Type Icon -->
                <v-icon size="16" :color="layer.id === activeLayerId ? 'primary' : 'grey-lighten-1'">
                  {{ getLayerIcon(layer) }}
                </v-icon>

                <!-- Layer Name -->
                <span class="truncate font-medium flex-1 select-none">
                  {{ layer.name }}
                </span>
              </div>

              <!-- Right: Layer Reorder Controls (Move Up / Down) -->
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :disabled="index === 0"
                  title="Move Up"
                  @click.stop="moveLayerUp(layer.id)"
                >
                  <v-icon size="16">keyboard_arrow_up</v-icon>
                </v-btn>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :disabled="index === reversedLayers.length - 1 || layer.type === 'base'"
                  title="Move Down"
                  @click.stop="moveLayerDown(layer.id)"
                >
                  <v-icon size="16">keyboard_arrow_down</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ScreenshotItem } from '@xmcl/runtime-api'
import { vSharedTooltip } from '@/directives/sharedTooltip'

type ToolType = 'move' | 'pan' | 'pen' | 'highlighter' | 'arrow' | 'rect' | 'circle' | 'line' | 'text' | 'blur' | 'crop'

export interface EditorLayer {
  id: string
  name: string
  type: 'base' | 'paint' | 'text' | 'blur'
  visible: boolean
  opacity: number // 0 to 1
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  canvas: HTMLCanvasElement
  textData?: {
    text: string
    color: string
    fontSize: number
    fontFamily: string
    isBold: boolean
    isItalic: boolean
    bgMode: 'none' | 'shadow' | 'box'
  }
  blurData?: {
    x: number
    y: number
    width: number
    height: number
    blockSize: number
  }
}

interface HistoryLayerSnapshot {
  id: string
  name: string
  type: 'base' | 'paint' | 'text' | 'blur'
  visible: boolean
  opacity: number
  x: number
  y: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  canvas: HTMLCanvasElement
  textData?: any
  blurData?: any
}

interface HistoryEntry {
  layers: HistoryLayerSnapshot[]
  activeLayerId: string
}

interface Action {
  type: ToolType
  points?: Array<{ x: number; y: number }>
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  color: string
  width: number
  filled?: boolean
}

const props = defineProps<{
  modelValue: boolean
  screenshot: ScreenshotItem | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', result: { dataUrl: string; originalUrl?: string; saveAsCopy: boolean }): void
}>()

const { t } = useI18n()

const viewportRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)
const textInputRef = ref<HTMLTextAreaElement | null>(null)

// Cached 2D rendering contexts (avoids repeated getContext calls on hot paths)
let mainCtx: CanvasRenderingContext2D | null = null
let overlayCtx: CanvasRenderingContext2D | null = null

function getMainCtx(): CanvasRenderingContext2D | null {
  if (!mainCtx && canvasRef.value) mainCtx = canvasRef.value.getContext('2d')
  return mainCtx
}

function getOverlayCtx(): CanvasRenderingContext2D | null {
  if (!overlayCtx && overlayCanvasRef.value) overlayCtx = overlayCanvasRef.value.getContext('2d')
  return overlayCtx
}

const colorPalette = [
  '#f44336', // Red
  '#ff9800', // Orange
  '#ffeb3b', // Yellow
  '#4caf50', // Green
  '#00bcd4', // Cyan
  '#2196f3', // Blue
  '#9c27b0', // Purple
  '#ffffff', // White
  '#111111', // Black
]

const currentTool = ref<ToolType>('pen')
const strokeColor = ref('#f44336')
const strokeWidth = ref(4)
const fontSize = ref(36)
const fontFamily = ref('Segoe UI')
const isBold = ref(true)
const isItalic = ref(false)
const textBgMode = ref<'none' | 'shadow' | 'box'>('shadow')
const fillShape = ref(false)

// Layers state
const layers = ref<EditorLayer[]>([])
const activeLayerId = ref<string>('')
const showLayersPanel = ref<boolean>(true)

const activeLayer = computed(() => {
  return layers.value.find(l => l.id === activeLayerId.value) || layers.value[0] || null
})

const activeLayerOpacityPercent = computed({
  get: () => (activeLayer.value ? Math.round(activeLayer.value.opacity * 100) : 100),
  set: (val: number) => onLayerOpacityChange(val),
})

const reversedLayers = computed(() => {
  return [...layers.value].reverse()
})

// Transform & Move state (Ctrl+T)
const isTransforming = ref(false)
const isDraggingTransform = ref(false)

const transformBox = ref<{ x: number; y: number; width: number; height: number } | null>(null)

function syncTransformBox() {
  if (!activeLayer.value) {
    transformBox.value = null
    return
  }
  const l = activeLayer.value
  if (l.type === 'blur' && l.blurData) {
    transformBox.value = {
      x: l.blurData.x,
      y: l.blurData.y,
      width: l.blurData.width,
      height: l.blurData.height,
    }
  } else if (l.type === 'text' && l.textData) {
    transformBox.value = {
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
    }
  } else {
    transformBox.value = {
      x: l.x,
      y: l.y,
      width: Math.max(16, l.width * l.scaleX),
      height: Math.max(16, l.height * l.scaleY),
    }
  }
}

watch(activeLayer, () => {
  if (isTransforming.value) {
    syncTransformBox()
  }
}, { deep: true })

// Zoom & Pan state
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const isSpacePressed = ref(false)
// Non-reactive pan drag start coords (hot path - avoids Vue proxy overhead)
let panStartX = 0
let panStartY = 0

// Drawing state
const isDrawing = ref(false)
const currentAction = ref<Action | null>(null)

// History snapshots
const history = ref<HistoryEntry[]>([])
const historyIndex = ref(-1)

// Base loaded image
const baseImage = ref<HTMLImageElement | null>(null)

// Text tool overlay state (during text entry)
const textOverlayState = ref({
  active: false,
  x: 0,
  y: 0,
  text: '',
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
})

const editingTextLayerId = ref<string | null>(null)
let lastStrokeTime = 0

function getCssFontFamily(font: string): string {
  if (!font) return 'sans-serif'
  if (font.includes(',') || font.startsWith('"') || font.startsWith("'")) {
    return font
  }
  return `"${font}", sans-serif`
}

// System Fonts Detection & Loading
const CANDIDATE_SYSTEM_FONTS = [
  'Segoe UI',
  'Segoe UI Variable',
  'Arial',
  'Arial Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Candara',
  'Century Gothic',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'DejaVu Sans',
  'Ebrima',
  'Franklin Gothic Medium',
  'Gabriola',
  'Gadugi',
  'Georgia',
  'Impact',
  'Ink Free',
  'Inter',
  'Leelawadee UI',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Malgun Gothic',
  'Microsoft Sans Serif',
  'Microsoft YaHei',
  'Minecraft',
  'Palatino Linotype',
  'Roboto',
  'Segoe Print',
  'Segoe Script',
  'SimSun',
  'Sitka',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Yu Gothic',
  'sans-serif',
  'monospace',
  'serif',
  'cursive',
]

const systemFonts = ref<string[]>([
  'Segoe UI',
  'Arial',
  'Bahnschrift',
  'Calibri',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'Georgia',
  'Impact',
  'Minecraft',
  'Roboto',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'sans-serif',
  'monospace',
  'serif',
  'cursive',
])

function detectInstalledFonts(candidates: string[]): string[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return candidates

  const testString = 'mmmmmmmmmmlli!@#$%^&*()_+'
  const testSize = '72px'
  const baseFonts = ['monospace', 'sans-serif', 'serif']

  const baseWidths: Record<string, number> = {}
  for (const base of baseFonts) {
    ctx.font = `${testSize} ${base}`
    baseWidths[base] = ctx.measureText(testString).width
  }

  const detected: string[] = []
  for (const font of candidates) {
    if (['sans-serif', 'monospace', 'serif', 'cursive'].includes(font)) {
      detected.push(font)
      continue
    }
    let matched = false
    for (const base of baseFonts) {
      ctx.font = `${testSize} "${font}", ${base}`
      const w = ctx.measureText(testString).width
      if (w !== baseWidths[base]) {
        matched = true
        break
      }
    }
    if (matched) {
      detected.push(font)
    }
  }

  return detected
}

async function loadSystemFonts() {
  try {
    if ('queryLocalFonts' in window && typeof (window as any).queryLocalFonts === 'function') {
      const fonts = await (window as any).queryLocalFonts()
      if (Array.isArray(fonts) && fonts.length > 0) {
        const familySet = new Set<string>()
        for (const f of fonts) {
          if (f && typeof f.family === 'string' && f.family.trim()) {
            familySet.add(f.family.trim())
          }
        }
        if (familySet.size > 0) {
          const sorted = Array.from(familySet).sort((a, b) => a.localeCompare(b))
          for (const fallback of ['sans-serif', 'monospace', 'serif', 'cursive']) {
            if (!sorted.includes(fallback)) {
              sorted.push(fallback)
            }
          }
          systemFonts.value = sorted
          return
        }
      }
    }
  } catch (e) {
    console.debug('queryLocalFonts not available or permission denied, using fallback detection', e)
  }

  const detected = detectInstalledFonts(CANDIDATE_SYSTEM_FONTS)
  if (detected.length > 0) {
    systemFonts.value = detected
  }
}

// Crop tool state
const cropRect = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const saving = ref(false)

const canvasCursor = computed(() => {
  if (isPanning.value || isSpacePressed.value) {
    return isPanning.value ? 'grabbing' : 'grab'
  }
  if (currentTool.value === 'pan') {
    return isPanning.value ? 'grabbing' : 'grab'
  }
  if (currentTool.value === 'move' || isTransforming.value) {
    return 'default'
  }
  if (currentTool.value === 'text') return 'crosshair'
  if (currentTool.value === 'crop') return 'crosshair'
  return 'crosshair'
})

function isGif(screenshot?: ScreenshotItem | null): boolean {
  if (!screenshot) return false
  const target = screenshot.name || screenshot.path || screenshot.url || ''
  return /\.gif(\?.*)?$/i.test(target)
}

// Initialize / load image when modal opens
watch(
  () => props.modelValue,
  async (open) => {
    if (open && props.screenshot) {
      if (isGif(props.screenshot)) {
        close()
        return
      }
      await nextTick()
      loadImage(props.screenshot.url)
    } else {
      resetState()
    }
  }
)

function setTool(tool: ToolType) {
  if (textOverlayState.value.active) {
    commitText()
  }
  if (tool === 'move') {
    startTransform(activeLayerId.value)
    return
  }
  if (isTransforming.value) {
    commitTransform()
  }
  currentTool.value = tool
}

function resetState() {
  if (renderLayersRafId !== null) {
    cancelAnimationFrame(renderLayersRafId)
    renderLayersRafId = null
  }
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId)
    hoverRafId = null
  }
  if (shapePreviewRafId !== null) {
    cancelAnimationFrame(shapePreviewRafId)
    shapePreviewRafId = null
  }
  if (panRafId !== null) {
    cancelAnimationFrame(panRafId)
    panRafId = null
  }
  layers.value = []
  activeLayerId.value = ''
  history.value = []
  historyIndex.value = -1
  currentTool.value = 'pen'
  currentAction.value = null
  textOverlayState.value.active = false
  editingTextLayerId.value = null
  cropRect.value = null
  isTransforming.value = false
  transformBox.value = null
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function loadImage(url: string) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    baseImage.value = img
    initCanvas(img)
  }
  img.src = url
}

function initCanvas(img: HTMLImageElement) {
  const canvas = canvasRef.value
  const overlay = overlayCanvasRef.value
  if (!canvas) return

  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  if (overlay) {
    overlay.width = img.naturalWidth
    overlay.height = img.naturalHeight
  }

  // 1. Base image layer
  const baseCanvas = document.createElement('canvas')
  baseCanvas.width = img.naturalWidth
  baseCanvas.height = img.naturalHeight
  const bCtx = baseCanvas.getContext('2d')
  if (bCtx) {
    bCtx.drawImage(img, 0, 0)
  }

  const baseLayer: EditorLayer = {
    id: `base-${Date.now()}`,
    name: t('screenshots.layerBackground') || 'Background',
    type: 'base',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    width: img.naturalWidth,
    height: img.naturalHeight,
    scaleX: 1,
    scaleY: 1,
    canvas: baseCanvas,
  }

  // 2. Default paint layer
  const paintCanvas = document.createElement('canvas')
  paintCanvas.width = img.naturalWidth
  paintCanvas.height = img.naturalHeight
  const paintLayer: EditorLayer = {
    id: `paint-${Date.now()}`,
    name: `${t('screenshots.layerPaint') || 'Drawing'} 1`,
    type: 'paint',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    width: img.naturalWidth,
    height: img.naturalHeight,
    scaleX: 1,
    scaleY: 1,
    canvas: paintCanvas,
  }

  layers.value = [baseLayer, paintLayer]
  activeLayerId.value = paintLayer.id

  renderAllLayers()
  saveHistoryState()
  fitToScreen(img.naturalWidth, img.naturalHeight)
}

function fitToScreen(imgWidth: number, imgHeight: number) {
  if (!viewportRef.value) return
  const vw = viewportRef.value.clientWidth - 80
  const vh = viewportRef.value.clientHeight - 80
  if (vw <= 0 || vh <= 0) return

  const scale = Math.min(vw / imgWidth, vh / imgHeight, 1)
  zoom.value = Math.max(0.05, Number(scale.toFixed(2)))
  panX.value = 0
  panY.value = 0
}

// Layer Management Functions
function getLayerIcon(layer: EditorLayer) {
  if (layer.type === 'base') return 'image'
  if (layer.type === 'text') return 'title'
  if (layer.type === 'blur') return 'grid_on'
  return 'brush'
}

function selectLayer(id: string) {
  if (isTransforming.value) {
    commitTransform()
  }
  activeLayerId.value = id
}

function addNewLayer() {
  const canvas = canvasRef.value
  const w = canvas?.width || 800
  const h = canvas?.height || 600
  const newCanvas = document.createElement('canvas')
  newCanvas.width = w
  newCanvas.height = h

  const newLayer: EditorLayer = {
    id: `layer-${Date.now()}`,
    name: `${t('screenshots.layerPaint') || 'Drawing'} ${layers.value.filter(l => l.type === 'paint').length + 1}`,
    type: 'paint',
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    width: w,
    height: h,
    scaleX: 1,
    scaleY: 1,
    canvas: newCanvas,
  }

  const activeIdx = layers.value.findIndex(l => l.id === activeLayerId.value)
  if (activeIdx >= 0) {
    layers.value.splice(activeIdx + 1, 0, newLayer)
  } else {
    layers.value.push(newLayer)
  }
  activeLayerId.value = newLayer.id
  saveHistoryState()
  renderAllLayers()
}

function duplicateActiveLayer() {
  if (!activeLayer.value) return
  const cur = activeLayer.value
  const copyCanvas = document.createElement('canvas')
  copyCanvas.width = cur.canvas.width || 1
  copyCanvas.height = cur.canvas.height || 1
  const ctx = copyCanvas.getContext('2d')
  if (ctx && cur.canvas.width > 0 && cur.canvas.height > 0) {
    ctx.drawImage(cur.canvas, 0, 0)
  }

  const dup: EditorLayer = {
    ...cur,
    id: `layer-${Date.now()}`,
    name: `${cur.name} (Copy)`,
    canvas: copyCanvas,
    textData: cur.textData ? { ...cur.textData } : undefined,
    blurData: cur.blurData ? { ...cur.blurData } : undefined,
  }

  const idx = layers.value.findIndex(l => l.id === cur.id)
  layers.value.splice(idx + 1, 0, dup)
  activeLayerId.value = dup.id
  saveHistoryState()
  renderAllLayers()
}

function deleteActiveLayer() {
  if (!activeLayer.value || layers.value.length <= 1) return
  if (activeLayer.value.type === 'base') return

  if (editingTextLayerId.value === activeLayerId.value) {
    textOverlayState.value.active = false
    editingTextLayerId.value = null
  }

  const idx = layers.value.findIndex(l => l.id === activeLayerId.value)
  layers.value.splice(idx, 1)
  const nextLayer = layers.value[Math.max(0, idx - 1)]
  activeLayerId.value = nextLayer ? nextLayer.id : ''
  saveHistoryState()
  renderAllLayers()
}

function moveLayerUp(id: string) {
  const idx = layers.value.findIndex(l => l.id === id)
  if (idx < layers.value.length - 1) {
    const item = layers.value.splice(idx, 1)[0]
    layers.value.splice(idx + 1, 0, item)
    saveHistoryState()
    renderAllLayers()
  }
}

function moveLayerDown(id: string) {
  const idx = layers.value.findIndex(l => l.id === id)
  if (idx > 0 && layers.value[idx].type !== 'base') {
    const item = layers.value.splice(idx, 1)[0]
    layers.value.splice(idx - 1, 0, item)
    saveHistoryState()
    renderAllLayers()
  }
}

function toggleLayerVisibility(id: string) {
  const l = layers.value.find(layer => layer.id === id)
  if (l) {
    l.visible = !l.visible
    saveHistoryState()
    renderAllLayers()
  }
}

function onLayerOpacityChange(val: number) {
  if (activeLayer.value) {
    activeLayer.value.opacity = Math.max(0, Math.min(100, val)) / 100
    requestRenderLayers()
  }
}

function ensurePaintLayer(): EditorLayer {
  const canvasW = canvasRef.value?.width || 0
  if (activeLayer.value && (activeLayer.value.type === 'paint' || activeLayer.value.type === 'base')) {
    if (activeLayer.value.type === 'base' || activeLayer.value.width >= canvasW) {
      return activeLayer.value
    }
  }
  const fullPaint = layers.value.slice().reverse().find(l => l.type === 'paint' && l.width >= canvasW)
  if (fullPaint) {
    activeLayerId.value = fullPaint.id
    return fullPaint
  }
  addNewLayer()
  return activeLayer.value!
}

// Composition rendering of all visible layers with rAF batching
let renderLayersRafId: number | null = null

function requestRenderLayers() {
  if (renderLayersRafId !== null) return
  renderLayersRafId = requestAnimationFrame(() => {
    renderLayersRafId = null
    renderAllLayers()
  })
}

function flushRenderLayers() {
  if (renderLayersRafId !== null) {
    cancelAnimationFrame(renderLayersRafId)
    renderLayersRafId = null
  }
  renderAllLayers()
}

function renderAllLayers() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = getMainCtx()
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < layers.value.length; i++) {
    const layer = layers.value[i]
    if (!layer.visible) continue

    ctx.save()
    ctx.globalAlpha = layer.opacity

    if (layer.type === 'blur' && layer.blurData) {
      renderBlurOnCanvas(ctx, layer.blurData, canvas)
    } else if (layer.type === 'text' && layer.textData) {
      renderTextOnContext(ctx, layer)
    } else {
      ctx.translate(layer.x, layer.y)
      if (layer.scaleX !== 1 || layer.scaleY !== 1) {
        ctx.scale(layer.scaleX, layer.scaleY)
      }
      ctx.drawImage(layer.canvas, 0, 0)
    }

    ctx.restore()
  }
}

// Reusable offscreen canvas for zero-GC GPU-accelerated blur pixelation
let scratchBlurCanvas: HTMLCanvasElement | null = null
let scratchBlurCtx: CanvasRenderingContext2D | null = null

function getScratchBlurCtx() {
  if (!scratchBlurCanvas) {
    scratchBlurCanvas = document.createElement('canvas')
    scratchBlurCtx = scratchBlurCanvas.getContext('2d')
  }
  return scratchBlurCtx
}

function renderBlurOnCanvas(
  ctx: CanvasRenderingContext2D,
  blurData: { x: number; y: number; width: number; height: number; blockSize?: number },
  mainCanvas: HTMLCanvasElement
) {
  const x = Math.max(0, Math.floor(blurData.x))
  const y = Math.max(0, Math.floor(blurData.y))
  const w = Math.min(Math.floor(blurData.width), mainCanvas.width - x)
  const h = Math.min(Math.floor(blurData.height), mainCanvas.height - y)
  if (w <= 2 || h <= 2) return

  const sCtx = getScratchBlurCtx()
  if (!sCtx || !scratchBlurCanvas) return

  const blockSize = Math.max(4, blurData.blockSize || Math.max(8, Math.floor(Math.min(w, h) / 10)))
  const sw = Math.max(1, Math.floor(w / blockSize))
  const sh = Math.max(1, Math.floor(h / blockSize))

  scratchBlurCanvas.width = sw
  scratchBlurCanvas.height = sh
  sCtx.imageSmoothingEnabled = true
  // 1. Downscale source region to tiny offscreen canvas on GPU
  sCtx.drawImage(mainCanvas, x, y, w, h, 0, 0, sw, sh)

  // 2. Upscale back with nearest-neighbor interpolation on GPU (0 CPU loops, 0ms pipeline flush!)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(scratchBlurCanvas, 0, 0, sw, sh, x, y, w, h)
  ctx.restore()
}

function renderTextOnContext(ctx: CanvasRenderingContext2D, layer: EditorLayer) {
  if (!layer.textData) return
  const { text, color, fontSize, fontFamily, isBold, isItalic, bgMode } = layer.textData
  ctx.save()
  const fontName = getCssFontFamily(fontFamily)
  const fontStyleStr = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontName}`
  ctx.font = fontStyleStr
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.25
  const padding = fontSize * 0.25
  const startX = layer.x
  const startY = layer.y

  if (bgMode === 'box') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(startX, startY, layer.width, layer.height)
  } else if (bgMode === 'shadow') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'
    ctx.shadowBlur = Math.max(4, fontSize * 0.15)
    ctx.shadowOffsetX = Math.max(2, fontSize * 0.05)
    ctx.shadowOffsetY = Math.max(2, fontSize * 0.05)
  }

  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], startX + padding, startY + padding + i * lineHeight)
  }
  ctx.restore()
}

// Transform / Move mode (Photoshop-like Ctrl+T)
let transformBackupState: any = null

function getCanvasOpaqueBounds(canvas: HTMLCanvasElement): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null

  try {
    const w = canvas.width
    const h = canvas.height
    const imgData = ctx.getImageData(0, 0, w, h).data

    let minX = w, minY = h, maxX = -1, maxY = -1

    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const idx = (y * w + x) * 4 + 3
        if (imgData[idx] > 10) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX === -1) return null
    return { minX, minY, maxX, maxY }
  } catch {
    return null
  }
}

function cropLayerToContent(layer: EditorLayer) {
  if (layer.type !== 'paint' || !canvasRef.value) return
  // If layer is already cropped smaller than base canvas, no need to recrop
  if (layer.width < canvasRef.value.width || layer.height < canvasRef.value.height) return

  const bounds = getCanvasOpaqueBounds(layer.canvas)
  if (!bounds) return

  const pad = 12
  const minX = Math.max(0, bounds.minX - pad)
  const minY = Math.max(0, bounds.minY - pad)
  const maxX = Math.min(layer.canvas.width, bounds.maxX + pad)
  const maxY = Math.min(layer.canvas.height, bounds.maxY + pad)
  const w = maxX - minX
  const h = maxY - minY
  if (w <= 0 || h <= 0 || (w === layer.canvas.width && h === layer.canvas.height)) return

  const cropped = document.createElement('canvas')
  cropped.width = w
  cropped.height = h
  const cCtx = cropped.getContext('2d')
  if (cCtx) {
    cCtx.drawImage(layer.canvas, minX, minY, w, h, 0, 0, w, h)
  }

  layer.canvas = cropped
  layer.x += minX
  layer.y += minY
  layer.width = w
  layer.height = h
  layer.scaleX = 1
  layer.scaleY = 1
}

function startTransform(id?: string) {
  if (id) activeLayerId.value = id
  if (!activeLayer.value) return
  if (activeLayer.value.type === 'paint') {
    cropLayerToContent(activeLayer.value)
  }
  isTransforming.value = true
  currentTool.value = 'move'
  syncTransformBox()
  backupTransformState()
  flushRenderLayers()
}

function backupTransformState() {
  if (!activeLayer.value) return
  const l = activeLayer.value
  transformBackupState = {
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
    scaleX: l.scaleX,
    scaleY: l.scaleY,
    fontSize: l.textData?.fontSize,
    blurData: l.blurData ? { ...l.blurData } : undefined,
  }
}

function commitTransform() {
  if (!isTransforming.value && currentTool.value !== 'move') return
  isTransforming.value = false
  if (currentTool.value === 'move') {
    currentTool.value = 'pen'
  }
  transformBackupState = null
  saveHistoryState()
  flushRenderLayers()
}

function cancelTransform() {
  if (!activeLayer.value || !transformBackupState) {
    isTransforming.value = false
    if (currentTool.value === 'move') {
      currentTool.value = 'pen'
    }
    return
  }
  const l = activeLayer.value
  l.x = transformBackupState.x
  l.y = transformBackupState.y
  l.width = transformBackupState.width
  l.height = transformBackupState.height
  l.scaleX = transformBackupState.scaleX
  l.scaleY = transformBackupState.scaleY
  if (l.textData && transformBackupState.fontSize) {
    l.textData.fontSize = transformBackupState.fontSize
  }
  if (l.blurData && transformBackupState.blurData) {
    l.blurData = { ...transformBackupState.blurData }
  }
  isTransforming.value = false
  if (currentTool.value === 'move') {
    currentTool.value = 'pen'
  }
  transformBackupState = null
  syncTransformBox()
  flushRenderLayers()
}

let moveStartClientX = 0
let moveStartClientY = 0
let moveStartLayerX = 0
let moveStartLayerY = 0

function onStartMoveTransform(e: MouseEvent) {
  if (e.button !== 0 || !activeLayer.value) return
  isDraggingTransform.value = true
  isTransforming.value = true
  if (!transformBackupState) backupTransformState()

  moveStartClientX = e.clientX
  moveStartClientY = e.clientY
  const l = activeLayer.value
  if (l.type === 'blur' && l.blurData) {
    moveStartLayerX = l.blurData.x
    moveStartLayerY = l.blurData.y
  } else {
    moveStartLayerX = l.x
    moveStartLayerY = l.y
  }

  window.addEventListener('mousemove', onMoveTransformDrag)
  window.addEventListener('mouseup', onMoveTransformEnd)
}

function onMoveTransformDrag(e: MouseEvent) {
  if (!isDraggingTransform.value || !activeLayer.value) return
  const dx = (e.clientX - moveStartClientX) / zoom.value
  const dy = (e.clientY - moveStartClientY) / zoom.value
  const l = activeLayer.value

  const newX = Math.round(moveStartLayerX + dx)
  const newY = Math.round(moveStartLayerY + dy)

  if (l.type === 'blur' && l.blurData) {
    l.blurData.x = newX
    l.blurData.y = newY
    l.x = newX
    l.y = newY
  } else {
    l.x = newX
    l.y = newY
  }

  if (transformBox.value) {
    transformBox.value.x = newX
    transformBox.value.y = newY
  }

  requestRenderLayers()
}

function onMoveTransformEnd() {
  isDraggingTransform.value = false
  window.removeEventListener('mousemove', onMoveTransformDrag)
  window.removeEventListener('mouseup', onMoveTransformEnd)
  syncTransformBox()
  flushRenderLayers()
}

let resizeHandle: string = ''
let resizeStartClientX = 0
let resizeStartClientY = 0
let resizeStartBox = { x: 0, y: 0, width: 0, height: 0 }
let resizeStartFontSize = 36

function onStartResizeTransform(e: MouseEvent, handle: string) {
  if (e.button !== 0 || !activeLayer.value || !transformBox.value) return
  isTransforming.value = true
  if (!transformBackupState) backupTransformState()

  resizeHandle = handle
  resizeStartClientX = e.clientX
  resizeStartClientY = e.clientY
  resizeStartBox = { ...transformBox.value }
  resizeStartFontSize = activeLayer.value.textData?.fontSize || 36

  window.addEventListener('mousemove', onResizeTransformDrag)
  window.addEventListener('mouseup', onResizeTransformEnd)
}

function onResizeTransformDrag(e: MouseEvent) {
  if (!activeLayer.value) return
  const dx = (e.clientX - resizeStartClientX) / zoom.value
  const dy = (e.clientY - resizeStartClientY) / zoom.value

  const l = activeLayer.value
  const minW = l.type === 'text' ? 24 : 16
  const minH = l.type === 'text' ? 16 : 16

  let { x, y, width: w, height: h } = resizeStartBox

  if (resizeHandle.includes('r')) w = Math.max(minW, resizeStartBox.width + dx)
  if (resizeHandle.includes('b')) h = Math.max(minH, resizeStartBox.height + dy)
  if (resizeHandle.includes('l')) {
    const newW = Math.max(minW, resizeStartBox.width - dx)
    x = resizeStartBox.x + (resizeStartBox.width - newW)
    w = newW
  }
  if (resizeHandle.includes('t')) {
    const newH = Math.max(minH, resizeStartBox.height - dy)
    y = resizeStartBox.y + (resizeStartBox.height - newH)
    h = newH
  }

  // Keep aspect ratio if Shift is held or when dragging corners of text
  if ((e.shiftKey || l.type === 'text') && ['tl', 'tr', 'bl', 'br'].includes(resizeHandle)) {
    const aspect = resizeStartBox.width / resizeStartBox.height
    if (w / resizeStartBox.width > h / resizeStartBox.height) {
      h = Math.max(minH, w / aspect)
      if (resizeHandle.includes('t')) y = resizeStartBox.y + (resizeStartBox.height - h)
    } else {
      w = Math.max(minW, h * aspect)
      if (resizeHandle.includes('l')) x = resizeStartBox.x + (resizeStartBox.width - w)
    }
  }

  if (l.type === 'blur' && l.blurData) {
    l.blurData.x = Math.round(x)
    l.blurData.y = Math.round(y)
    l.blurData.width = Math.round(w)
    l.blurData.height = Math.round(h)
    l.blurData.blockSize = Math.max(4, Math.floor(Math.min(w, h) / 10))
    l.x = l.blurData.x
    l.y = l.blurData.y
    l.width = l.blurData.width
    l.height = l.blurData.height
  } else if (l.type === 'text' && l.textData) {
    const scaleRatio = Math.max(0.1, h / resizeStartBox.height)
    const newFontSize = Math.max(8, Math.min(1000, Math.round(resizeStartFontSize * scaleRatio)))
    l.textData.fontSize = newFontSize
    const measured = measureTextBounds(l.textData.text, newFontSize, l.textData.fontFamily, l.textData.isBold, l.textData.isItalic)
    l.x = Math.round(x)
    l.y = Math.round(y)
    l.width = measured.width
    l.height = measured.height
  } else {
    l.x = Math.round(x)
    l.y = Math.round(y)
    l.scaleX = Math.max(0.01, w / l.width)
    l.scaleY = Math.max(0.01, h / l.height)
  }

  if (transformBox.value) {
    transformBox.value.x = l.x
    transformBox.value.y = l.y
    transformBox.value.width = l.type === 'blur' ? l.width : (l.type === 'text' ? l.width : Math.round(l.width * l.scaleX))
    transformBox.value.height = l.type === 'blur' ? l.height : (l.type === 'text' ? l.height : Math.round(l.height * l.scaleY))
  }

  requestRenderLayers()
}

function onResizeTransformEnd() {
  window.removeEventListener('mousemove', onResizeTransformDrag)
  window.removeEventListener('mouseup', onResizeTransformEnd)
  syncTransformBox()
  flushRenderLayers()
}

// Memory & GC Optimized History snapshots (eliminates 600ms INP stalls)
function saveHistoryState() {
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  if (history.value.length > 15) {
    history.value.shift()
    historyIndex.value--
  }

  const snapshotLayers: HistoryLayerSnapshot[] = layers.value.map(l => {
    let copyCanvas = l.canvas
    // Only clone the canvas if it's a paint layer with actual drawing pixels
    // Base layer (original image) and text/blur layers do not need duplicate 4K canvas allocations
    if (l.type === 'paint' && l.canvas.width > 0 && l.canvas.height > 0) {
      copyCanvas = document.createElement('canvas')
      copyCanvas.width = l.canvas.width
      copyCanvas.height = l.canvas.height
      const ctx = copyCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(l.canvas, 0, 0)
      }
    }
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      visible: l.visible,
      opacity: l.opacity,
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      scaleX: l.scaleX,
      scaleY: l.scaleY,
      canvas: copyCanvas,
      textData: l.textData ? { ...l.textData } : undefined,
      blurData: l.blurData ? { ...l.blurData } : undefined,
    }
  })

  history.value.push({
    layers: snapshotLayers,
    activeLayerId: activeLayerId.value,
  })
  historyIndex.value = history.value.length - 1
}

function undo() {
  if (textOverlayState.value.active) {
    cancelText()
  }
  if (historyIndex.value > 0) {
    historyIndex.value--
    restoreHistory(historyIndex.value)
  }
}

function redo() {
  if (textOverlayState.value.active) {
    cancelText()
  }
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    restoreHistory(historyIndex.value)
  }
}

function restoreHistory(index: number) {
  const entry = history.value[index]
  if (!entry) return

  layers.value = entry.layers.map(l => {
    let copyCanvas = l.canvas
    if (l.type === 'paint' && l.canvas.width > 0 && l.canvas.height > 0) {
      copyCanvas = document.createElement('canvas')
      copyCanvas.width = l.canvas.width
      copyCanvas.height = l.canvas.height
      const ctx = copyCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(l.canvas, 0, 0)
      }
    }
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      visible: l.visible,
      opacity: l.opacity,
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      scaleX: l.scaleX,
      scaleY: l.scaleY,
      canvas: copyCanvas,
      textData: l.textData ? { ...l.textData } : undefined,
      blurData: l.blurData ? { ...l.blurData } : undefined,
    }
  })

  activeLayerId.value = entry.activeLayerId
  flushRenderLayers()
}

function clearAnnotations() {
  if (textOverlayState.value.active) {
    cancelText()
  }
  if (history.value.length > 0) {
    restoreHistory(0)
    saveHistoryState()
  }
}

// Coordinate conversions and caching
let cachedCanvasRect: DOMRect | null = null

function invalidateRectCache() {
  cachedCanvasRect = null
}

function getCanvasCoordinates(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  if (!cachedCanvasRect) {
    cachedCanvasRect = canvas.getBoundingClientRect()
  }
  const rect = cachedCanvasRect
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

// Draw live brush cursor indicator directly on overlay canvas
function drawHoverCursorOnOverlay(x: number, y: number) {
  const overlay = overlayCanvasRef.value
  if (!overlay) return
  const ctx = getOverlayCtx()
  if (!ctx) return

  ctx.clearRect(0, 0, overlay.width, overlay.height)

  const radius = Math.max(
    currentTool.value === 'highlighter' ? (strokeWidth.value * 2.5) / 2 : strokeWidth.value / 2,
    2
  )

  ctx.save()
  // White outer ring
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Contrasting inner dark ring
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.lineWidth = 0.75
  ctx.stroke()
  ctx.restore()
}

// rAF-throttled hover cursor drawing (eliminates 1000Hz 4K canvas clear operations)
let hoverRafId: number | null = null
let pendingHoverCoords: { x: number; y: number } | null = null

function scheduleHoverCursor(x: number, y: number) {
  pendingHoverCoords = { x, y }
  if (hoverRafId !== null) return
  hoverRafId = requestAnimationFrame(() => {
    hoverRafId = null
    if (pendingHoverCoords && !isDrawing.value) {
      drawHoverCursorOnOverlay(pendingHoverCoords.x, pendingHoverCoords.y)
    }
  })
}

// rAF-throttled shape preview (eliminates CPU stalls during drag preview)
let shapePreviewRafId: number | null = null

function scheduleShapePreview() {
  if (shapePreviewRafId !== null) return
  shapePreviewRafId = requestAnimationFrame(() => {
    shapePreviewRafId = null
    if (isDrawing.value && currentAction.value) {
      drawShapePreviewOnOverlay()
    }
  })
}

// rAF-throttled pan (smooth 60/144fps wheel and spacebar pan)
let pendingPanX = 0
let pendingPanY = 0
let panRafId: number | null = null

function schedulePan(dx: number, dy: number) {
  pendingPanX += dx
  pendingPanY += dy
  if (panRafId !== null) return
  panRafId = requestAnimationFrame(() => {
    panRafId = null
    panX.value += pendingPanX
    panY.value += pendingPanY
    pendingPanX = 0
    pendingPanY = 0
    invalidateRectCache()
  })
}

function onPanDrag(e: MouseEvent) {
  if (!isPanning.value) return
  panX.value = Math.round(e.clientX - panStartX)
  panY.value = Math.round(e.clientY - panStartY)
}

function onPanEnd() {
  if (!isPanning.value) return
  isPanning.value = false
  window.removeEventListener('mousemove', onPanDrag)
  window.removeEventListener('mouseup', onPanEnd)
  invalidateRectCache()
}

// Mouse events
function onMouseDown(e: MouseEvent) {
  invalidateRectCache()
  if (e.button === 1 || currentTool.value === 'pan' || isSpacePressed.value) {
    isPanning.value = true
    panStartX = e.clientX - panX.value
    panStartY = e.clientY - panY.value
    window.addEventListener('mousemove', onPanDrag)
    window.addEventListener('mouseup', onPanEnd)
    return
  }

  if (e.button !== 0) return

  if (currentTool.value === 'move') {
    return
  }

  const coords = getCanvasCoordinates(e)

  if (e.detail >= 2) {
    const hitText = findTextLayerAt(coords)
    if (hitText) {
      isDrawing.value = false
      currentAction.value = null
      const overlay = overlayCanvasRef.value
      if (overlay) {
        getOverlayCtx()?.clearRect(0, 0, overlay.width, overlay.height)
      }
      if (lastStrokeTime && Date.now() - lastStrokeTime < 400 && historyIndex.value > 0) {
        undo()
      }
      editTextLayer(hitText)
      return
    }
  }

  if (currentTool.value === 'text') {
    if (textOverlayState.value.active && textOverlayState.value.text.trim()) {
      commitText()
    }
    textOverlayState.value = {
      active: true,
      x: coords.x,
      y: coords.y,
      text: '',
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
    }
    nextTick(() => {
      textInputRef.value?.focus()
    })
    return
  }

  if (currentTool.value === 'crop') {
    isDrawing.value = true
    cropRect.value = { x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y }
    return
  }

  isDrawing.value = true
  currentAction.value = {
    type: currentTool.value,
    points: [coords],
    x1: coords.x,
    y1: coords.y,
    x2: coords.x,
    y2: coords.y,
    color: strokeColor.value,
    width: strokeWidth.value,
    filled: fillShape.value,
  }
}

function onMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    onPanDrag(e)
    return
  }

  const coords = getCanvasCoordinates(e)

  if (textOverlayState.value.isDragging) {
    textOverlayState.value.x = coords.x - textOverlayState.value.dragStartX
    textOverlayState.value.y = coords.y - textOverlayState.value.dragStartY
    return
  }

  if (!isDrawing.value) {
    if (['pen', 'highlighter', 'arrow', 'rect', 'circle', 'line'].includes(currentTool.value)) {
      scheduleHoverCursor(coords.x, coords.y)
    }
    return
  }

  if (currentTool.value === 'crop' && cropRect.value) {
    cropRect.value.x2 = coords.x
    cropRect.value.y2 = coords.y
    return
  }

  if (!currentAction.value) return

  if (currentTool.value === 'pen' || currentTool.value === 'highlighter') {
    currentAction.value.points?.push(coords)
    drawCurrentStrokeOnOverlay()
  } else {
    currentAction.value.x2 = coords.x
    currentAction.value.y2 = coords.y
    scheduleShapePreview()
  }
}

function onMouseUp() {
  invalidateRectCache()
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId)
    hoverRafId = null
  }
  if (shapePreviewRafId !== null) {
    cancelAnimationFrame(shapePreviewRafId)
    shapePreviewRafId = null
  }

  if (isPanning.value) {
    onPanEnd()
    return
  }

  if (textOverlayState.value.isDragging) {
    textOverlayState.value.isDragging = false
    return
  }

  if (!isDrawing.value) return
  isDrawing.value = false

  if (currentTool.value === 'crop') return

  if (currentAction.value) {
    if (currentAction.value.type === 'blur') {
      // Blur tool creates an independent, transformable Blur Layer!
      const x = Math.min(currentAction.value.x1!, currentAction.value.x2!)
      const y = Math.min(currentAction.value.y1!, currentAction.value.y2!)
      const w = Math.abs(currentAction.value.x2! - currentAction.value.x1!)
      const h = Math.abs(currentAction.value.y2! - currentAction.value.y1!)

      if (w > 4 && h > 4) {
        const blurCount = layers.value.filter(l => l.type === 'blur').length + 1
        const blurLayer: EditorLayer = {
          id: `blur-${Date.now()}`,
          name: `${t('screenshots.layerBlur') || 'Blur'} ${blurCount}`,
          type: 'blur',
          visible: true,
          opacity: 1,
          x,
          y,
          width: w,
          height: h,
          scaleX: 1,
          scaleY: 1,
          canvas: document.createElement('canvas'),
          blurData: {
            x,
            y,
            width: w,
            height: h,
            blockSize: Math.max(8, Math.floor(Math.min(w, h) / 10)),
          },
        }
        layers.value.push(blurLayer)
        activeLayerId.value = blurLayer.id
        currentTool.value = 'pen'
        isTransforming.value = false
        saveHistoryState()
        flushRenderLayers()
      }
    } else if (['rect', 'circle', 'line', 'arrow'].includes(currentAction.value.type)) {
      // Shape tool creates an independent, tightly bounded Layer!
      const action = currentAction.value
      const strokeW = action.width || 4
      const pad = strokeW * 2 + 8

      const rawMinX = Math.min(action.x1!, action.x2!)
      const rawMinY = Math.min(action.y1!, action.y2!)
      const rawMaxX = Math.max(action.x1!, action.x2!)
      const rawMaxY = Math.max(action.y1!, action.y2!)

      const originX = Math.max(0, Math.floor(rawMinX - pad))
      const originY = Math.max(0, Math.floor(rawMinY - pad))
      const boxW = Math.max(20, Math.ceil(rawMaxX - rawMinX + pad * 2))
      const boxH = Math.max(20, Math.ceil(rawMaxY - rawMinY + pad * 2))

      const shapeCanvas = document.createElement('canvas')
      shapeCanvas.width = boxW
      shapeCanvas.height = boxH
      const sCtx = shapeCanvas.getContext('2d')
      if (sCtx) {
        const localAction = {
          ...action,
          x1: action.x1! - originX,
          y1: action.y1! - originY,
          x2: action.x2! - originX,
          y2: action.y2! - originY,
        }
        renderAction(sCtx, localAction)
      }

      const typeName = action.type.charAt(0).toUpperCase() + action.type.slice(1)
      const count = layers.value.filter(l => l.name.startsWith(typeName)).length + 1
      const shapeLayer: EditorLayer = {
        id: `shape-${Date.now()}`,
        name: `${typeName} ${count}`,
        type: 'paint',
        visible: true,
        opacity: 1,
        x: originX,
        y: originY,
        width: boxW,
        height: boxH,
        scaleX: 1,
        scaleY: 1,
        canvas: shapeCanvas,
      }

      layers.value = [...layers.value, shapeLayer]
      activeLayerId.value = shapeLayer.id
      saveHistoryState()
      flushRenderLayers()
    } else {
      // Freehand drawing (pen / highlighter): render to active paint layer
      const targetLayer = ensurePaintLayer()
      const ctx = targetLayer.canvas.getContext('2d')
      if (ctx) {
        drawFullStroke(ctx, currentAction.value)
      }
      saveHistoryState()
      flushRenderLayers()
    }

    // Clear overlay preview canvas
    const overlay = overlayCanvasRef.value
    if (overlay) {
      const oCtx = getOverlayCtx()
      oCtx?.clearRect(0, 0, overlay.width, overlay.height)
    }
    lastStrokeTime = Date.now()
    currentAction.value = null
  }
}

function onMouseLeaveWorkspace() {
  if (hoverRafId !== null) {
    cancelAnimationFrame(hoverRafId)
    hoverRafId = null
  }
  if (shapePreviewRafId !== null) {
    cancelAnimationFrame(shapePreviewRafId)
    shapePreviewRafId = null
  }
  const overlay = overlayCanvasRef.value
  if (overlay && !isDrawing.value) {
    const oCtx = getOverlayCtx()
    oCtx?.clearRect(0, 0, overlay.width, overlay.height)
  }
  if (!isPanning.value) {
    onMouseUp()
  }
}

function startDragTextOverlay(e: MouseEvent) {
  textOverlayState.value.isDragging = true
  const coords = getCanvasCoordinates(e)
  textOverlayState.value.dragStartX = coords.x - textOverlayState.value.x
  textOverlayState.value.dragStartY = coords.y - textOverlayState.value.y
}

function initTextPlacement() {
  if (textOverlayState.value.active) {
    commitText()
  }
  editingTextLayerId.value = null
  currentTool.value = 'text'
  if (canvasRef.value) {
    textOverlayState.value = {
      active: true,
      x: canvasRef.value.width * 0.2,
      y: canvasRef.value.height * 0.3,
      text: '',
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
    }
    nextTick(() => {
      textInputRef.value?.focus()
    })
  }
}

function findTextLayerAt(coords: { x: number; y: number }): EditorLayer | null {
  for (let i = layers.value.length - 1; i >= 0; i--) {
    const l = layers.value[i]
    if (!l.visible || l.type !== 'text') continue
    const w = l.width * Math.abs(l.scaleX || 1)
    const h = l.height * Math.abs(l.scaleY || 1)
    if (coords.x >= l.x && coords.x <= l.x + w && coords.y >= l.y && coords.y <= l.y + h) {
      return l
    }
  }
  return null
}

function editTextLayer(layer: EditorLayer) {
  if (layer.type !== 'text' || !layer.textData) return

  // End transform mode if currently active
  isTransforming.value = false
  transformBox.value = null

  // If another text was active, commit it first
  if (textOverlayState.value.active && editingTextLayerId.value !== layer.id) {
    commitText()
  }

  editingTextLayerId.value = layer.id
  activeLayerId.value = layer.id

  // Load layer properties into tool state
  strokeColor.value = layer.textData.color
  fontSize.value = layer.textData.fontSize
  if (!systemFonts.value.includes(layer.textData.fontFamily)) {
    systemFonts.value.push(layer.textData.fontFamily)
  }
  fontFamily.value = layer.textData.fontFamily
  isBold.value = layer.textData.isBold
  isItalic.value = layer.textData.isItalic
  textBgMode.value = layer.textData.bgMode

  // Position the overlay exactly at the layer's position
  textOverlayState.value = {
    active: true,
    x: layer.x,
    y: layer.y,
    text: layer.textData.text,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  }

  // Switch to text tool so font controls are visible in the toolbar
  currentTool.value = 'text'

  // Hide the layer on canvas while editing so it doesn't appear doubled
  layer.visible = false
  renderAllLayers()

  nextTick(() => {
    if (textInputRef.value) {
      textInputRef.value.focus()
      textInputRef.value.select()
    }
  })
}

function onDoubleClickCanvas(e: MouseEvent) {
  invalidateRectCache()
  const coords = getCanvasCoordinates(e)
  const hit = findTextLayerAt(coords)
  if (hit) {
    editTextLayer(hit)
  }
}

function onDoubleClickTransformBox() {
  if (activeLayer.value && activeLayer.value.type === 'text') {
    editTextLayer(activeLayer.value)
  }
}

function onDoubleClickLayer(layer: EditorLayer) {
  if (layer.type === 'text') {
    editTextLayer(layer)
  }
}

function measureTextBounds(text: string, fontSize: number, fontFamily: string, isBold: boolean, isItalic: boolean) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: 100, height: 40 }
  const fontName = getCssFontFamily(fontFamily)
  ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontName}`
  const lines = text.split('\n')
  let maxW = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxW) maxW = w
  }
  const lineHeight = fontSize * 1.25
  const padding = fontSize * 0.25
  return {
    width: Math.max(maxW + padding * 2, 40),
    height: lines.length * lineHeight + padding * 2,
  }
}

// Text commit creates a separate, movable Text Layer or updates an existing one!
function commitText() {
  if (!textOverlayState.value.active) return
  const text = textOverlayState.value.text.trim()

  if (editingTextLayerId.value) {
    const targetLayer = layers.value.find(l => l.id === editingTextLayerId.value)
    if (targetLayer) {
      if (text) {
        const bounds = measureTextBounds(text, fontSize.value, fontFamily.value, isBold.value, isItalic.value)
        targetLayer.name = `${t('screenshots.layerText') || 'Text'}: ${text.slice(0, 15)}`
        targetLayer.x = textOverlayState.value.x
        targetLayer.y = textOverlayState.value.y
        targetLayer.width = bounds.width
        targetLayer.height = bounds.height
        targetLayer.scaleX = 1
        targetLayer.scaleY = 1
        targetLayer.visible = true
        targetLayer.textData = {
          text,
          color: strokeColor.value,
          fontSize: fontSize.value,
          fontFamily: fontFamily.value,
          isBold: isBold.value,
          isItalic: isItalic.value,
          bgMode: textBgMode.value,
        }
      } else {
        // If text was erased completely, remove the layer
        layers.value = layers.value.filter(l => l.id !== targetLayer.id)
        if (activeLayerId.value === targetLayer.id) {
          activeLayerId.value = layers.value[0]?.id || ''
        }
      }
      saveHistoryState()
      renderAllLayers()
    }
    editingTextLayerId.value = null
  } else if (text) {
    const bounds = measureTextBounds(text, fontSize.value, fontFamily.value, isBold.value, isItalic.value)
    const textLayer: EditorLayer = {
      id: `text-${Date.now()}`,
      name: `${t('screenshots.layerText') || 'Text'}: ${text.slice(0, 15)}`,
      type: 'text',
      visible: true,
      opacity: 1,
      x: textOverlayState.value.x,
      y: textOverlayState.value.y,
      width: bounds.width,
      height: bounds.height,
      scaleX: 1,
      scaleY: 1,
      canvas: document.createElement('canvas'),
      textData: {
        text,
        color: strokeColor.value,
        fontSize: fontSize.value,
        fontFamily: fontFamily.value,
        isBold: isBold.value,
        isItalic: isItalic.value,
        bgMode: textBgMode.value,
      },
    }
    layers.value.push(textLayer)
    activeLayerId.value = textLayer.id
    currentTool.value = 'pen'
    isTransforming.value = false
    saveHistoryState()
    renderAllLayers()
  }

  textOverlayState.value.active = false
  textOverlayState.value.text = ''
}

function cancelText() {
  if (editingTextLayerId.value) {
    const targetLayer = layers.value.find(l => l.id === editingTextLayerId.value)
    if (targetLayer) {
      targetLayer.visible = true
      renderAllLayers()
    }
    editingTextLayerId.value = null
  }
  textOverlayState.value.active = false
  textOverlayState.value.text = ''
}

// Drawing routines
function drawCurrentStrokeOnOverlay() {
  const overlay = overlayCanvasRef.value
  if (!overlay || !currentAction.value) return
  const ctx = getOverlayCtx()
  if (!ctx) return

  const points = currentAction.value.points
  if (!points || points.length < 2) return

  ctx.save()
  ctx.beginPath()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (currentAction.value.type === 'highlighter') {
    ctx.strokeStyle = currentAction.value.color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = currentAction.value.width * 2.5
  } else {
    ctx.strokeStyle = currentAction.value.color
    ctx.lineWidth = currentAction.value.width
  }

  const p1 = points[points.length - 2]
  const p2 = points[points.length - 1]
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
  ctx.restore()
}

function drawFullStroke(ctx: CanvasRenderingContext2D, action: Action) {
  const points = action.points
  if (!points || points.length < 2) return

  ctx.save()
  ctx.beginPath()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (action.type === 'highlighter') {
    ctx.strokeStyle = action.color
    ctx.globalAlpha = 0.35
    ctx.lineWidth = action.width * 2.5
  } else {
    ctx.strokeStyle = action.color
    ctx.lineWidth = action.width
  }

  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawShapePreviewOnOverlay() {
  const overlay = overlayCanvasRef.value
  if (!overlay || !currentAction.value) return
  const ctx = getOverlayCtx()
  if (!ctx) return

  ctx.clearRect(0, 0, overlay.width, overlay.height)
  renderAction(ctx, currentAction.value)
}

function renderAction(ctx: CanvasRenderingContext2D, action: Action) {
  ctx.save()

  if (action.type === 'rect') {
    const x = Math.min(action.x1!, action.x2!)
    const y = Math.min(action.y1!, action.y2!)
    const w = Math.abs(action.x2! - action.x1!)
    const h = Math.abs(action.y2! - action.y1!)

    ctx.strokeStyle = action.color
    ctx.lineWidth = action.width
    if (action.filled) {
      ctx.fillStyle = action.color
      ctx.fillRect(x, y, w, h)
    }
    ctx.strokeRect(x, y, w, h)
  } else if (action.type === 'circle') {
    const cx = (action.x1! + action.x2!) / 2
    const cy = (action.y1! + action.y2!) / 2
    const rx = Math.abs(action.x2! - action.x1!) / 2
    const ry = Math.abs(action.y2! - action.y1!) / 2

    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2)
    ctx.strokeStyle = action.color
    ctx.lineWidth = action.width
    if (action.filled) {
      ctx.fillStyle = action.color
      ctx.fill()
    }
    ctx.stroke()
  } else if (action.type === 'line') {
    ctx.beginPath()
    ctx.moveTo(action.x1!, action.y1!)
    ctx.lineTo(action.x2!, action.y2!)
    ctx.strokeStyle = action.color
    ctx.lineWidth = action.width
    ctx.lineCap = 'round'
    ctx.stroke()
  } else if (action.type === 'arrow') {
    drawArrow(ctx, action.x1!, action.y1!, action.x2!, action.y2!, action.color, action.width)
  } else if (action.type === 'blur') {
    // Preview rectangle for blur region
    const x = Math.min(action.x1!, action.x2!)
    const y = Math.min(action.y1!, action.y2!)
    const w = Math.abs(action.x2! - action.x1!)
    const h = Math.abs(action.y2! - action.y1!)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x, y, w, h)
  }

  ctx.restore()
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  width: number
) {
  const headlen = Math.max(14, width * 3)
  const angle = Math.atan2(toY - fromY, toX - fromX)

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'

  // Main line
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()

  // Arrowhead
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(
    toX - headlen * Math.cos(angle - Math.PI / 6),
    toY - headlen * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    toX - headlen * Math.cos(angle + Math.PI / 6),
    toY - headlen * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// Crop actions
function initCrop() {
  if (textOverlayState.value.active) {
    commitText()
  }
  currentTool.value = 'crop'
  if (canvasRef.value) {
    cropRect.value = {
      x1: canvasRef.value.width * 0.1,
      y1: canvasRef.value.height * 0.1,
      x2: canvasRef.value.width * 0.9,
      y2: canvasRef.value.height * 0.9,
    }
  }
}

function cancelCrop() {
  cropRect.value = null
  currentTool.value = 'pen'
}

function applyCrop() {
  const canvas = canvasRef.value
  if (!canvas || !cropRect.value) return

  const x = Math.round(Math.min(cropRect.value.x1, cropRect.value.x2))
  const y = Math.round(Math.min(cropRect.value.y1, cropRect.value.y2))
  const w = Math.round(Math.abs(cropRect.value.x2 - cropRect.value.x1))
  const h = Math.round(Math.abs(cropRect.value.y2 - cropRect.value.y1))

  if (w < 10 || h < 10) return

  canvas.width = w
  canvas.height = h
  if (overlayCanvasRef.value) {
    overlayCanvasRef.value.width = w
    overlayCanvasRef.value.height = h
  }

  for (const l of layers.value) {
    if (l.type === 'base' || l.type === 'paint') {
      const newC = document.createElement('canvas')
      newC.width = w
      newC.height = h
      const ctx = newC.getContext('2d')
      if (ctx) {
        ctx.drawImage(l.canvas, x, y, w, h, 0, 0, w, h)
      }
      l.canvas = newC
      l.width = w
      l.height = h
    } else {
      l.x -= x
      l.y -= y
      if (l.blurData) {
        l.blurData.x -= x
        l.blurData.y -= y
      }
    }
  }

  cropRect.value = null
  currentTool.value = 'pen'
  saveHistoryState()
  renderAllLayers()
  fitToScreen(w, h)
}

// Invalidate coordinate cache whenever zoom or pan changes
watch([zoom, panX, panY], invalidateRectCache)

// Zoom controls
function zoomIn() {
  zoom.value = Math.min(5, Number((zoom.value + 0.15).toFixed(2)))
  invalidateRectCache()
}

function zoomOut() {
  zoom.value = Math.max(0.05, Number((zoom.value - 0.15).toFixed(2)))
  invalidateRectCache()
}

function resetZoom() {
  if (canvasRef.value) {
    fitToScreen(canvasRef.value.width, canvasRef.value.height)
  }
  invalidateRectCache()
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  } else {
    schedulePan(-e.deltaX, -e.deltaY)
  }
}

// Window Keyboard Shortcuts (works globally across all keyboard layouts!)
function onWindowKeyDown(e: KeyboardEvent) {
  if (!props.modelValue) return

  const isCtrlOrMeta = e.ctrlKey || e.metaKey
  const code = e.code

  // Free Transform shortcut: Ctrl+T or Cmd+T (layout-independent)
  if (isCtrlOrMeta && (code === 'KeyT' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е')) {
    e.preventDefault()
    e.stopPropagation()
    startTransform(activeLayerId.value)
    return
  }

  // Ctrl+Z or Cmd+Z (layout-independent)
  if (isCtrlOrMeta && (code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'я')) {
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
    return
  }

  // Ctrl+Y or Cmd+Y (layout-independent)
  if (isCtrlOrMeta && (code === 'KeyY' || e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'н')) {
    e.preventDefault()
    e.stopPropagation()
    redo()
    return
  }

  // Enter to commit transform
  if ((e.key === 'Enter' || code === 'Enter' || code === 'NumpadEnter') && (isTransforming.value || currentTool.value === 'move')) {
    e.preventDefault()
    commitTransform()
    return
  }

  // Escape key
  if (e.key === 'Escape' || code === 'Escape') {
    e.preventDefault()
    if (isTransforming.value) {
      cancelTransform()
    } else if (currentTool.value === 'crop') {
      cancelCrop()
    } else if (textOverlayState.value.active) {
      cancelText()
    } else {
      close()
    }
    return
  }

  // Spacebar pan mode
  if (code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault()
    if (!isSpacePressed.value) {
      isSpacePressed.value = true
    }
    return
  }

  // If user is typing inside text overlay textarea, ignore single-key tool hotkeys:
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return
  }

  // V: Move / Select tool shortcut (layout-independent)
  if (!isCtrlOrMeta && (code === 'KeyV' || e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'м')) {
    e.preventDefault()
    setTool('move')
    return
  }

  // B or P: Brush / Pen tool shortcut (layout-independent)
  if (!isCtrlOrMeta && (code === 'KeyB' || code === 'KeyP' || e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'и')) {
    e.preventDefault()
    setTool('pen')
    return
  }

  // T: Text tool shortcut (layout-independent)
  if (!isCtrlOrMeta && (code === 'KeyT' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е')) {
    e.preventDefault()
    initTextPlacement()
    return
  }

  // H: Hand / Pan tool shortcut (layout-independent)
  if (!isCtrlOrMeta && (code === 'KeyH' || e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'р')) {
    e.preventDefault()
    setTool('pan')
    return
  }
}

function onWindowKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    if (isPanning.value && currentTool.value !== 'pan') {
      onPanEnd()
    }
  }
}

function onWindowBlur() {
  isSpacePressed.value = false
  if (isPanning.value) {
    onPanEnd()
  }
}

onMounted(() => {
  loadSystemFonts()
  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('keyup', onWindowKeyUp)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('resize', invalidateRectCache)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeyDown)
  window.removeEventListener('keyup', onWindowKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('resize', invalidateRectCache)
  window.removeEventListener('mousemove', onPanDrag)
  window.removeEventListener('mouseup', onPanEnd)
  if (renderLayersRafId !== null) cancelAnimationFrame(renderLayersRafId)
  if (hoverRafId !== null) cancelAnimationFrame(hoverRafId)
  if (shapePreviewRafId !== null) cancelAnimationFrame(shapePreviewRafId)
  if (panRafId !== null) cancelAnimationFrame(panRafId)
  scratchBlurCanvas = null
  scratchBlurCtx = null
})

// Clipboard copy (Silent without toasts as requested)
async function copyToClipboard() {
  if (textOverlayState.value.active) {
    commitText()
  }
  if (isTransforming.value) {
    commitTransform()
  }
  flushRenderLayers()
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.toBlob(async (blob) => {
    if (blob) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } catch {
        // Fallback or ignore silently
      }
    }
  })
}

// Save (Silent without toasts as requested)
async function save(saveAsCopy: boolean) {
  if (textOverlayState.value.active) {
    commitText()
  }
  if (isTransforming.value) {
    commitTransform()
  }
  flushRenderLayers()
  const canvas = canvasRef.value
  if (!canvas) return
  saving.value = true
  try {
    const dataUrl = canvas.toDataURL('image/png')
    emit('save', {
      dataUrl,
      originalUrl: props.screenshot?.url,
      saveAsCopy,
    })
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.screenshot-editor-dialog {
  backdrop-filter: blur(8px);
}

button {
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  color: inherit;
}

input[type='number'] {
  border: none !important;
  outline: none !important;
  background: transparent;
  -moz-appearance: textfield;
  appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.transform-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: #ffffff;
  border: 1.5px solid #1976d2;
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  z-index: 35;
}

.handle-small .transform-handle {
  width: 7px;
  height: 7px;
}

.transform-handle.top-left {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.handle-small .transform-handle.top-left {
  top: -3.5px;
  left: -3.5px;
}

.transform-handle.top-right {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.handle-small .transform-handle.top-right {
  top: -3.5px;
  right: -3.5px;
}

.transform-handle.bottom-left {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.handle-small .transform-handle.bottom-left {
  bottom: -3.5px;
  left: -3.5px;
}

.transform-handle.bottom-right {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.handle-small .transform-handle.bottom-right {
  bottom: -3.5px;
  right: -3.5px;
}

.transform-handle.top-mid {
  top: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}

.transform-handle.bottom-mid {
  bottom: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}

.transform-handle.left-mid {
  top: calc(50% - 5px);
  left: -5px;
  cursor: ew-resize;
}

.transform-handle.right-mid {
  top: calc(50% - 5px);
  right: -5px;
  cursor: ew-resize;
}

.transform-pill {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background: #1976d2;
  color: #ffffff;
  font-size: 10px;
  font-family: monospace;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  cursor: grab;
  white-space: nowrap;
  user-select: none;
  z-index: 40;
  transition: background-color 0.15s, transform 0.15s;
}
.transform-pill:hover {
  background: #1565c0;
  transform: translateX(-50%) scale(1.05);
}
.transform-pill:active {
  cursor: grabbing;
}
</style>
