import JavaScriptObfuscator from 'javascript-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'
import type { TObfuscateRC } from '@/typings'

// Branch default for control-flow flattening.
// `feat/obfuscate`      -> false (names mangled, flow readable, ~0 cost)
// `feat/obfuscate-flow` -> true  (flow flattened, higher size/CPU)
const DEFAULT_CONTROL_FLOW_FLATTENING = false

type TNormalizedRC = {
  enable: boolean
  controlFlowFlattening?: boolean
  controlFlowFlatteningThreshold?: number
  include: string[]
  exclude: string[]
}

export const normalizeObfuscateRC = (raw: boolean | TObfuscateRC | undefined): TNormalizedRC => {
  // Enabled by default; `obfuscate: false` opts out.
  if (raw === false) {
    return { enable: false, include: [], exclude: [] }
  }
  const rc: TObfuscateRC = raw === true || raw == null ? {} : raw
  return {
    enable: rc.enable !== false,
    controlFlowFlattening: rc.controlFlowFlattening,
    controlFlowFlatteningThreshold: rc.controlFlowFlatteningThreshold,
    include: rc.include ?? [],
    exclude: rc.exclude ?? [],
  }
}

// Only project script bundles under `assets/` are obfuscated. The Cocos engine
// (`src/`, `cocos-js/`, `assets/internal/`) is left untouched: huge, public,
// and flattening it would bloat the file and drop frames for zero secrecy gain.
export const shouldObfuscateKey = (objKey: string, rc: Pick<TNormalizedRC, 'include' | 'exclude'>): boolean => {
  const key = objKey.replace(/\\/g, '/')
  if (!key.endsWith('.js')) return false

  // Explicit excludes win.
  if (rc.exclude.some((frag) => key.includes(frag))) return false

  // Explicit extra includes (substring match) are always obfuscated.
  if (rc.include.some((frag) => key.includes(frag))) return true

  // Default scope: project bundles, never engine internal.
  if (!key.startsWith('assets/')) return false
  if (key.startsWith('assets/internal/')) return false
  return true
}

export const buildObfuscatorOptions = (rc: Pick<TNormalizedRC, 'controlFlowFlattening' | 'controlFlowFlatteningThreshold'>): ObfuscatorOptions => {
  const controlFlowFlattening = rc.controlFlowFlattening ?? DEFAULT_CONTROL_FLOW_FLATTENING

  return {
    compact: true,
    simplify: true,
    target: 'browser',
    // Mangle local identifiers only. Renaming globals/exports would break
    // SystemJS module linking.
    identifierNamesGenerator: 'mangled',
    renameGlobals: false,
    // String encryption intentionally OFF (keeps size/CPU down). As a result
    // SystemJS module ids like 'chunks:///_virtual/Foo.ts' remain readable.
    stringArray: false,
    splitStrings: false,
    // No source map so the original TypeScript cannot be reconstructed.
    sourceMap: false,
    // Flow protection — the one knob that differs between the two branches.
    controlFlowFlattening,
    controlFlowFlatteningThreshold: controlFlowFlattening
      ? (rc.controlFlowFlatteningThreshold ?? 0.75)
      : 0,
    // Keep these off: they add size/CPU without serving the "hide logic" goal.
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
  }
}

export const obfuscateJsCode = (source: string, options: ObfuscatorOptions): string =>
  JavaScriptObfuscator.obfuscate(source, options).getObfuscatedCode()

/**
 * Obfuscate the project script bundles inside a resource mapper in place.
 * Only keys that pass `shouldObfuscateKey` are touched. Returns the number of
 * files obfuscated.
 */
export const obfuscateResMapper = (
  resMapper: { [key: string]: string },
  raw: boolean | TObfuscateRC | undefined
): number => {
  const rc = normalizeObfuscateRC(raw)
  if (!rc.enable) return 0

  const options = buildObfuscatorOptions(rc)
  let count = 0

  for (const objKey of Object.keys(resMapper)) {
    if (!shouldObfuscateKey(objKey, rc)) continue

    const source = resMapper[objKey]
    if (!source) continue

    try {
      const before = source.length
      const obfuscated = obfuscateJsCode(source, options)
      resMapper[objKey] = obfuscated
      count++
      console.log(
        `【Obfuscate】${objKey} flatten=${options.controlFlowFlattening} ${before} -> ${obfuscated.length} bytes`
      )
    } catch (err) {
      // Never break a build over obfuscation; ship the original file instead.
      console.warn(`【Obfuscate】skipped ${objKey}: ${(err as Error).message}`)
    }
  }

  console.log(`【Obfuscate】done, ${count} file(s) processed`)
  return count
}
