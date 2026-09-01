# Text-component Module

[![npm version](https://img.shields.io/npm/v/@xmcl/text-component.svg)](https://www.npmjs.com/package/@xmcl/text-component)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/text-component.svg)](https://npmjs.com/@xmcl/text-component)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/text-component)](https://packagephobia.now.sh/result?p=@xmcl/text-component)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide functions to parse Minecraft text component.

## Usage

### TextComponent

Create TextComponent from string OR Minecraft's formatted string, like `'§cThis is red'`:

```ts
import { TextComponent, fromFormattedString } from "@xmcl/text-component";
const formattedString: string;
const fromFormatted: TextComponent = fromFormattedString(formattedString);
```

Render the TextComponent to css:

```ts
import { TextComponent, render, RenderNode } from "@xmcl/text-component";
const yourComponent: TextComponent;
const node: RenderNode = render(yourComponent);

node.text; // the text of the node
node.style; // style of the node
node.children; // children

// you can render in dom like this:

function renderToDom(node: RenderNode) {
    const span = document.createElement('span');
    span.style = node.style;
    span.textContent = node.text;
    for (const child of node.children) {
        span.appendChild(renderToDom(child));
    }
}
```

Iterate the TextComponent and its children:

```ts
import { TextComponent, flat } from "@xmcl/text-component";
const yourComponent: TextComponent;
const selfAndAllChildren: Array<TextComponent> = flat(yourComponent);
```

## 🤝 Interfaces

<div class="definition-grid interface"><a href="text-component/Style">Style</a><a href="text-component/TextComponent">TextComponent</a></div>

## 🏭 Functions

### flat

```ts
flat(component: TextComponent): TextComponent[]
```
Flat all components (this component and its children) in this component by DFS into a list.
#### Parameters

- **component**: `TextComponent`
The root component
#### Return Type

- `TextComponent[]`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L195" target="_blank" rel="noreferrer">packages/text-component/index.ts:195</a>
</p>


### fromFormattedString

```ts
fromFormattedString(formatted: string): TextComponent
```
Convert a formatted string to text component json
#### Parameters

- **formatted**: `string`
The formatted string
#### Return Type

- `TextComponent`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L223" target="_blank" rel="noreferrer">packages/text-component/index.ts:223</a>
</p>


### getStyleCode

```ts
getStyleCode(style: TextComponent): string
```
Get Minecraft style code for the style
#### Parameters

- **style**: `TextComponent`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L138" target="_blank" rel="noreferrer">packages/text-component/index.ts:138</a>
</p>


### getSuggestedStyle

```ts
getSuggestedStyle(style: TextComponent | Style): object
```
Get suggest css style object for input style
#### Parameters

- **style**: `TextComponent | Style`
#### Return Type

- `object`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L169" target="_blank" rel="noreferrer">packages/text-component/index.ts:169</a>
</p>


### render

```ts
render(src: TextComponent): RenderNode
```
Render a text component into html style object
#### Parameters

- **src**: `TextComponent`
#### Return Type

- `RenderNode`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L183" target="_blank" rel="noreferrer">packages/text-component/index.ts:183</a>
</p>


### toFormattedString

```ts
toFormattedString(comp: TextComponent): string
```
Convert a text component to Minecraft specific formatted string like ``§1colored§r``
#### Parameters

- **comp**: `TextComponent`
#### Return Type

- `string`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L208" target="_blank" rel="noreferrer">packages/text-component/index.ts:208</a>
</p>



## ⏩ Type Aliases

### ClickEventAction

```ts
ClickEventAction: "open_file" | "open_url" | "run_command" | "suggest_command"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L120" target="_blank" rel="noreferrer">packages/text-component/index.ts:120</a>
</p>


### HoverEventAction

```ts
HoverEventAction: "show_text" | "show_item" | "show_entity"
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L121" target="_blank" rel="noreferrer">packages/text-component/index.ts:121</a>
</p>


### RenderNode

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L151" target="_blank" rel="noreferrer">packages/text-component/index.ts:151</a>
</p>



