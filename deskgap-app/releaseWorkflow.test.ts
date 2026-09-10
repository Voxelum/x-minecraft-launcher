import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
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

  it('signs only APPX with the existing policy and keeps DeskGap signing as a future template', () => {
    const requests = steps.filter(step => step.uses?.startsWith('signpath/'))
    expect(requests).toHaveLength(1)
    expect(requests[0].with?.['artifact-configuration-slug']).toBe('appx')
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
    expect(requests[0].with?.['output-artifact-directory']).toBe('signed/')
    expect(JSON.stringify(steps)).not.toContain('artifact-configuration-slug":"deskgap-exe')
    expect(steps.some(step => step.name?.includes('DeskGap'))).toBe(false)
    expect(steps.map(step => step.run).join('\n')).not.toContain('verify-deskgap-signature.ps1')
    expect(steps.map(step => step.run).join('\n')).not.toContain('Get-AuthenticodeSignature')
    const xml = readFileSync(join(root, '.github', 'signpath', 'deskgap-exe.xml'), 'utf8')
    expect(xml).toContain('<pe-file path="xmcl-deskgap-*-win32-x64.exe">')
    expect(xml).toContain('<authenticode-sign />')
  })

  it('requires a regular draft, hashes signed APPX bytes, and publishes without an EXE dependency', () => {
    const resolveTag = steps.find(step => step.name === 'Resolve release tag')!.run!
    expect(resolveTag).toContain('Only unsigned drafts may be signed')
    expect(resolveTag).toContain('Use a regular v<version> release tag')
    const hashing = steps.find(step => step.name === 'Compute sha256 for signed .appx')!
    const upload = steps.find(step => step.name === 'Upload signed assets to release')!
    const publish = steps.find(step => step.name === 'Publish release')!
    expect(steps.indexOf(hashing)).toBeGreaterThan(steps.findIndex(step => step.name === 'Submit APPX signing request'))
    expect(hashing.run).toContain('Get-FileHash')
    expect(hashing.run).toContain('Get-ChildItem signed -Filter *.appx')
    expect(steps.indexOf(upload)).toBeGreaterThan(steps.indexOf(hashing))
    expect(upload.run?.match(/if \(\$LASTEXITCODE -ne 0\)/g)).toHaveLength(2)
    expect(upload.run).not.toContain('-Filter xmcl-deskgap')
    expect(steps.indexOf(publish)).toBeGreaterThan(steps.indexOf(upload))
    expect(steps.at(-1)).toBe(publish)
    expect(publish.run).toContain('--draft=false')
  })

  it('labels the regular release EXE as an unsigned manual-install preview', () => {
    const release = build.jobs.release.steps.find(step => step.name === 'Draft Release')!
    expect(release.with?.draft).toBe(true)
    expect(release.with?.body).toContain('${{ steps.release_note.outputs.body }}')
    expect(release.with?.body).toContain('UNSIGNED PREVIEW')
    expect(release.with?.body).toContain('manual installation only')
    expect(release.with?.body).toContain('intentionally rejects unsigned EXEs')
    expect(release.with?.body).toContain('xmcl-deskgap-${{ steps.prepare_release.outputs.version }}-win32-x64.exe')
  })

  it.skipIf(process.platform !== 'win32').each([false, true])('can hash/upload/publish APPX with unsigned preview present: %s', (withPreview) => {
    const fixture = mkdtempSync(join(tmpdir(), 'xmcl-appx-only-'))
    try {
      mkdirSync(join(fixture, 'signed'))
      writeFileSync(join(fixture, 'signed', 'xmcl.appx'), 'returned SignPath APPX fixture')
      if (withPreview) writeFileSync(join(fixture, 'xmcl-deskgap-0.70.0-win32-x64.exe'), 'unsigned preview fixture')
      const commands = ['Compute sha256 for signed .appx', 'Upload signed assets to release', 'Publish release']
        .map(name => steps.find(step => step.name === name)!.run!.replace(/\$\{\{[\s\S]*?\}\}/g, 'v0.70.0')).join('\n')
      const result = powershell(`
        $ErrorActionPreference = 'Stop'
        Set-Location -LiteralPath $env:APPX_FIXTURE
        function gh {
          if ($args -contains 'upload') {
            $files = @($args | Where-Object { $_ -match '\\.appx(?:\\.sha256)?$' })
            if ($files.Count -ne 1 -or !(Test-Path -LiteralPath $files[0])) { throw 'Expected APPX or APPX checksum only' }
          }
          if ($args -match '\\.exe') { throw 'APPX publication must not depend on a DeskGap EXE' }
          $global:LASTEXITCODE = 0
          Write-Output ('GH_FIXTURE ' + ($args -join ' '))
        }
        ${commands}
      `, { APPX_FIXTURE: fixture })
      expect(result.status, result.stderr || String(result.error)).toBe(0)
      expect(result.stdout).toContain('release edit v0.70.0 --draft=false')
      expect(readFileSync(join(fixture, 'signed', 'xmcl.appx.sha256'), 'utf8')).toMatch(/^[a-f0-9]{64}$/)
      if (withPreview) expect(readFileSync(join(fixture, 'xmcl-deskgap-0.70.0-win32-x64.exe'), 'utf8')).toBe('unsigned preview fixture')
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
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
