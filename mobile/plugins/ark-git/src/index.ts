import { registerPlugin } from '@capacitor/core'
import type { ArkGitPlugin } from './definitions'

const ArkGit = registerPlugin<ArkGitPlugin>('ArkGit', {
  web: () => import('./web').then((m) => new m.ArkGitWeb()),
})

export * from './definitions'
export { ArkGit }
