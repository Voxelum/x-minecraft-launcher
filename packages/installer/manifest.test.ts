import { test, expect } from 'vitest'
import { convertClasspathToMaven, parseManifest } from './manifest'

test('#convertClasspathToMaven', () => {
  const result = convertClasspathToMaven([
    'libraries/net/minecraftforge/JarJarFileSystems/0.3.26/JarJarFileSystems-0.3.26.jar',
    'libraries/com/google/guava/guava/32.1.2-jre/guava-32.1.2-jre.jar',
    'libraries/com/google/guava/failureaccess/1.0.1/failureaccess-1.0.1.jar',
    'libraries/net/minecraftforge/securemodules/2.2.19/securemodules-2.2.19.jar',
    'libraries/net/minecraftforge/unsafe/0.9.2/unsafe-0.9.2.jar',
    'libraries/org/ow2/asm/asm/9.7/asm-9.7.jar',
    'libraries/org/ow2/asm/asm-tree/9.7/asm-tree-9.7.jar',
    'libraries/org/ow2/asm/asm-util/9.7/asm-util-9.7.jar',
    'libraries/org/ow2/asm/asm-commons/9.7/asm-commons-9.7.jar',
    'libraries/org/ow2/asm/asm-analysis/9.7/asm-analysis-9.7.jar',
    'libraries/net/minecraftforge/forge/1.20.6-50.1.9/forge-1.20.6-50.1.9-shim.jar',
  ])
  expect(result).toEqual([
    'net.minecraftforge:JarJarFileSystems:0.3.26',
    'com.google.guava:guava:32.1.2-jre',
    'com.google.guava:failureaccess:1.0.1',
    'net.minecraftforge:securemodules:2.2.19',
    'net.minecraftforge:unsafe:0.9.2',
    'org.ow2.asm:asm:9.7',
    'org.ow2.asm:asm-tree:9.7',
    'org.ow2.asm:asm-util:9.7',
    'org.ow2.asm:asm-commons:9.7',
    'org.ow2.asm:asm-analysis:9.7',
    'net.minecraftforge:forge:1.20.6-50.1.9:shim',
  ])
})

test('#parseManifest', () => {
  const manifestContent = [
    'Manifest-Version: 1.0',
    'Class-Path: libraries/net/minecraftforge/JarJarFileSystems/0.3.26/JarJar',
    ' FileSystems-0.3.26.jar libraries/com/google/guava/guava/32.1.2-jre/guav',
    ' a-32.1.2-jre.jar libraries/com/google/guava/failureaccess/1.0.1/failure',
    ' access-1.0.1.jar libraries/net/minecraftforge/securemodules/2.2.19/secu',
    ' remodules-2.2.19.jar libraries/net/minecraftforge/unsafe/0.9.2/unsafe-0',
    ' .9.2.jar libraries/org/ow2/asm/asm/9.7/asm-9.7.jar libraries/org/ow2/as',
    ' m/asm-tree/9.7/asm-tree-9.7.jar libraries/org/ow2/asm/asm-util/9.7/asm-',
    ' util-9.7.jar libraries/org/ow2/asm/asm-commons/9.7/asm-commons-9.7.jar ',
    ' libraries/org/ow2/asm/asm-analysis/9.7/asm-analysis-9.7.jar',
    'Automatic-Module-Name: net.minecraftforge.bootstrap.shim',
    'Main-Class: net.minecraftforge.bootstrap.shim.Main',
  ].join('\r\n')
  const result = parseManifest(manifestContent)
  expect(result).toEqual({
    mainClass: 'net.minecraftforge.bootstrap.shim.Main',
    classPath: [
      'libraries/net/minecraftforge/JarJarFileSystems/0.3.26/JarJarFileSystems-0.3.26.jar',
      'libraries/com/google/guava/guava/32.1.2-jre/guava-32.1.2-jre.jar',
      'libraries/com/google/guava/failureaccess/1.0.1/failureaccess-1.0.1.jar',
      'libraries/net/minecraftforge/securemodules/2.2.19/securemodules-2.2.19.jar',
      'libraries/net/minecraftforge/unsafe/0.9.2/unsafe-0.9.2.jar',
      'libraries/org/ow2/asm/asm/9.7/asm-9.7.jar',
      'libraries/org/ow2/asm/asm-tree/9.7/asm-tree-9.7.jar',
      'libraries/org/ow2/asm/asm-util/9.7/asm-util-9.7.jar',
      'libraries/org/ow2/asm/asm-commons/9.7/asm-commons-9.7.jar',
      'libraries/org/ow2/asm/asm-analysis/9.7/asm-analysis-9.7.jar',
    ],
  })
})
