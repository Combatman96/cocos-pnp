import type { TChannel } from '../typings'

const TITLE_PREFIX = 'Cocos Creator | '

const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, '_').trim().replace(/^\.+|\.+$/g, '').trim()

// `<buildName>_<Channel>`, or just `<Channel>` when the build has no name.
// `strict` keeps only letters, digits and underscores, as Mintegral requires.
export const getChannelOutputName = (channel: TChannel, buildName?: string, strict = false): string => {
  const cleaned = sanitize(buildName ?? '')
  const name = strict ? cleaned.replace(/[^A-Za-z0-9_]/g, '_') : cleaned
  return name ? `${name}_${channel}` : channel
}

// Folder that groups every channel output of one build.
export const getOutputFolderName = (buildName?: string): string => sanitize(buildName ?? '') || 'playable'

// The editor writes the build "Name" into the built index.html <title>.
export const getBuildNameFromHtml = (html: string): string | undefined => {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.replace(TITLE_PREFIX, '').trim()
  return title || undefined
}
