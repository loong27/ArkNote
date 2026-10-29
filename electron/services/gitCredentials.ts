/**
 * Embed HTTPS credentials into a Git remote URL for non-interactive auth.
 * Tokens stay in ~/.ark-note-config.json (local only), never in the vault Git tree.
 */
export {
  isHttpsGitUrl,
  isSshGitUrl,
  stripEmbeddedCredentials,
  embedHttpsCredentials,
  isValidGitRemoteUrl,
  normalizeGitBranch,
} from '../../shared/gitRemote'
