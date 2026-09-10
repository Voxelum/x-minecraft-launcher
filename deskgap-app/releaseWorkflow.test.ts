import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deskGapPublisherNames } from './src/updater'

// Reuse the runtime workspace's existing YAML parser; no workflow test tooling to install.
const { load } = createRequire(new URL('../xmcl-runtime/package.json', import.meta.url))('js-yaml') as { load(source: string): unknown }
const root = resolve(import.meta.dirname, '..')
interface Step {
  name?: string
  uses?: string
  if?: string
  shell?: string
  run?: string
  with?: Record<string, string | boolean | number>
  'continue-on-error'?: boolean
}
interface Workflow {
  on: { push: { paths: string[] } }
  jobs: Record<string, { steps: Step[]; strategy?: { matrix: { os: string[] } } }>
}
const build = load(readFileSync(join(root, '.github', 'workflows', 'build.yml'), 'utf8')) as Workflow
const signing = load(readFileSync(join(root, '.github', 'workflows', 'sign-release.yml'), 'utf8')) as Workflow
const steps = signing.jobs.sign.steps
const signatureScript = join(root, '.github', 'scripts', 'verify-deskgap-signature.ps1')

function powershell(command: string, env: Record<string, string> = {}) {
  return spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', env: { ...process.env, ...env }, timeout: 20000,
  })
}

describe('regular DeskGap Windows release workflow', () => {
  it('adds only a Windows EXE to the existing Electron artifact, using a single pinned runtime tag', () => {
    const buildSteps = build.jobs.build.steps
    expect(build.on.push.paths).toContain('deskgap-app/**')
    expect(build.jobs.build.strategy?.matrix.os).toEqual(['ubuntu-latest', 'macos-latest', 'windows-latest'])
    for (const step of buildSteps.filter(step => step.name?.includes('DeskGap'))) {
      expect(step.if).toBe("${{ runner.os == 'Windows' }}")
      expect(step['continue-on-error']).toBeUndefined()
    }
    const source = buildSteps.find(step => step.name === 'Checkout matching DeskGap packaging helpers')!
    expect(source.with).toMatchObject({ repository: 'Voxelum/DeskGap', ref: 'v${{ steps.deskgap.outputs.version }}' })
    const download = buildSteps.find(step => step.name === 'Download pinned DeskGap Windows runtime')!.run!
    expect(download).toContain('releases/download/v$env:DESKGAP_VERSION')
    expect(download).toContain('$base/SHA256SUMS')
    expect(download).toContain('$entries.Count -ne 1')
    expect(download.indexOf('Get-FileHash')).toBeLessThan(download.indexOf('Expand-Archive'))
    expect(download).toContain("throw 'DeskGap runtime checksum mismatch'")
    const packaging = buildSteps.find(step => step.name === 'Build DeskGap single EXE alongside Electron')!
    expect(buildSteps.indexOf(packaging)).toBeGreaterThan(buildSteps.findIndex(step => step.name === 'Build'))
    expect(packaging.run).toContain('win32-x64.exe" xmcl-electron-app\\build\\output\\')
    expect(packaging.run).toContain('Join-Path $extracted "DeskGapBootstrap-v$env:DESKGAP_VERSION-win32-x64.exe"')
    expect(packaging.run).toContain('package "$source" "$runtime" "$bootstrap"')
    expect(buildSteps.find(step => step.name === 'Upload Build')!.with?.path).toBe('xmcl-electron-app/build/output/\n')
  })

  it('uses separate APPX/PE configurations but the same SignPath project, policy and token', () => {
    const requests = steps.filter(step => step.uses?.startsWith('signpath/'))
    expect(requests).toHaveLength(2)
    expect(requests.map(step => step.with?.['artifact-configuration-slug'])).toEqual(['appx', 'deskgap-exe'])
    for (const request of requests) {
      expect(request.with).toMatchObject({
        'project-slug': 'x-minecraft-launcher',
        'signing-policy-slug': 'release-signing',
        'api-token': '${{ secrets.CODE_SIGN_TOKEN }}',
        'wait-for-completion': true,
      })
      expect(request.if).toBeUndefined()
      expect(request['continue-on-error']).toBeUndefined()
    }
    expect(requests[0].with?.['output-artifact-directory']).not.toBe(requests[1].with?.['output-artifact-directory'])
    const xml = readFileSync(join(root, '.github', 'signpath', 'deskgap-exe.xml'), 'utf8')
    expect(xml).toContain('<pe-file path="xmcl-deskgap-*-win32-x64.exe">')
    expect(xml).toContain('<authenticode-sign />')
  })

  it('requires a regular draft, verifies returned signed bytes before hashing, and publishes last', () => {
    const resolveTag = steps.find(step => step.name === 'Resolve release tag')!.run!
    expect(resolveTag).toContain('Only unsigned drafts may be signed')
    expect(resolveTag).toContain('Use a regular v<version> release tag')
    const verification = steps.find(step => step.name === 'Verify DeskGap signature and compute final binary hashes')!
    const upload = steps.find(step => step.name === 'Upload signed assets to release')!
    const publish = steps.find(step => step.name === 'Publish release')!
    expect(steps.indexOf(verification)).toBeGreaterThan(steps.findIndex(step => step.name === 'Submit DeskGap EXE signing request'))
    expect(verification.run!.indexOf('verify-deskgap-signature.ps1')).toBeLessThan(verification.run!.indexOf('Get-FileHash'))
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(verification))
    expect(upload.run?.match(/if \(\$LASTEXITCODE -ne 0\)/g)).toHaveLength(4)
    expect(steps.indexOf(publish)).toBeGreaterThan(steps.indexOf(upload))
    expect(steps.at(-1)).toBe(publish)
    expect(publish.run).toContain('--draft=false')
  })

  it.skipIf(process.platform !== 'win32')('parses the actual PowerShell workflow scripts and SignPath XML', () => {
    const scripts = [...build.jobs.build.steps, ...steps].filter(step => step.shell === 'pwsh')
      .map(step => step.run!.replace(/\$\{\{[\s\S]*?\}\}/g, 'resolved-value'))
    const result = powershell(`
      $ErrorActionPreference = 'Stop'
      foreach ($source in ($env:WORKFLOW_SCRIPTS | ConvertFrom-Json)) {
        $tokens = $null; $errors = $null
        [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count) { throw ($errors | Out-String) }
      }
      [xml](Get-Content -LiteralPath $env:ARTIFACT_XML -Raw) | Out-Null
    `, {
      WORKFLOW_SCRIPTS: JSON.stringify(scripts),
      ARTIFACT_XML: join(root, '.github', 'signpath', 'deskgap-exe.xml'),
    })
    expect(result.status, result.stderr || String(result.error)).toBe(0)
  })

  it.skipIf(process.platform !== 'win32').each([
    { status: 'Valid', subject: deskGapPublisherNames[0], allowed: true },
    { status: 'NotSigned', subject: deskGapPublisherNames[0], allowed: false },
    { status: 'HashMismatch', subject: deskGapPublisherNames[0], allowed: false },
    { status: 'Valid', subject: 'CN=Someone Else', allowed: false },
    { status: 'Valid', subject: null, allowed: false },
  ])('fails closed for Authenticode status $status / subject $subject', ({ status, subject, allowed }) => {
    const result = powershell(`
      function Get-AuthenticodeSignature { param($LiteralPath) $env:MOCK_SIGNATURE | ConvertFrom-Json }
      & $env:VERIFY_SCRIPT -Path 'fixture.exe'
    `, {
      VERIFY_SCRIPT: signatureScript,
      MOCK_SIGNATURE: JSON.stringify({ Status: status, SignerCertificate: subject ? { Subject: subject } : null }),
    })
    expect(result.status === 0, result.stderr || String(result.error)).toBe(allowed)
    if (!allowed) expect(result.stderr).toContain('valid Authenticode signature')
  })

  it.skipIf(process.platform !== 'win32')('rejects a real unsigned file through the Windows signature command', () => {
    const result = powershell('& $env:VERIFY_SCRIPT -Path $env:VERIFY_SCRIPT', { VERIFY_SCRIPT: signatureScript })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('valid Authenticode signature')
  })
})
