export interface ArkGitPullOptions {
  /** SSH remote, e.g. git@github.com:org/repo.git */
  repoUrl: string
  branch: string
  /** OpenSSH / PEM private key contents */
  privateKey: string
  passphrase?: string
  /**
   * Absolute native filesystem path for the clone destination
   * (empty directory). On Android/iOS this is a real path from Filesystem.getUri.
   */
  targetPath: string
}

export interface ArkGitPullResult {
  success: boolean
  message: string
}

export interface ArkGitPlugin {
  pull(options: ArkGitPullOptions): Promise<ArkGitPullResult>
  testAuth(options: Omit<ArkGitPullOptions, 'targetPath'> & { targetPath?: string }): Promise<ArkGitPullResult>
}
