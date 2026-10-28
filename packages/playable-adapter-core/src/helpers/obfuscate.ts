import JavaScriptObfuscator from 'javascript-obfuscator'
import type { ObfuscatorOptions } from 'javascript-obfuscator'
import type { TObfuscateRC } from '@/typings'

// Branch defaults.
// `feat/obfuscate`      -> flatten off, everything below off (names only, ~0 cost)
// `feat/obfuscate-flow` -> flatten on, everything below off
// `feat/obfuscate-max`  -> flatten on + string array + dead code + self defending
//                         (strongest, highest size/CPU). debugProtection stays
//                         off by default: it can falsely trip and break ad-network
//                         previews/validators.
const DEFAULT_CONTROL_FLOW_FLATTENING = true
const DEFAULT_STRING_ARRAY = true
const DEFAULT_DEAD_CODE_INJECTION = true
const DEFAULT_SELF_DEFENDING = true
const DEFAULT_DEBUG_PROTECTION = false

type TNormalizedRC = {
  enable: boolean
  controlFlowFlattening?: boolean
  controlFlowFlatteningThreshold?: number
  stringArray?: boolean
  deadCodeInjection?: boolean
  selfDefending?: boolean
  debugProtection?: boolean
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
    stringArray: rc.stringArray,
    deadCodeInjection: rc.deadCodeInjection,
    selfDefending: rc.selfDefending,
    debugProtection: rc.debugProtection,
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

export const buildObfuscatorOptions = (
  rc: Pick<
    TNormalizedRC,
    | 'controlFlowFlattening'
    | 'controlFlowFlatteningThreshold'
    | 'stringArray'
    | 'deadCodeInjection'
    | 'selfDefending'
    | 'debugProtection'
  >
): ObfuscatorOptions => {
  const controlFlowFlattening = rc.controlFlowFlattening ?? DEFAULT_CONTROL_FLOW_FLATTENING
  const stringArray = rc.stringArray ?? DEFAULT_STRING_ARRAY
  const deadCodeInjection = rc.deadCodeInjection ?? DEFAULT_DEAD_CODE_INJECTION
  const selfDefending = rc.selfDefending ?? DEFAULT_SELF_DEFENDING
  const debugProtection = rc.debugProtection ?? DEFAULT_DEBUG_PROTECTION

  return {
    compact: true,
    simplify: true,
    target: 'browser',
    // Mangle local identifiers only. Renaming globals/exports would break
    // SystemJS module linking.
    identifierNamesGenerator: 'mangled',
    renameGlobals: false,
    // No source map so the original TypeScript cannot be reconstructed.
    sourceMap: false,
    // Flow protection.
    controlFlowFlattening,
    controlFlowFlatteningThreshold: controlFlowFlattening
      ? (rc.controlFlowFlatteningThreshold ?? 0.75)
      : 0,
    // String array hides string literals, incl SystemJS module ids like
    // 'chunks:///_virtual/Foo.ts'. Values are preserved at runtime (decoder
    // returns the original), so module linking still works.
    stringArray,
    // Threshold 1 so *all* string literals move, incl every SystemJS module id.
    stringArrayThreshold: stringArray ? 1 : 0,
    stringArrayEncoding: stringArray ? ['base64'] : [],
    // Keep splitStrings off; it bloats and is not needed for logic hiding.
    splitStrings: false,
    // Fake branches to confuse de-flattening tools.
    deadCodeInjection,
    deadCodeInjectionThreshold: deadCodeInjection ? 0.2 : 0,
    // Breaks when the output is beautified (deobfuscators beautify first).
    selfDefending,
    // Off by default: can falsely trip in ad-network render/validation.
    debugProtection,
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
