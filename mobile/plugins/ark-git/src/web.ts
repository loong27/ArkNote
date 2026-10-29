import type { ArkGitPlugin, ArkGitPullOptions, ArkGitPullResult } from './definitions'

export class ArkGitWeb implements ArkGitPlugin {
  async pull(_options: ArkGitPullOptions): Promise<ArkGitPullResult> {
    return {
      success: false,
      message: 'SSH Git 拉取仅支持 Android / iOS 原生壳，请使用 HTTPS + Token 或在真机上同步',
    }
  }

  async testAuth(_options: ArkGitPullOptions): Promise<ArkGitPullResult> {
    return this.pull(_options)
  }
}
