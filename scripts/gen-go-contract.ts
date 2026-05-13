#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * gen-go-contract.ts
 *
 * Reads service interfaces, state classes, and event maps from
 * `xmcl-runtime-api/src/services/` and `xmcl-runtime-api/src/entities/`,
 * and emits a Go `contract` package that mirrors them. The Go side
 * implements the generated interfaces; the generated dispatcher routes
 * incoming `Bridge.Invoke(serviceKey, method, args)` calls to typed
 * Go method calls. The generator also emits:
 *
 * - Entity structs for every type referenced as a parameter or return.
 * - State structs for every class in `xmcl-runtime-api/src/state.ts`'s
 *   `AllStates` array (`Settings`, `InstanceState`, …) plus
 *   `Register<Name>` factory helpers that wire the renderer-driven
 *   mutator round-trip into `bridge.StateManager`.
 * - `<Service>Events` typed event helpers for every service whose
 *   interface carries an EventMap (e.g. `LaunchServiceEventMap`).
 *
 * Output: xmcl-wails-app/internal/contract/contract.gen.go
 *
 * Re-run with `pnpm gen:go` after editing any TS service / entity file.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ClassDeclaration,
  InterfaceDeclaration,
  MethodSignature,
  Node,
  Project,
  PropertyDeclaration,
  PropertySignature,
  SyntaxKind,
  Type,
  TypeAliasDeclaration,
  TypeNode,
} from 'ts-morph'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RUNTIME_API_DIR = join(ROOT, 'xmcl-runtime-api')
const STATE_TS = join(RUNTIME_API_DIR, 'src', 'state.ts')
const OUTPUT_FILE = join(
  ROOT,
  'xmcl-wails-app',
  'internal',
  'contract',
  'contract.gen.go',
)
const SERVICES_DIR = join(ROOT, 'xmcl-wails-app', 'internal', 'services')
const REGISTRY_FILE = join(SERVICES_DIR, 'registry.gen.go')

// =============================================================================
// Naming helpers
// =============================================================================

function toGoExported(name: string): string {
  if (!name) return name
  // Strip leading underscores so the field is exported in Go; the JSON
  // tag still carries the original wire-name.
  let s = name.replace(/^_+/, '')
  if (!s) s = 'Field' + name.replace(/[^A-Za-z0-9]/g, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function jsonTag(name: string): string {
  return `\`json:"${name}"\``
}

function safeParam(name: string): string {
  const reserved = new Set([
    'type', 'func', 'range', 'select', 'chan', 'map', 'len', 'cap',
    'new', 'make', 'string', 'int', 'bool', 'byte', 'rune', 'error',
  ])
  return reserved.has(name) ? name + '_' : name
}

function eventNameToGo(eventName: string): string {
  return eventName.split(/[-_]/).map((p) => toGoExported(p)).join('')
}

function shorten(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > 80 ? flat.slice(0, 77) + '...' : flat
}

// =============================================================================
// Type translation
// =============================================================================

interface GoTypeRef {
  text: string
  isPointer?: boolean
  isSharedState?: boolean
  isVoid?: boolean
}

class TypeMapper {
  emittedStructs = new Set<string>()
  structQueue: { name: string; declaration: InterfaceDeclaration | ClassDeclaration }[] = []
  warnings: string[] = []

  /** Names whose struct body will be emitted by another path (e.g. state
   *  classes are emitted via the state pipeline, not the entity pipeline). */
  skipStructEmission = new Set<string>()

  fromNode(node: TypeNode | undefined): GoTypeRef {
    if (!node) return { text: 'any' }

    if (node.getKind() === SyntaxKind.ArrayType) {
      const arr = node.asKindOrThrow(SyntaxKind.ArrayType)
      const inner = this.fromNode(arr.getElementTypeNode())
      return { text: '[]' + inner.text }
    }

    if (node.getKind() === SyntaxKind.TupleType) {
      return { text: '[]any' }
    }

    if (node.getKind() === SyntaxKind.UnionType) {
      const union = node.asKindOrThrow(SyntaxKind.UnionType)
      const types = union.getTypeNodes()
      const nonNullish = types.filter((tn) => {
        const txt = tn.getText().trim()
        return txt !== 'undefined' && txt !== 'null'
      })
      if (nonNullish.length === 1) {
        return this.pointerize(this.fromNode(nonNullish[0]))
      }
      const allTexts = nonNullish.map((tn) => tn.getText().trim())
      if (nonNullish.every((tn) => tn.getKind() === SyntaxKind.LiteralType &&
          /^['"`].*['"`]$/.test(tn.getText().trim()))) {
        return { text: 'string' }
      }
      if (allTexts.includes('string') &&
          allTexts.every((t) => t === 'string' || /^['"`].*['"`]$/.test(t))) {
        return { text: 'string' }
      }
      if (allTexts.includes('number') &&
          allTexts.every((t) => t === 'number' || /^-?\d+(\.\d+)?$/.test(t))) {
        return { text: 'float64' }
      }
      if (allTexts.includes('boolean')) {
        return { text: 'any' }
      }
      this.warnings.push(`Unsupported union: ${shorten(node.getText())} → any`)
      return { text: 'any' }
    }

    if (node.getKind() === SyntaxKind.IntersectionType) {
      this.warnings.push(`Intersection: ${shorten(node.getText())} → map[string]any`)
      return { text: 'map[string]any' }
    }

    if (node.getKind() === SyntaxKind.TypeReference) {
      const ref = node.asKindOrThrow(SyntaxKind.TypeReference)
      const name = ref.getTypeName().getText()
      const args = ref.getTypeArguments()

      switch (name) {
        case 'Promise':
        case 'Awaited':
          return args[0] ? this.fromNode(args[0]) : { text: 'any' }
        case 'SharedState':
          return { text: '*bridge.SharedState', isPointer: true, isSharedState: true }
        case 'Array':
        case 'ReadonlyArray': {
          const inner = args[0] ? this.fromNode(args[0]) : { text: 'any' }
          return { text: '[]' + inner.text }
        }
        case 'Record': {
          const keyTxt = args[0]?.getText() ?? 'string'
          const goKey = keyTxt === 'number' ? 'float64' : 'string'
          const valGo = args[1] ? this.fromNode(args[1]) : { text: 'any' }
          return { text: `map[${goKey}]${valGo.text}` }
        }
        case 'Partial':
        case 'Required':
        case 'Readonly':
          return args[0] ? this.fromNode(args[0]) : { text: 'any' }
        case 'Date':
          return { text: 'time.Time' }
        case 'Buffer':
        case 'Uint8Array':
          return { text: '[]byte' }
        case 'Exception':
        case 'Error':
          // Errors travel as serialized objects through the bridge.
          return { text: 'any' }
      }

      let sym = ref.getTypeName().getSymbol()
      if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
      if (sym) {
        for (const decl of sym.getDeclarations()) {
          if (decl.getKind() === SyntaxKind.InterfaceDeclaration ||
              decl.getKind() === SyntaxKind.ClassDeclaration) {
            const named = decl as InterfaceDeclaration | ClassDeclaration
            const declName = named.getName()
            if (declName) {
              this.queueStruct(declName, named)
              return { text: declName }
            }
          }
          if (decl.getKind() === SyntaxKind.TypeAliasDeclaration) {
            const aliased = (decl as TypeAliasDeclaration).getTypeNode()
            if (aliased) return this.fromNode(aliased)
          }
          if (decl.getKind() === SyntaxKind.EnumDeclaration) {
            return { text: 'string' }
          }
          if (decl.getKind() === SyntaxKind.TypeParameter) {
            // Generic placeholder — opaque.
            return { text: 'any' }
          }
        }
      }

      if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) {
        this.warnings.push(`Unresolved type reference: ${name} (assumed entity)`)
        return { text: name }
      }
      this.warnings.push(`Unmapped type reference: ${name} → any`)
      return { text: 'any' }
    }

    if (node.getKind() === SyntaxKind.TypeLiteral) {
      return { text: 'map[string]any' }
    }

    if (node.getKind() === SyntaxKind.FunctionType) {
      this.warnings.push(`Function-typed parameter → any (${shorten(node.getText())})`)
      return { text: 'any' }
    }

    return this.fromPrimitiveText(node.getText().trim())
  }

  fromPrimitiveText(t: string): GoTypeRef {
    if (/^['"`].*['"`]$/.test(t)) return { text: 'string' }
    if (/^-?\d+(\.\d+)?$/.test(t)) return { text: 'float64' }
    switch (t) {
      case 'string': return { text: 'string' }
      case 'number': return { text: 'float64' }
      case 'boolean':
      case 'true':
      case 'false': return { text: 'bool' }
      case 'void': return { text: '', isVoid: true }
      case 'undefined':
      case 'null':
      case 'unknown':
      case 'any': return { text: 'any' }
      case 'object': return { text: 'map[string]any' }
    }
    this.warnings.push(`Unmapped primitive/text: ${t} → any`)
    return { text: 'any' }
  }

  pointerize(ref: GoTypeRef): GoTypeRef {
    if (ref.isPointer || ref.isVoid || !ref.text) return ref
    if (ref.text === 'any') return ref
    if (ref.text.startsWith('[]')) return ref
    if (ref.text.startsWith('map[')) return ref
    if (ref.text.startsWith('*')) return ref
    return { ...ref, text: '*' + ref.text, isPointer: true }
  }

  queueStruct(name: string, decl: InterfaceDeclaration | ClassDeclaration) {
    if (this.emittedStructs.has(name)) return
    this.emittedStructs.add(name)
    this.structQueue.push({ name, declaration: decl })
  }
}

// =============================================================================
// Service emission
// =============================================================================

interface MethodSpec {
  goName: string
  tsName: string
  params: { name: string; goType: string; optional: boolean }[]
  ret: GoTypeRef
}

interface EventSpec {
  tsName: string
  goName: string
  payloadGoType: string
}

interface ServiceSpec {
  name: string
  methods: MethodSpec[]
  events: EventSpec[]
}

function collectMethods(iface: InterfaceDeclaration, mapper: TypeMapper): MethodSpec[] {
  const seen = new Set<string>()
  const methods: MethodSpec[] = []

  function add(m: MethodSpec) {
    if (seen.has(m.tsName)) return
    seen.add(m.tsName)
    methods.push(m)
  }

  function visit(target: InterfaceDeclaration) {
    for (const sig of target.getMethods()) add(buildMethod(sig.getName(), sig, mapper))
    for (const prop of target.getProperties()) {
      const node = prop.getTypeNode()
      if (!node) continue
      if (node.getKind() === SyntaxKind.FunctionType) {
        add(buildPropertyMethod(prop, mapper))
      }
    }
    for (const ext of target.getExtends()) {
      let sym = ext.getExpression().getSymbol()
      if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
      if (!sym) continue
      for (const d of sym.getDeclarations()) {
        if (d.getKind() === SyntaxKind.InterfaceDeclaration) {
          const ifaceDecl = d as InterfaceDeclaration
          // Skip GenericEventEmitter — events are handled separately.
          if (ifaceDecl.getName() === 'GenericEventEmitter') continue
          visit(ifaceDecl)
        }
      }
    }
  }

  visit(iface)
  return methods
}

function buildMethod(name: string, sig: MethodSignature, mapper: TypeMapper): MethodSpec {
  const params = sig.getParameters().map((p) => ({
    name: p.getName(),
    goType: mapper.fromNode(p.getTypeNode()).text || 'any',
    optional: p.hasQuestionToken() || p.isOptional() || !!p.getInitializer(),
  }))
  const ret = mapper.fromNode(sig.getReturnTypeNode())
  return { goName: toGoExported(name), tsName: name, params, ret }
}

function buildPropertyMethod(prop: PropertySignature, mapper: TypeMapper): MethodSpec {
  const fn = prop.getTypeNodeOrThrow().asKindOrThrow(SyntaxKind.FunctionType)
  const params = fn.getParameters().map((p) => ({
    name: p.getName(),
    goType: mapper.fromNode(p.getTypeNode()).text || 'any',
    optional: p.hasQuestionToken() || p.isOptional() || !!p.getInitializer(),
  }))
  const ret = mapper.fromNode(fn.getReturnTypeNode())
  return { goName: toGoExported(prop.getName()), tsName: prop.getName(), params, ret }
}

function findEventMap(iface: InterfaceDeclaration): InterfaceDeclaration | undefined {
  const name = iface.getName() + 'EventMap'
  return iface.getSourceFile().getInterface(name)
}

function collectEvents(iface: InterfaceDeclaration, mapper: TypeMapper): EventSpec[] {
  const evMap = findEventMap(iface)
  if (!evMap) return []
  const out: EventSpec[] = []
  for (const prop of evMap.getProperties()) {
    const tsName = prop.getName().replace(/^['"`]|['"`]$/g, '')
    const payload = mapper.fromNode(prop.getTypeNode())
    out.push({
      tsName,
      goName: eventNameToGo(tsName),
      payloadGoType: payload.text || 'any',
    })
  }
  return out
}

function emitInterface(spec: ServiceSpec): string {
  const lines = [
    `// ${spec.name} mirrors the TS interface of the same name in`,
    `// xmcl-runtime-api/src/services/${spec.name}.ts.`,
    `type ${spec.name} interface {`,
  ]
  for (const m of spec.methods) {
    const paramsGo = ['ctx context.Context', ...m.params.map((p) => `${safeParam(p.name)} ${p.goType}`)]
    const ret = m.ret.isVoid || !m.ret.text ? 'error' : `(${m.ret.text}, error)`
    lines.push(`\t${m.goName}(${paramsGo.join(', ')}) ${ret}`)
  }
  lines.push('}')
  return lines.join('\n')
}

function emitDispatcher(spec: ServiceSpec): string {
  const cases = spec.methods.map((m) => {
    const argDecodes: string[] = []
    const callArgs: string[] = ['cctx.AsContext()']
    m.params.forEach((p, i) => {
      const local = `arg${i}`
      const decoder = p.optional ? 'decodeOptionalArg' : 'decodeArg'
      argDecodes.push(
        `\t\tvar ${local} ${p.goType}`,
        `\t\tif err := ${decoder}(args, ${i}, &${local}); err != nil {`,
        `\t\t\treturn nil, fmt.Errorf("${spec.name}.${m.tsName}: %w", err)`,
        `\t\t}`,
      )
      callArgs.push(local)
    })
    const callExpr = `svc.${m.goName}(${callArgs.join(', ')})`
    let body: string
    if (m.ret.isVoid || !m.ret.text) {
      body = `\t\tif err := ${callExpr}; err != nil { return nil, err }\n\t\treturn nil, nil`
    } else if (m.ret.isSharedState) {
      body = `\t\tresult, err := ${callExpr}\n\t\tif err != nil { return nil, err }\n\t\treturn cctx.SerializeState(result)`
    } else {
      body = `\t\tresult, err := ${callExpr}\n\t\tif err != nil { return nil, err }\n\t\treturn result, nil`
    }
    return [`\tcase "${m.tsName}":`, ...argDecodes, body].join('\n')
  })

  return [
    `// New${spec.name}Adapter wraps a ${spec.name} into a bridge.Service.`,
    `func New${spec.name}Adapter(svc ${spec.name}) bridge.Service {`,
    `\treturn bridge.ServiceFunc(func(cctx *bridge.CallContext, method string, args []any) (any, error) {`,
    `\t\treturn dispatch${spec.name}(cctx, svc, method, args)`,
    `\t})`,
    `}`,
    ``,
    `func dispatch${spec.name}(cctx *bridge.CallContext, svc ${spec.name}, method string, args []any) (any, error) {`,
    `\tswitch method {`,
    cases.join('\n'),
    `\t}`,
    `\treturn nil, fmt.Errorf("ServiceMethodNotFoundError: ${spec.name}.%s", method)`,
    `}`,
  ].join('\n')
}

function emitEventHelper(spec: ServiceSpec): string {
  if (spec.events.length === 0) return ''
  const lines = [
    `// ${spec.name}Events is the typed event broadcaster for ${spec.name}.`,
    `// Service implementations create one with New${spec.name}Events(b) and`,
    `// call EmitXxx(payload) to fan events out to the renderer.`,
    `type ${spec.name}Events struct {`,
    `\tbridge *bridge.Bridge`,
    `}`,
    ``,
    `// New${spec.name}Events constructs an event broadcaster bound to b.`,
    `func New${spec.name}Events(b *bridge.Bridge) *${spec.name}Events {`,
    `\treturn &${spec.name}Events{bridge: b}`,
    `}`,
  ]
  for (const ev of spec.events) {
    lines.push(
      ``,
      `// Emit${ev.goName} broadcasts the \`${ev.tsName}\` event.`,
      `func (e *${spec.name}Events) Emit${ev.goName}(payload ${ev.payloadGoType}) {`,
      `\te.bridge.EmitServiceEvent("${spec.name}", "${ev.tsName}", []any{payload})`,
      `}`,
    )
  }
  return lines.join('\n')
}

/**
 * Emit a `<Name>NotImplemented` stub that satisfies the service
 * interface by returning the canonical "not implemented" error from
 * every method. Real implementations embed the stub and override only
 * the methods they support — everything else routes to the stub.
 */
function emitNotImplementedStub(spec: ServiceSpec): string {
  const lines = [
    `// ${spec.name}NotImplemented satisfies ${spec.name} by returning a`,
    `// "not implemented" error from every method. Embed it in a real`,
    `// service implementation and override only the methods you support.`,
    `type ${spec.name}NotImplemented struct{}`,
    ``,
    `// Compile-time check that the stub satisfies the contract.`,
    `var _ ${spec.name} = (*${spec.name}NotImplemented)(nil)`,
  ]
  for (const m of spec.methods) {
    const paramsGo = ['_ context.Context', ...m.params.map((p) => `_ ${p.goType}`)]
    const returnsErrOnly = m.ret.isVoid || !m.ret.text
    const sig = `func (${spec.name}NotImplemented) ${m.goName}(${paramsGo.join(', ')})`
    if (returnsErrOnly) {
      lines.push(``, `${sig} error {`, `\treturn notImplemented("${spec.name}.${m.tsName}")`, `}`)
    } else {
      lines.push(
        ``,
        `${sig} (${m.ret.text}, error) {`,
        `\tvar zero ${m.ret.text}`,
        `\treturn zero, notImplemented("${spec.name}.${m.tsName}")`,
        `}`,
      )
    }
  }
  return lines.join('\n')
}

function notImplementedHelper(): string {
  return `// notImplemented is the canonical error returned by the *NotImplemented
// stubs. Service implementations override individual methods on a case-
// by-case basis as they become available.
func notImplemented(method string) error {
\treturn fmt.Errorf("ServiceMethodNotImplemented: %s", method)
}`
}

// =============================================================================
// Service skeleton scaffolding
// =============================================================================

/**
 * Map a TS service interface name to the Go package directory name. We
 * lowercase and strip the trailing "Service" so the package import path
 * stays short ("BaseService" → "base", "InstanceModsGroupService" →
 * "instancemodsgroup"). The trade-off is that the package basename no
 * longer contains "Service", which reads cleanly in import sites
 * (`basesvc.New(...)`).
 */
function pkgNameForService(name: string): string {
  const trimmed = name.replace(/Service$/, '')
  return trimmed.toLowerCase()
}

/** Per-service skeleton file. Created once; never overwritten. */
function emitServiceSkeleton(name: string): string {
  const pkg = pkgNameForService(name)
  return `// Package ${pkg} implements contract.${name}.
//
// Scaffold: the embedded NotImplemented stub provides default behaviour
// for every method on the contract. Override individual methods on
// *Service as the underlying subsystem lands during the G3+ phases.
package ${pkg}

import (
\t"github.com/voxelum/xmcl/wails/internal/bridge"
\t"github.com/voxelum/xmcl/wails/internal/contract"
\t"github.com/voxelum/xmcl/wails/internal/host"
)

// Service implements contract.${name}.
type Service struct {
\tcontract.${name}NotImplemented

\thost   *host.Host
\tstates *bridge.StateManager
}

// New constructs a ${name} bound to the given host & state manager.
func New(h *host.Host, sm *bridge.StateManager) *Service {
\treturn &Service{host: h, states: sm}
}

// Compile-time assertion that we implement the generated contract.
var _ contract.${name} = (*Service)(nil)
`
}

/**
 * Aggregator that wires every service into the bridge. Always
 * regenerated; users who need custom wiring should do it in main.go
 * AFTER calling RegisterAll, which simply overwrites entries.
 */
function emitServicesRegistry(serviceSpecs: ServiceSpec[]): string {
  const sorted = [...serviceSpecs].sort((a, b) => a.name.localeCompare(b.name))
  const imports = sorted.map((s) =>
    `\t${pkgNameForService(s.name)}svc "github.com/voxelum/xmcl/wails/internal/services/${pkgNameForService(s.name)}"`,
  ).join('\n')
  const registers = sorted.map((s) =>
    `\tb.Register("${s.name}", contract.New${s.name}Adapter(${pkgNameForService(s.name)}svc.New(h, b.States())))`,
  ).join('\n')

  return `// Code generated by scripts/gen-go-contract.ts. DO NOT EDIT.

// Package services aggregates every concrete service implementation
// behind a single RegisterAll call.
package services

import (
\t"github.com/voxelum/xmcl/wails/internal/bridge"
\t"github.com/voxelum/xmcl/wails/internal/contract"
\t"github.com/voxelum/xmcl/wails/internal/host"

${imports}
)

// RegisterAll wires every service into the bridge. Should be called
// AFTER contract.RegisterStubs(b) so real adapters overwrite the
// "not implemented" stubs.
func RegisterAll(b *bridge.Bridge, h *host.Host) {
${registers}
}
`
}

// =============================================================================
// Struct emission
// =============================================================================

// resolveComputedPropName tries to evaluate a TS computed property
// key (e.g. `[ResourceType.Fabric]`) to its string-literal constant
// value. Returns the resolved string, or undefined if the expression
// can't be evaluated statically.
function resolveComputedPropName(prop: PropertySignature | PropertyDeclaration): string | undefined {
  const nameNode = prop.getNameNode()
  if (!nameNode) return undefined
  if (nameNode.getKind() !== SyntaxKind.ComputedPropertyName) return undefined
  const expr = (nameNode as any).getExpression?.() as Node | undefined
  if (!expr) return undefined
  // The type of the computed expression should resolve to a string
  // literal type (e.g. "fabric") because TS enums backed by string
  // literals propagate that literal through PropertyAccessExpression.
  const t = expr.getType()
  if (t.isStringLiteral()) {
    const v = t.getLiteralValue()
    if (typeof v === 'string') return v
  }
  // String-literal expressions like `["fabric"]` are also handled
  // via getText after stripping quotes.
  if (expr.getKind() === SyntaxKind.StringLiteral) {
    return expr.getText().slice(1, -1)
  }
  return undefined
}

function emitStruct(name: string, decl: InterfaceDeclaration | ClassDeclaration, mapper: TypeMapper): string {
  const lines: string[] = [`// ${name} mirrors xmcl-runtime-api ${name}.`]
  lines.push(`type ${name} struct {`)

  const propsByName = new Map<string, PropertySignature | PropertyDeclaration>()
  // hasOpenExtends tracks whether the TS source carries an `extends`
  // clause whose parent we couldn't walk (e.g. it points at a type
  // alias of a Partial<...> / mapped type). When true we add a
  // free-form `Extra` map field + custom UnmarshalJSON so the wire
  // doesn't drop the inherited dynamic keys.
  let hasOpenExtends = false

  function collectFrom(d: InterfaceDeclaration | ClassDeclaration) {
    if (d.getKind() === SyntaxKind.InterfaceDeclaration) {
      const iface = d as InterfaceDeclaration
      for (const p of iface.getProperties()) {
        if (!propsByName.has(p.getName())) propsByName.set(p.getName(), p)
      }
      for (const ext of iface.getExtends()) {
        let sym = ext.getExpression().getSymbol()
        if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
        if (!sym) { hasOpenExtends = true; continue }
        let extendedAnInterface = false
        for (const extDecl of sym.getDeclarations()) {
          if (extDecl.getKind() === SyntaxKind.InterfaceDeclaration ||
              extDecl.getKind() === SyntaxKind.ClassDeclaration) {
            extendedAnInterface = true
            collectFrom(extDecl as InterfaceDeclaration | ClassDeclaration)
          }
        }
        // Extending anything other than an interface/class (a type
        // alias to a mapped type, an index signature, etc.) means we
        // can't statically enumerate the inherited keys. Mark this
        // struct as "open" so callers don't lose those fields.
        if (!extendedAnInterface) hasOpenExtends = true
      }
    } else {
      const cls = d as ClassDeclaration
      for (const p of cls.getProperties()) {
        if (!propsByName.has(p.getName())) propsByName.set(p.getName(), p)
      }
      const baseTypes = cls.getExtends()
      if (baseTypes) {
        let sym = baseTypes.getExpression().getSymbol()
        if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
        if (sym) {
          for (const extDecl of sym.getDeclarations()) {
            if (extDecl.getKind() === SyntaxKind.InterfaceDeclaration ||
                extDecl.getKind() === SyntaxKind.ClassDeclaration) {
              collectFrom(extDecl as InterfaceDeclaration | ClassDeclaration)
            }
          }
        }
      }
      for (const impl of cls.getImplements()) {
        let sym = impl.getExpression().getSymbol()
        if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
        if (!sym) continue
        for (const implDecl of sym.getDeclarations()) {
          if (implDecl.getKind() === SyntaxKind.InterfaceDeclaration ||
              implDecl.getKind() === SyntaxKind.ClassDeclaration) {
            collectFrom(implDecl as InterfaceDeclaration | ClassDeclaration)
          }
        }
      }
    }
  }
  collectFrom(decl)

  // Stable, well-known field names so callers can navigate the
  // generated structs from non-generated code without surprises.
  const knownFields: string[] = []
  for (const [rawName, prop] of propsByName) {
    // Resolve TS computed-property keys (e.g. `[ResourceType.Fabric]`)
    // to their string-literal value via the type-checker. Falls back
    // to the raw name when the expression isn't a constant we can
    // evaluate.
    let propName = rawName
    if (rawName.startsWith('[')) {
      const resolved = resolveComputedPropName(prop)
      if (!resolved) {
        mapper.warnings.push(`Skipped computed key in ${name}: ${rawName}`)
        continue
      }
      propName = resolved
    }
    // Skip empty / non-identifier names defensively.
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propName)) {
      mapper.warnings.push(`Skipped non-identifier key in ${name}: ${propName}`)
      continue
    }
    const tn = prop.getTypeNode()
    let goType: string
    if (tn) {
      goType = mapper.fromNode(tn).text || 'any'
    } else {
      const t: Type | undefined = prop.getType()
      goType = t ? inferFromType(t, mapper) : 'any'
    }
    if (!goType) goType = 'any'

    const isOptional = (prop as any).hasQuestionToken?.() ?? false
    let finalType = goType
    if (isOptional && goType !== 'any' &&
        !goType.startsWith('*') &&
        !goType.startsWith('[]') &&
        !goType.startsWith('map[')) {
      finalType = '*' + goType
    }
    const tag = isOptional
      ? `\`json:"${propName},omitempty"\``
      : jsonTag(propName)
    lines.push(`\t${toGoExported(propName)} ${finalType} ${tag}`)
    knownFields.push(propName)
  }
  if (hasOpenExtends) {
    lines.push(`\t// Extra captures inherited fields whose parent type couldn't be`)
    lines.push(`\t// walked at codegen time (e.g. \`extends Partial<X>\`). The`)
    lines.push(`\t// generated UnmarshalJSON populates it from any JSON keys not`)
    lines.push(`\t// matched by a named field.`)
    lines.push(`\tExtra map[string]any \`json:"-"\``)
  }
  lines.push('}')

  if (hasOpenExtends) {
    lines.push('')
    lines.push(`// UnmarshalJSON captures the named fields plus any extra keys`)
    lines.push(`// the wire carries into Extra. Generated because ${name} extends`)
    lines.push(`// a type whose properties are not statically enumerable.`)
    lines.push(`func (e *${name}) UnmarshalJSON(data []byte) error {`)
    lines.push(`\ttype alias ${name}`)
    lines.push(`\tvar typed alias`)
    lines.push(`\tif err := json.Unmarshal(data, &typed); err != nil { return err }`)
    lines.push(`\tvar raw map[string]json.RawMessage`)
    lines.push(`\tif err := json.Unmarshal(data, &raw); err != nil { return err }`)
    // Strip known JSON keys so they don't double-decode into Extra.
    const knownJSONKeys = knownFields.map((k) => `"${k}"`).join(', ')
    lines.push(`\tknown := map[string]struct{}{${knownJSONKeys ? knownJSONKeys + `: {}` : ''}}`)
    // The above expression is wrong for >1 key; use a per-key approach:
    lines.pop()
    lines.push(`\tknown := map[string]struct{}{}`)
    for (const k of knownFields) {
      lines.push(`\tknown["${k}"] = struct{}{}`)
    }
    lines.push(`\tfor k := range known { delete(raw, k) }`)
    lines.push(`\tif len(raw) > 0 {`)
    lines.push(`\t\ttyped.Extra = make(map[string]any, len(raw))`)
    lines.push(`\t\tfor k, v := range raw {`)
    lines.push(`\t\t\tvar val any`)
    lines.push(`\t\t\tif err := json.Unmarshal(v, &val); err != nil { return err }`)
    lines.push(`\t\t\ttyped.Extra[k] = val`)
    lines.push(`\t\t}`)
    lines.push(`\t}`)
    lines.push(`\t*e = ${name}(typed)`)
    lines.push(`\treturn nil`)
    lines.push(`}`)

    // Re-emit the matching MarshalJSON so Extra round-trips back out.
    lines.push('')
    lines.push(`// MarshalJSON merges Extra back into the JSON object.`)
    lines.push(`func (e ${name}) MarshalJSON() ([]byte, error) {`)
    lines.push(`\ttype alias ${name}`)
    lines.push(`\ttyped := alias(e)`)
    lines.push(`\tdata, err := json.Marshal(typed)`)
    lines.push(`\tif err != nil { return nil, err }`)
    lines.push(`\tif len(typed.Extra) == 0 { return data, nil }`)
    lines.push(`\tvar merged map[string]json.RawMessage`)
    lines.push(`\tif err := json.Unmarshal(data, &merged); err != nil { return nil, err }`)
    lines.push(`\tfor k, v := range typed.Extra {`)
    lines.push(`\t\tb, err := json.Marshal(v)`)
    lines.push(`\t\tif err != nil { return nil, err }`)
    lines.push(`\t\tmerged[k] = b`)
    lines.push(`\t}`)
    lines.push(`\treturn json.Marshal(merged)`)
    lines.push(`}`)
  }

  return lines.join('\n')
}

function inferFromType(t: Type, mapper: TypeMapper): string {
  if (t.isString() || t.isStringLiteral()) return 'string'
  if (t.isNumber() || t.isNumberLiteral()) return 'float64'
  if (t.isBoolean() || t.isBooleanLiteral()) return 'bool'
  if (t.isArray()) {
    const elem = t.getArrayElementType()
    return '[]' + (elem ? inferFromType(elem, mapper) : 'any')
  }
  if (t.isUnion()) {
    const non = t.getUnionTypes().filter((u) => !u.isUndefined() && !u.isNull())
    if (non.length === 1) return inferFromType(non[0], mapper)
    if (non.every((u) => u.isStringLiteral() || u.isString())) return 'string'
    if (non.every((u) => u.isNumberLiteral() || u.isNumber())) return 'float64'
    return 'any'
  }
  return mapper.fromPrimitiveText(t.getText()).text || 'any'
}

// =============================================================================
// State emission
// =============================================================================

interface StateSpec {
  name: string
  decl: ClassDeclaration
  mutators: { tsName: string; payloadGoType: string }[]
}

function collectMutators(cls: ClassDeclaration, mapper: TypeMapper): StateSpec['mutators'] {
  const out: StateSpec['mutators'] = []
  for (const m of cls.getMethods()) {
    const params = m.getParameters()
    if (params.length !== 1) continue
    const ret = m.getReturnTypeNode()?.getText() ?? m.getReturnType().getText()
    if (ret !== 'void' && ret !== 'undefined') continue
    const payloadGoType = mapper.fromNode(params[0].getTypeNode()).text || 'any'
    out.push({ tsName: m.getName(), payloadGoType })
  }
  return out
}

function emitStateRegister(spec: StateSpec): string {
  const lines: string[] = [
    `// Register${spec.name} wires a *${spec.name} payload into the shared`,
    `// state manager and returns the SharedState handle. Renderer-driven`,
    `// \`commit(id, mutationName, payload)\` calls land here, get decoded`,
    `// into the typed payload, and re-broadcast so peer clients update.`,
    `func Register${spec.name}(sm *bridge.StateManager, id string, payload *${spec.name}) *bridge.SharedState {`,
    `\tmutators := map[string]bridge.Mutator{`,
  ]
  for (const m of spec.mutators) {
    lines.push(
      `\t\t"${m.tsName}": func(raw any) {`,
      `\t\t\tvar v ${m.payloadGoType}`,
      `\t\t\tif err := decodeAny(raw, &v); err != nil { return }`,
      `\t\t\tApply${spec.name}_${toGoExported(m.tsName)}(payload, v)`,
      `\t\t\tsm.Push(id, "${m.tsName}", v)`,
      `\t\t},`,
    )
  }
  lines.push(
    `\t}`,
    `\treturn sm.Register(bridge.StateOpts{`,
    `\t\tID:        id,`,
    `\t\tStateName: "${spec.name}",`,
    `\t\tPayload:   payload,`,
    `\t\tMutators:  mutators,`,
    `\t})`,
    `}`,
  )

  // Per-mutator default applier hooks. The generated code only assigns
  // through these `var Apply…` function variables, so a non-generated
  // file can override the default no-op when custom logic is needed.
  for (const m of spec.mutators) {
    lines.push('')
    lines.push(`// Apply${spec.name}_${toGoExported(m.tsName)} is the default mutator hook for "${m.tsName}".`)
    lines.push(`// Override in a non-generated file to apply state changes; default is no-op.`)
    lines.push(`var Apply${spec.name}_${toGoExported(m.tsName)} = func(payload *${spec.name}, value ${m.payloadGoType}) {}`)
  }

  return lines.join('\n')
}

// =============================================================================
// Discovery
// =============================================================================

function discoverServices(project: Project): InterfaceDeclaration[] {
  const out: InterfaceDeclaration[] = []
  const seen = new Set<string>()

  // Strategy 1: every `xmcl-runtime-api/src/services/<Name>Service.ts`
  // exports the matching interface as its default service contract.
  const standardFiles = project.getSourceFiles().filter((f) => {
    const p = f.getFilePath().replace(/\\/g, '/')
    return p.includes('/xmcl-runtime-api/src/services/') &&
      p.endsWith('Service.ts')
  })
  for (const f of standardFiles) {
    const baseName = f.getBaseNameWithoutExtension()
    const iface = f.getInterface(baseName)
    if (iface && !seen.has(baseName)) {
      seen.add(baseName)
      out.push(iface)
    }
  }

  // Strategy 2: top-level `xmcl-runtime-api/src/<file>.ts` files that
  // export a `<Name>ServiceKey: ServiceKey<<Name>Service>` sentinel.
  // This catches `task.ts`, `bootstrap.ts`, `apps.ts` etc. that don't
  // live under `services/` but are still part of the wire contract.
  const topLevelFiles = project.getSourceFiles().filter((f) => {
    const p = f.getFilePath().replace(/\\/g, '/')
    if (!p.includes('/xmcl-runtime-api/src/')) return false
    if (p.includes('/xmcl-runtime-api/src/services/')) return false
    if (p.includes('/xmcl-runtime-api/src/entities/')) return false
    if (p.includes('/xmcl-runtime-api/src/util/')) return false
    return p.endsWith('.ts')
  })
  for (const f of topLevelFiles) {
    for (const v of f.getVariableDeclarations()) {
      const name = v.getName()
      const m = /^(\w+)ServiceKey$/.exec(name)
      if (!m) continue
      const ifaceName = m[1] + 'Service'
      const iface = f.getInterface(ifaceName)
      if (iface && !seen.has(ifaceName)) {
        seen.add(ifaceName)
        out.push(iface)
      }
    }
  }

  return out
}

function discoverStates(project: Project): ClassDeclaration[] {
  const stateFile = project.getSourceFile(STATE_TS) ??
    project.addSourceFileAtPath(STATE_TS)
  const allStates = stateFile.getVariableDeclarationOrThrow('AllStates')
  const init = allStates.getInitializer()
  if (!init || !Node.isArrayLiteralExpression(init)) {
    throw new Error('AllStates is not an array literal')
  }
  const out: ClassDeclaration[] = []
  for (const elem of init.getElements()) {
    if (!Node.isIdentifier(elem)) continue
    let sym = elem.getSymbol()
    if (sym?.getAliasedSymbol) sym = sym.getAliasedSymbol() ?? sym
    if (!sym) continue
    for (const d of sym.getDeclarations()) {
      if (d.getKind() === SyntaxKind.ClassDeclaration) {
        out.push(d as ClassDeclaration)
      }
    }
  }
  return out
}

// =============================================================================
// Driver
// =============================================================================

function decodeArgHelper(): string {
  return `// decodeArg coerces args[i] into out via JSON round-trip. The bridge
// receives args as []any (from JSON.parse), so a re-marshal/unmarshal keeps
// type-safety without hand-rolled decoders.
func decodeArg(args []any, i int, out any) error {
\tif i >= len(args) {
\t\treturn fmt.Errorf("missing argument #%d", i)
\t}
\treturn decodeAny(args[i], out)
}

// decodeOptionalArg behaves like decodeArg but treats a missing or
// nil argument as a zero-value success. Mirrors TS optional params
// (\`foo?: T\`) which the renderer simply omits.
func decodeOptionalArg(args []any, i int, out any) error {
\tif i >= len(args) || args[i] == nil {
\t\treturn nil
\t}
\treturn decodeAny(args[i], out)
}

// decodeAny coerces any JSON-decoded value into out via marshal/unmarshal.
func decodeAny(raw, out any) error {
\tdata, err := json.Marshal(raw)
\tif err != nil {
\t\treturn fmt.Errorf("marshal: %w", err)
\t}
\tif err := json.Unmarshal(data, out); err != nil {
\t\treturn fmt.Errorf("unmarshal into %T: %w", out, err)
\t}
\treturn nil
}`
}

function main() {
  const project = new Project({
    tsConfigFilePath: join(RUNTIME_API_DIR, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: false,
  })
  project.addSourceFilesAtPaths(join(RUNTIME_API_DIR, 'src', '**', '*.ts'))

  const mapper = new TypeMapper(project)

  // Discover state classes; their structs are emitted by the state pipeline,
  // not the entity pipeline.
  const states = discoverStates(project)
  const stateSpecs: StateSpec[] = []
  for (const cls of states) {
    const name = cls.getName()
    if (!name) continue
    mapper.skipStructEmission.add(name)
    mapper.emittedStructs.add(name) // suppress duplicate via entity queue
    stateSpecs.push({
      name,
      decl: cls,
      mutators: collectMutators(cls, mapper),
    })
  }

  // Discover services.
  const services = discoverServices(project)
  const serviceSpecs: ServiceSpec[] = []
  for (const iface of services) {
    const name = iface.getName()!
    serviceSpecs.push({
      name,
      methods: collectMethods(iface, mapper),
      events: collectEvents(iface, mapper),
    })
  }

  // Drain entity queue first.
  const structDefs: string[] = []
  while (mapper.structQueue.length) {
    const { name, declaration } = mapper.structQueue.shift()!
    if (mapper.skipStructEmission.has(name)) continue
    structDefs.push(emitStruct(name, declaration, mapper))
  }

  // Emit state structs (using the shared struct emitter).
  const stateStructDefs = stateSpecs.map((s) => emitStruct(s.name, s.decl, mapper))

  // Drain again — state-class field types may have queued more entities.
  while (mapper.structQueue.length) {
    const { name, declaration } = mapper.structQueue.shift()!
    if (mapper.skipStructEmission.has(name)) continue
    structDefs.push(emitStruct(name, declaration, mapper))
  }

  const stateRegisterDefs = stateSpecs.map(emitStateRegister)
  const interfaceDefs = serviceSpecs.map(emitInterface).join('\n\n')
  const dispatcherDefs = serviceSpecs.map(emitDispatcher).join('\n\n')
  const stubDefs = serviceSpecs.map(emitNotImplementedStub).join('\n\n')
  const eventHelperDefs = serviceSpecs
    .map(emitEventHelper)
    .filter((s) => s.length > 0)
    .join('\n\n')

  const registerStubsDef = [
    `// RegisterStubs installs the "not implemented" adapter for every`,
    `// service in the contract. Real implementations should be registered`,
    `// AFTER this call so they overwrite the stub. Exists so the renderer`,
    `// never sees an "unknown service" error during incremental porting.`,
    `func RegisterStubs(b *bridge.Bridge) {`,
    ...serviceSpecs.map((s) =>
      `\tb.Register("${s.name}", New${s.name}Adapter(${s.name}NotImplemented{}))`,
    ),
    `}`,
  ].join('\n')

  const header = `// Code generated by scripts/gen-go-contract.ts. DO NOT EDIT.

// Package contract holds Go interfaces, dispatchers, state helpers, and
// event broadcasters generated from the canonical TS service definitions
// in xmcl-runtime-api.
//
// Service implementations live in \`xmcl-wails-app/internal/services/<name>/\`.
// Each implementation is wired into the bridge by the generated
// \`New<Name>Adapter(impl)\` factory.
package contract

import (
\t"context"
\t"encoding/json"
\t"fmt"
\t"time"

\t"github.com/voxelum/xmcl/wails/internal/bridge"
)

var _ = time.Time{} // keep time import even when unused
`

  const body = [
    header,
    decodeArgHelper(),
    notImplementedHelper(),
    structDefs.join('\n\n'),
    stateStructDefs.join('\n\n'),
    stateRegisterDefs.join('\n\n'),
    interfaceDefs,
    dispatcherDefs,
    stubDefs,
    registerStubsDef,
    eventHelperDefs,
  ].filter((s) => s.trim().length > 0).join('\n\n')

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true })
  writeFileSync(OUTPUT_FILE, body, 'utf8')

  // ---- Skeletons (idempotent) -----------------------------------------
  let skeletonsCreated = 0
  for (const spec of serviceSpecs) {
    const pkg = pkgNameForService(spec.name)
    const dir = join(SERVICES_DIR, pkg)
    const file = join(dir, pkg + '.go')
    if (existsSync(file)) continue
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, emitServiceSkeleton(spec.name), 'utf8')
    skeletonsCreated++
  }

  // ---- Aggregator (always overwrite) ----------------------------------
  mkdirSync(dirname(REGISTRY_FILE), { recursive: true })
  writeFileSync(REGISTRY_FILE, emitServicesRegistry(serviceSpecs), 'utf8')

  const summary = {
    services: serviceSpecs.length,
    serviceMethods: serviceSpecs.reduce((n, s) => n + s.methods.length, 0),
    serviceEvents: serviceSpecs.reduce((n, s) => n + s.events.length, 0),
    states: stateSpecs.length,
    stateMutators: stateSpecs.reduce((n, s) => n + s.mutators.length, 0),
    structs: structDefs.length + stateStructDefs.length,
    skeletonsCreated,
    warnings: mapper.warnings.length,
  }
  console.log(`Wrote ${OUTPUT_FILE}`)
  console.log(`Wrote ${REGISTRY_FILE}`)
  if (skeletonsCreated > 0) console.log(`Created ${skeletonsCreated} new service skeleton(s)`)
  console.log(JSON.stringify(summary, null, 2))
  if (mapper.warnings.length) {
    console.log('Warnings (first 30):')
    for (const w of mapper.warnings.slice(0, 30)) console.log('  - ' + w)
    if (mapper.warnings.length > 30) {
      console.log(`  … and ${mapper.warnings.length - 30} more`)
    }
  }
}

main()
