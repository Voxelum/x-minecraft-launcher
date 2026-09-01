# Enum Opcodes

Defines the JVM opcodes, access flags and array type codes. This interface
does not define all the JVM opcodes because some opcodes are automatically
handled. For example, the xLOAD and xSTORE opcodes are automatically replaced
by xLOAD_n and xSTORE_n opcodes when possible. The xLOAD_n and xSTORE_n
opcodes are therefore not defined in this interface. Likewise for LDC,
automatically replaced by LDC_W or LDC2_W when necessary, WIDE, GOTO_W and
JSR_W.
## 🏷️ Enum Members

### AALOAD

```ts
AALOAD: 50
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L244" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:244</a>
</p>


### AASTORE

```ts
AASTORE: 83
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L270" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:270</a>
</p>


### ACC_ABSTRACT

```ts
ACC_ABSTRACT: 1024
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L90" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:90</a>
</p>


### ACC_ANNOTATION

```ts
ACC_ANNOTATION: 8192
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L96" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:96</a>
</p>


### ACC_BRIDGE

```ts
ACC_BRIDGE: 64
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L80" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:80</a>
</p>


### ACC_DEPRECATED

```ts
ACC_DEPRECATED: 131072
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L102" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:102</a>
</p>


### ACC_ENUM

```ts
ACC_ENUM: 16384
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L98" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:98</a>
</p>


### ACC_FINAL

```ts
ACC_FINAL: 16
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L72" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:72</a>
</p>


### ACC_INTERFACE

```ts
ACC_INTERFACE: 512
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L88" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:88</a>
</p>


### ACC_MANDATED

```ts
ACC_MANDATED: 32768
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L100" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:100</a>
</p>


### ACC_NATIVE

```ts
ACC_NATIVE: 256
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L86" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:86</a>
</p>


### ACC_PRIVATE

```ts
ACC_PRIVATE: 2
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L66" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:66</a>
</p>


### ACC_PROTECTED

```ts
ACC_PROTECTED: 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L68" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:68</a>
</p>


### ACC_PUBLIC

```ts
ACC_PUBLIC: 1
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L64" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:64</a>
</p>


### ACC_STATIC

```ts
ACC_STATIC: 8
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L70" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:70</a>
</p>


### ACC_STRICT

```ts
ACC_STRICT: 2048
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L92" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:92</a>
</p>


### ACC_SUPER

```ts
ACC_SUPER: 32
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L74" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:74</a>
</p>


### ACC_SYNCHRONIZED

```ts
ACC_SYNCHRONIZED: 32
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L76" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:76</a>
</p>


### ACC_SYNTHETIC

```ts
ACC_SYNTHETIC: 4096
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L94" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:94</a>
</p>


### ACC_TRANSIENT

```ts
ACC_TRANSIENT: 128
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L84" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:84</a>
</p>


### ACC_VARARGS

```ts
ACC_VARARGS: 128
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L82" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:82</a>
</p>


### ACC_VOLATILE

```ts
ACC_VOLATILE: 64
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L78" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:78</a>
</p>


### ACONST_NULL

```ts
ACONST_NULL: 1
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L190" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:190</a>
</p>


### ALOAD

```ts
ALOAD: 25
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L234" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:234</a>
</p>


### ANEWARRAY

```ts
ANEWARRAY: 189
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L482" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:482</a>
</p>


### ARETURN

```ts
ARETURN: 176
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L456" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:456</a>
</p>


### ARRAYLENGTH

```ts
ARRAYLENGTH: 190
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L484" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:484</a>
</p>


### ASM4

```ts
ASM4: 262144
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L44" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:44</a>
</p>


### ASM5

```ts
ASM5: 327680
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L46" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:46</a>
</p>


### ASTORE

```ts
ASTORE: 58
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L260" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:260</a>
</p>


### ATHROW

```ts
ATHROW: 191
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L486" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:486</a>
</p>


### BALOAD

```ts
BALOAD: 51
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L246" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:246</a>
</p>


### BASTORE

```ts
BASTORE: 84
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L272" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:272</a>
</p>


### BIPUSH

```ts
BIPUSH: 16
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L220" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:220</a>
</p>


### CALOAD

```ts
CALOAD: 52
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L248" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:248</a>
</p>


### CASTORE

```ts
CASTORE: 85
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L274" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:274</a>
</p>


### CHECKCAST

```ts
CHECKCAST: 192
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L488" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:488</a>
</p>


### D2F

```ts
D2F: 144
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L392" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:392</a>
</p>


### D2I

```ts
D2I: 142
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L388" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:388</a>
</p>


### D2L

```ts
D2L: 143
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L390" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:390</a>
</p>


### DADD

```ts
DADD: 99
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L302" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:302</a>
</p>


### DALOAD

```ts
DALOAD: 49
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L242" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:242</a>
</p>


### DASTORE

```ts
DASTORE: 82
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L268" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:268</a>
</p>


### DCMPG

```ts
DCMPG: 152
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L408" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:408</a>
</p>


### DCMPL

```ts
DCMPL: 151
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L406" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:406</a>
</p>


### DCONST_0

```ts
DCONST_0: 14
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L216" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:216</a>
</p>


### DCONST_1

```ts
DCONST_1: 15
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L218" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:218</a>
</p>


### DDIV

```ts
DDIV: 111
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L326" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:326</a>
</p>


### DLOAD

```ts
DLOAD: 24
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L232" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:232</a>
</p>


### DMUL

```ts
DMUL: 107
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L318" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:318</a>
</p>


### DNEG

```ts
DNEG: 119
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L342" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:342</a>
</p>


### DOUBLE

```ts
DOUBLE: 3
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L180" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:180</a>
</p>


### DREM

```ts
DREM: 115
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L334" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:334</a>
</p>


### DRETURN

```ts
DRETURN: 175
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L454" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:454</a>
</p>


### DSTORE

```ts
DSTORE: 57
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L258" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:258</a>
</p>


### DSUB

```ts
DSUB: 103
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L310" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:310</a>
</p>


### DUP

```ts
DUP: 89
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L282" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:282</a>
</p>


### DUP_X1

```ts
DUP_X1: 90
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L284" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:284</a>
</p>


### DUP_X2

```ts
DUP_X2: 91
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L286" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:286</a>
</p>


### DUP2

```ts
DUP2: 92
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L288" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:288</a>
</p>


### DUP2_X1

```ts
DUP2_X1: 93
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L290" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:290</a>
</p>


### DUP2_X2

```ts
DUP2_X2: 94
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L292" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:292</a>
</p>


### F_APPEND

```ts
F_APPEND: 1
```
Represents a compressed frame where locals are the same as the locals in
the previous frame, except that additional 1-3 locals are defined, and
with an empty stack.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L153" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:153</a>
</p>


### F_CHOP

```ts
F_CHOP: 2
```
Represents a compressed frame where locals are the same as the locals in
the previous frame, except that the last 1-3 locals are absent and with
an empty stack.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L160" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:160</a>
</p>


### F_FULL

```ts
F_FULL: 0
```
Represents a compressed frame with compe frame data.,
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L146" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:146</a>
</p>


### F_NEW

```ts
F_NEW: -1
```
Represents an expanded frame. See [ClassReader#EXPAND_FRAMES].
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L141" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:141</a>
</p>


### F_SAME

```ts
F_SAME: 3
```
Represents a compressed frame with exactly the same locals as the
previous frame and with an empty stack.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L166" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:166</a>
</p>


### F_SAME1

```ts
F_SAME1: 4
```
Represents a compressed frame with exactly the same locals as the
previous frame and with a single value on the stack.
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L172" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:172</a>
</p>


### F2D

```ts
F2D: 141
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L386" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:386</a>
</p>


### F2I

```ts
F2I: 139
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L382" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:382</a>
</p>


### F2L

```ts
F2L: 140
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L384" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:384</a>
</p>


### FADD

```ts
FADD: 98
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L300" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:300</a>
</p>


### FALOAD

```ts
FALOAD: 48
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L240" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:240</a>
</p>


### FASTORE

```ts
FASTORE: 81
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L266" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:266</a>
</p>


### FCMPG

```ts
FCMPG: 150
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L404" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:404</a>
</p>


### FCMPL

```ts
FCMPL: 149
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L402" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:402</a>
</p>


### FCONST_0

```ts
FCONST_0: 11
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L210" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:210</a>
</p>


### FCONST_1

```ts
FCONST_1: 12
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L212" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:212</a>
</p>


### FCONST_2

```ts
FCONST_2: 13
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L214" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:214</a>
</p>


### FDIV

```ts
FDIV: 110
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L324" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:324</a>
</p>


### FLOAD

```ts
FLOAD: 23
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L230" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:230</a>
</p>


### FLOAT

```ts
FLOAT: 2
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L178" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:178</a>
</p>


### FMUL

```ts
FMUL: 106
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L316" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:316</a>
</p>


### FNEG

```ts
FNEG: 118
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L340" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:340</a>
</p>


### FREM

```ts
FREM: 114
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L332" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:332</a>
</p>


### FRETURN

```ts
FRETURN: 174
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L452" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:452</a>
</p>


### FSTORE

```ts
FSTORE: 56
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L256" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:256</a>
</p>


### FSUB

```ts
FSUB: 102
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L308" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:308</a>
</p>


### GETFIELD

```ts
GETFIELD: 180
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L464" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:464</a>
</p>


### GETSTATIC

```ts
GETSTATIC: 178
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L460" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:460</a>
</p>


### GOTO

```ts
GOTO: 167
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L438" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:438</a>
</p>


### H_GETFIELD

```ts
H_GETFIELD: 1
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L120" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:120</a>
</p>


### H_GETSTATIC

```ts
H_GETSTATIC: 2
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L122" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:122</a>
</p>


### H_INVOKEINTERFACE

```ts
H_INVOKEINTERFACE: 9
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L136" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:136</a>
</p>


### H_INVOKESPECIAL

```ts
H_INVOKESPECIAL: 7
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L132" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:132</a>
</p>


### H_INVOKESTATIC

```ts
H_INVOKESTATIC: 6
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L130" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:130</a>
</p>


### H_INVOKEVIRTUAL

```ts
H_INVOKEVIRTUAL: 5
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L128" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:128</a>
</p>


### H_NEWINVOKESPECIAL

```ts
H_NEWINVOKESPECIAL: 8
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L134" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:134</a>
</p>


### H_PUTFIELD

```ts
H_PUTFIELD: 3
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L124" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:124</a>
</p>


### H_PUTSTATIC

```ts
H_PUTSTATIC: 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L126" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:126</a>
</p>


### I2B

```ts
I2B: 145
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L394" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:394</a>
</p>


### I2C

```ts
I2C: 146
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L396" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:396</a>
</p>


### I2D

```ts
I2D: 135
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L374" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:374</a>
</p>


### I2F

```ts
I2F: 134
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L372" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:372</a>
</p>


### I2L

```ts
I2L: 133
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L370" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:370</a>
</p>


### I2S

```ts
I2S: 147
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L398" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:398</a>
</p>


### IADD

```ts
IADD: 96
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L296" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:296</a>
</p>


### IALOAD

```ts
IALOAD: 46
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L236" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:236</a>
</p>


### IAND

```ts
IAND: 126
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L356" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:356</a>
</p>


### IASTORE

```ts
IASTORE: 79
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L262" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:262</a>
</p>


### ICONST_0

```ts
ICONST_0: 3
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L194" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:194</a>
</p>


### ICONST_1

```ts
ICONST_1: 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L196" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:196</a>
</p>


### ICONST_2

```ts
ICONST_2: 5
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L198" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:198</a>
</p>


### ICONST_3

```ts
ICONST_3: 6
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L200" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:200</a>
</p>


### ICONST_4

```ts
ICONST_4: 7
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L202" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:202</a>
</p>


### ICONST_5

```ts
ICONST_5: 8
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L204" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:204</a>
</p>


### ICONST_M1

```ts
ICONST_M1: 2
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L192" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:192</a>
</p>


### IDIV

```ts
IDIV: 108
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L320" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:320</a>
</p>


### IF_ACMPEQ

```ts
IF_ACMPEQ: 165
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L434" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:434</a>
</p>


### IF_ACMPNE

```ts
IF_ACMPNE: 166
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L436" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:436</a>
</p>


### IF_ICMPEQ

```ts
IF_ICMPEQ: 159
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L422" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:422</a>
</p>


### IF_ICMPGE

```ts
IF_ICMPGE: 162
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L428" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:428</a>
</p>


### IF_ICMPGT

```ts
IF_ICMPGT: 163
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L430" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:430</a>
</p>


### IF_ICMPLE

```ts
IF_ICMPLE: 164
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L432" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:432</a>
</p>


### IF_ICMPLT

```ts
IF_ICMPLT: 161
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L426" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:426</a>
</p>


### IF_ICMPNE

```ts
IF_ICMPNE: 160
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L424" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:424</a>
</p>


### IFEQ

```ts
IFEQ: 153
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L410" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:410</a>
</p>


### IFGE

```ts
IFGE: 156
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L416" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:416</a>
</p>


### IFGT

```ts
IFGT: 157
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L418" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:418</a>
</p>


### IFLE

```ts
IFLE: 158
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L420" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:420</a>
</p>


### IFLT

```ts
IFLT: 155
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L414" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:414</a>
</p>


### IFNE

```ts
IFNE: 154
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L412" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:412</a>
</p>


### IFNONNULL

```ts
IFNONNULL: 199
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L500" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:500</a>
</p>


### IFNULL

```ts
IFNULL: 198
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L498" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:498</a>
</p>


### IINC

```ts
IINC: 132
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L368" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:368</a>
</p>


### ILOAD

```ts
ILOAD: 21
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L226" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:226</a>
</p>


### IMUL

```ts
IMUL: 104
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L312" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:312</a>
</p>


### INEG

```ts
INEG: 116
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L336" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:336</a>
</p>


### INSTANCEOF

```ts
INSTANCEOF: 193
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L490" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:490</a>
</p>


### INTEGER

```ts
INTEGER: 1
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L176" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:176</a>
</p>


### INVOKEDYNAMIC

```ts
INVOKEDYNAMIC: 186
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L476" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:476</a>
</p>


### INVOKEINTERFACE

```ts
INVOKEINTERFACE: 185
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L474" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:474</a>
</p>


### INVOKESPECIAL

```ts
INVOKESPECIAL: 183
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L470" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:470</a>
</p>


### INVOKESTATIC

```ts
INVOKESTATIC: 184
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L472" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:472</a>
</p>


### INVOKEVIRTUAL

```ts
INVOKEVIRTUAL: 182
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L468" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:468</a>
</p>


### IOR

```ts
IOR: 128
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L360" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:360</a>
</p>


### IREM

```ts
IREM: 112
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L328" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:328</a>
</p>


### IRETURN

```ts
IRETURN: 172
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L448" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:448</a>
</p>


### ISHL

```ts
ISHL: 120
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L344" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:344</a>
</p>


### ISHR

```ts
ISHR: 122
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L348" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:348</a>
</p>


### ISTORE

```ts
ISTORE: 54
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L252" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:252</a>
</p>


### ISUB

```ts
ISUB: 100
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L304" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:304</a>
</p>


### IUSHR

```ts
IUSHR: 124
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L352" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:352</a>
</p>


### IXOR

```ts
IXOR: 130
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L364" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:364</a>
</p>


### JSR

```ts
JSR: 168
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L440" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:440</a>
</p>


### L2D

```ts
L2D: 138
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L380" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:380</a>
</p>


### L2F

```ts
L2F: 137
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L378" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:378</a>
</p>


### L2I

```ts
L2I: 136
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L376" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:376</a>
</p>


### LADD

```ts
LADD: 97
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L298" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:298</a>
</p>


### LALOAD

```ts
LALOAD: 47
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L238" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:238</a>
</p>


### LAND

```ts
LAND: 127
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L358" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:358</a>
</p>


### LASTORE

```ts
LASTORE: 80
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L264" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:264</a>
</p>


### LCMP

```ts
LCMP: 148
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L400" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:400</a>
</p>


### LCONST_0

```ts
LCONST_0: 9
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L206" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:206</a>
</p>


### LCONST_1

```ts
LCONST_1: 10
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L208" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:208</a>
</p>


### LDC

```ts
LDC: 18
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L224" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:224</a>
</p>


### LDIV

```ts
LDIV: 109
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L322" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:322</a>
</p>


### LLOAD

```ts
LLOAD: 22
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L228" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:228</a>
</p>


### LMUL

```ts
LMUL: 105
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L314" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:314</a>
</p>


### LNEG

```ts
LNEG: 117
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L338" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:338</a>
</p>


### LONG

```ts
LONG: 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L182" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:182</a>
</p>


### LOOKUPSWITCH

```ts
LOOKUPSWITCH: 171
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L446" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:446</a>
</p>


### LOR

```ts
LOR: 129
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L362" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:362</a>
</p>


### LREM

```ts
LREM: 113
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L330" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:330</a>
</p>


### LRETURN

```ts
LRETURN: 173
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L450" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:450</a>
</p>


### LSHL

```ts
LSHL: 121
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L346" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:346</a>
</p>


### LSHR

```ts
LSHR: 123
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L350" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:350</a>
</p>


### LSTORE

```ts
LSTORE: 55
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L254" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:254</a>
</p>


### LSUB

```ts
LSUB: 101
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L306" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:306</a>
</p>


### LUSHR

```ts
LUSHR: 125
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L354" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:354</a>
</p>


### LXOR

```ts
LXOR: 131
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L366" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:366</a>
</p>


### MONITORENTER

```ts
MONITORENTER: 194
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L492" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:492</a>
</p>


### MONITOREXIT

```ts
MONITOREXIT: 195
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L494" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:494</a>
</p>


### MULTIANEWARRAY

```ts
MULTIANEWARRAY: 197
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L496" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:496</a>
</p>


### NEW

```ts
NEW: 187
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L478" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:478</a>
</p>


### NEWARRAY

```ts
NEWARRAY: 188
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L480" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:480</a>
</p>


### NOP

```ts
NOP: 0
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L188" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:188</a>
</p>


### NULL

```ts
NULL: 5
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L184" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:184</a>
</p>


### POP

```ts
POP: 87
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L278" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:278</a>
</p>


### POP2

```ts
POP2: 88
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L280" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:280</a>
</p>


### PUTFIELD

```ts
PUTFIELD: 181
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L466" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:466</a>
</p>


### PUTSTATIC

```ts
PUTSTATIC: 179
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L462" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:462</a>
</p>


### RET

```ts
RET: 169
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L442" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:442</a>
</p>


### RETURN

```ts
RETURN: 177
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L458" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:458</a>
</p>


### SALOAD

```ts
SALOAD: 53
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L250" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:250</a>
</p>


### SASTORE

```ts
SASTORE: 86
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L276" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:276</a>
</p>


### SIPUSH

```ts
SIPUSH: 17
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L222" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:222</a>
</p>


### SWAP

```ts
SWAP: 95
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L294" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:294</a>
</p>


### T_BOOLEAN

```ts
T_BOOLEAN: 4
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L104" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:104</a>
</p>


### T_BYTE

```ts
T_BYTE: 8
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L112" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:112</a>
</p>


### T_CHAR

```ts
T_CHAR: 5
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L106" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:106</a>
</p>


### T_DOUBLE

```ts
T_DOUBLE: 7
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L110" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:110</a>
</p>


### T_FLOAT

```ts
T_FLOAT: 6
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L108" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:108</a>
</p>


### T_INT

```ts
T_INT: 10
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L116" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:116</a>
</p>


### T_LONG

```ts
T_LONG: 11
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L118" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:118</a>
</p>


### T_SHORT

```ts
T_SHORT: 9
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L114" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:114</a>
</p>


### TABLESWITCH

```ts
TABLESWITCH: 170
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L444" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:444</a>
</p>


### TOP

```ts
TOP: 0
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L174" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:174</a>
</p>


### UNINITIALIZED_THIS

```ts
UNINITIALIZED_THIS: 6
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L186" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:186</a>
</p>


### V1_1

```ts
V1_1: 196653
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L48" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:48</a>
</p>


### V1_2

```ts
V1_2: 46
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L50" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:50</a>
</p>


### V1_3

```ts
V1_3: 47
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L52" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:52</a>
</p>


### V1_4

```ts
V1_4: 48
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L54" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:54</a>
</p>


### V1_5

```ts
V1_5: 49
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L56" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:56</a>
</p>


### V1_6

```ts
V1_6: 50
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L58" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:58</a>
</p>


### V1_7

```ts
V1_7: 51
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L60" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:60</a>
</p>


### V1_8

```ts
V1_8: 52
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/asm/libs/Opcodes.ts#L62" target="_blank" rel="noreferrer">packages/asm/libs/Opcodes.ts:62</a>
</p>


