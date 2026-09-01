# Class JSONPlugin

## 🏭 Constructors

### constructor

```ts
JSONPlugin(): JSONPlugin
```
#### Return Type

- `JSONPlugin`


## 🔧 Methods

### transformQuery

```ts
transformQuery(args: PluginTransformQueryArgs): RootOperationNode
```
This is called for each query before it is executed. You can modify the query by
transforming its [OperationNode] tree provided in [PluginTransformQueryArgs.node | args.node]
and returning the transformed tree. You'd usually want to use an [OperationNodeTransformer]
for this.

If you need to pass some query-related data between this method and ``transformResult`` you
can use a ``WeakMap`` with [PluginTransformQueryArgs.queryId | args.queryId] as the key:

````ts
import type {
  KyselyPlugin,
  QueryResult,
  RootOperationNode,
  UnknownRow
} from 'kysely'

interface MyData {
  // ...
}
const data = new WeakMap<any, MyData>()

const plugin = {
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    const something: MyData = {}

    // ...

    data.set(args.queryId, something)

    // ...

    return args.node
  },

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    // ...

    const something = data.get(args.queryId)

    // ...

    return args.result
  }
} satisfies KyselyPlugin
````

You should use a ``WeakMap`` instead of a ``Map`` or some other strong references because ``transformQuery``
is not always matched by a call to ``transformResult`` which would leave orphaned items in the map
and cause a memory leak.
#### Parameters

- **args**: `PluginTransformQueryArgs`
#### Return Type

- `RootOperationNode`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/helper.ts#L28" target="_blank" rel="noreferrer">packages/sqlite/helper.ts:28</a>
</p>


### transformResult

```ts
transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>>
```
This method is called for each query after it has been executed. The result
of the query can be accessed through [PluginTransformResultArgs.result | args.result].
You can modify the result and return the modifier result.
#### Parameters

- **args**: `PluginTransformResultArgs`
#### Return Type

- `Promise<QueryResult<UnknownRow>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/sqlite/helper.ts#L35" target="_blank" rel="noreferrer">packages/sqlite/helper.ts:35</a>
</p>


