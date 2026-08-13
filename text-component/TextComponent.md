# Interface TextComponent


## 🏷️ Properties

### block <Badge type="info" text="optional" />

```ts
block: string
```
A string specifying the coordinates of the block entity from which the NBT value is obtained. The coordinates can be absolute or relative. Useless if  nbt is absent.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L57" target="_blank" rel="noreferrer">packages/text-component/index.ts:57</a>
</p>


### bold <Badge type="info" text="optional" />

```ts
bold: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L72" target="_blank" rel="noreferrer">packages/text-component/index.ts:72</a>
</p>


### clickEvent <Badge type="info" text="optional" />

```ts
clickEvent: { action: ClickEventAction; value: string }
```
Allows for events to occur when the player clicks on text.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L84" target="_blank" rel="noreferrer">packages/text-component/index.ts:84</a>
</p>


### color <Badge type="info" text="optional" />

```ts
color: string
```
The color to render this text in. Valid values are "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray", "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white", and "reset" (cancels out the effects of colors used by parent objects). Technically, "bold", "italic", "underlined", "strikethrough", and "obfuscated" are also accepted, but it may be better practice to use the tags below for such formats.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L71" target="_blank" rel="noreferrer">packages/text-component/index.ts:71</a>
</p>


### entity <Badge type="info" text="optional" />

```ts
entity: string
```
A string specifying the target selector for the entity from which the NBT value is obtained. Useless if  nbt is absent.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L61" target="_blank" rel="noreferrer">packages/text-component/index.ts:61</a>
</p>


### extra <Badge type="info" text="optional" />

```ts
extra: TextComponent[]
```
A list element whose structure repeats this raw JSON text structure. Note that all properties of this object are inherited by children except for text, extra, translate, with, and score.

This means that children retain the same formatting and events as this object unless they explicitly override them.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L67" target="_blank" rel="noreferrer">packages/text-component/index.ts:67</a>
</p>


### hoverEvent <Badge type="info" text="optional" />

```ts
hoverEvent: { action: HoverEventAction; value: string | TextComponent }
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L101" target="_blank" rel="noreferrer">packages/text-component/index.ts:101</a>
</p>


### insertion <Badge type="info" text="optional" />

```ts
insertion: string
```
When the text is shift-clicked by a player, this string is inserted in their chat input. It does not overwrite any existing text the player was writing.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L80" target="_blank" rel="noreferrer">packages/text-component/index.ts:80</a>
</p>


### italic <Badge type="info" text="optional" />

```ts
italic: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L73" target="_blank" rel="noreferrer">packages/text-component/index.ts:73</a>
</p>


### keybind <Badge type="info" text="optional" />

```ts
keybind: string
```
A string that can be used to display the key needed to preform a certain action.
An example is ``key.inventory`` which always displays "E" unless the player has set a different key for opening their inventory.

Ignored when any of the previous fields exist in the root object.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L49" target="_blank" rel="noreferrer">packages/text-component/index.ts:49</a>
</p>


### nbt <Badge type="info" text="optional" />

```ts
nbt: string
```
A string indicating the NBT path used for looking up NBT values from an entity or a block entity. Ignored when any of the previous fields exist in the root object.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L53" target="_blank" rel="noreferrer">packages/text-component/index.ts:53</a>
</p>


### obfuscated <Badge type="info" text="optional" />

```ts
obfuscated: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L76" target="_blank" rel="noreferrer">packages/text-component/index.ts:76</a>
</p>


### score <Badge type="info" text="optional" />

```ts
score: { name: string; objective: string; value: string }
```
A player's score in an objective. Displays nothing if the player is not tracked in the given objective.
Ignored when any of the previous fields exist in the root object.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L26" target="_blank" rel="noreferrer">packages/text-component/index.ts:26</a>
</p>


### selector <Badge type="info" text="optional" />

```ts
selector: string
```
A string containing a selector (@p,@a,@r,@e or @s) and, optionally, selector arguments.

Unlike text, the selector is translated into the correct player/entity names.
If more than one player/entity is detected by the selector, it is displayed in a form such as 'Name1 and Name2' or 'Name1, Name2, Name3, and Name4'.
Ignored when any of the previous fields exist in the root object.

- Clicking a player's name inserted into a /tellraw command this way suggests a command to whisper to that player.
- Shift-clicking a player's name inserts that name into chat.
- Shift-clicking a non-player entity's name inserts its UUID into chat.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L42" target="_blank" rel="noreferrer">packages/text-component/index.ts:42</a>
</p>


### strikethrough <Badge type="info" text="optional" />

```ts
strikethrough: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L75" target="_blank" rel="noreferrer">packages/text-component/index.ts:75</a>
</p>


### text

```ts
text: string
```
A string representing raw text to display directly in chat. Note that selectors such as "@a" and "@p" are not translated into player names; use selector instead. Can use escape characters, such as \n for newline (enter), \t for tab, etc.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L11" target="_blank" rel="noreferrer">packages/text-component/index.ts:11</a>
</p>


### translate <Badge type="info" text="optional" />

```ts
translate: string
```
The translation identifier of text to be displayed using the player's selected language. This identifier is the same as the identifiers found in lang files from assets or resource packs. Ignored when  text exist in the root object.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L15" target="_blank" rel="noreferrer">packages/text-component/index.ts:15</a>
</p>


### underlined <Badge type="info" text="optional" />

```ts
underlined: boolean
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L74" target="_blank" rel="noreferrer">packages/text-component/index.ts:74</a>
</p>


### with <Badge type="info" text="optional" />

```ts
with: string[]
```
A list of chat component arguments and/or string arguments to be used by translate. Useless otherwise.

The arguments are text corresponding to the arguments used by the translation string in the current language, in order (for example, the first list element corresponds to "%1$s" in a translation string). Argument structure repeats this raw JSON text structure.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/text-component/index.ts#L21" target="_blank" rel="noreferrer">packages/text-component/index.ts:21</a>
</p>


