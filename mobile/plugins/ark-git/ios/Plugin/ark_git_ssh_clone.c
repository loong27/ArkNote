/**
 * iOS SSH git clone via libgit2 (when ARK_GIT_HAS_LIBGIT2 is defined at compile time).
 *
 * Enable by adding libgit2 + libssh2 to the iOS target and setting:
 *   GCC_PREPROCESSOR_DEFINITIONS = ARK_GIT_HAS_LIBGIT2=1
 */
#include <stdio.h>
#include <string.h>

#if defined(ARK_GIT_HAS_LIBGIT2)
#include <git2.h>

static int cred_cb(
  git_cred **out,
  const char *url,
  const char *username_from_url,
  unsigned int allowed_types,
  void *payload
) {
  (void)url;
  (void)allowed_types;
  const char **parts = (const char **)payload; /* [0]=keyPath [1]=passphrase */
  const char *user = username_from_url && username_from_url[0] ? username_from_url : "git";
  return git_cred_ssh_key_new(out, user, NULL, parts[0], parts[1] ? parts[1] : "");
}

int ark_git_ssh_clone(
  const char *repoUrl,
  const char *branch,
  const char *privateKeyPath,
  const char *passphrase,
  const char *targetPath,
  char *errorBuf,
  int errorBufLen
) {
  git_libgit2_init();

  const char *payload[2] = { privateKeyPath, passphrase ? passphrase : "" };
  git_clone_options opts = GIT_CLONE_OPTIONS_INIT;
  opts.checkout_branch = branch;
  opts.fetch_opts.callbacks.credentials = cred_cb;
  opts.fetch_opts.callbacks.payload = (void *)payload;

  git_repository *repo = NULL;
  int rc = git_clone(&repo, repoUrl, targetPath, &opts);
  if (rc != 0) {
    const git_error *err = git_error_last();
    const char *msg = err && err->message ? err->message : "git_clone failed";
    if (errorBuf && errorBufLen > 0) {
      snprintf(errorBuf, (size_t)errorBufLen, "%s", msg);
    }
    git_libgit2_shutdown();
    return rc;
  }

  git_repository_free(repo);
  git_libgit2_shutdown();
  if (errorBuf && errorBufLen > 0) errorBuf[0] = '\0';
  return 0;
}

#else

int ark_git_ssh_clone(
  const char *repoUrl,
  const char *branch,
  const char *privateKeyPath,
  const char *passphrase,
  const char *targetPath,
  char *errorBuf,
  int errorBufLen
) {
  (void)repoUrl;
  (void)branch;
  (void)privateKeyPath;
  (void)passphrase;
  (void)targetPath;
  const char *msg =
    "iOS SSH 需链接 libgit2（编译宏 ARK_GIT_HAS_LIBGIT2）。也可改用 HTTPS 仓库地址 + Token";
  if (errorBuf && errorBufLen > 0) {
    snprintf(errorBuf, (size_t)errorBufLen, "%s", msg);
  }
  return 1;
}

#endif
