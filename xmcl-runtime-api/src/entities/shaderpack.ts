export interface ShaderPack {

}

export interface ShaderOptions {
  shaderPack: string
}

export function parseShaderOptions(text: string): ShaderOptions {
  const options = text.split('\n').map(s => s.trim()).filter(l => l.length !== 0 && !l.startsWith('#')).map(s => s.split('=')).reduce((a, b) => Object.assign(a, { [b[0]]: b[1] }), {}) as Record<string, string>
  if (!options.shaderPack) {
    options.shaderPack = ''
  }
  return options as any
}

export function stringifyShaderOptions(options: ShaderOptions): string {
  return Object.entries(options).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}
