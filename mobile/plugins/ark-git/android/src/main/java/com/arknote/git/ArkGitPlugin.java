package com.arknote.git;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.SshSessionFactory;
import org.eclipse.jgit.transport.sshd.SshdSessionFactory;
import org.eclipse.jgit.transport.sshd.SshdSessionFactoryBuilder;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;

@CapacitorPlugin(name = "ArkGit")
public class ArkGitPlugin extends Plugin {

    @PluginMethod
    public void pull(PluginCall call) {
        runPull(call, false);
    }

    @PluginMethod
    public void testAuth(PluginCall call) {
        runPull(call, true);
    }

    private void runPull(PluginCall call, boolean testOnly) {
        final String repoUrl = call.getString("repoUrl", "");
        final String branch = call.getString("branch", "main");
        final String privateKey = call.getString("privateKey", "");
        final String passphrase = call.getString("passphrase", "");
        final String targetPath = call.getString("targetPath", "");

        if (repoUrl == null || repoUrl.isEmpty()) {
            reject(call, "仓库地址不能为空");
            return;
        }
        if (privateKey == null || privateKey.isEmpty()) {
            reject(call, "SSH 私钥不能为空");
            return;
        }
        if (targetPath == null || targetPath.isEmpty()) {
            reject(call, "目标路径不能为空");
            return;
        }

        new Thread(() -> {
            File home = new File(getContext().getCacheDir(), "ark-git-ssh-" + System.currentTimeMillis());
            File sshDir = new File(home, "ssh");
            //noinspection ResultOfMethodCallIgnored
            sshDir.mkdirs();

            SshSessionFactory previous = SshSessionFactory.getInstance();
            Git git = null;
            try {
                File keyFile = new File(sshDir, "id_arknote");
                Files.write(keyFile.toPath(), privateKey.getBytes(StandardCharsets.UTF_8));
                //noinspection ResultOfMethodCallIgnored
                keyFile.setReadable(false, false);
                //noinspection ResultOfMethodCallIgnored
                keyFile.setReadable(true, true);
                //noinspection ResultOfMethodCallIgnored
                keyFile.setWritable(true, true);

                SshdSessionFactory factory = new SshdSessionFactoryBuilder()
                    .setHomeDirectory(home)
                    .setSshDirectory(sshDir)
                    .setDefaultIdentities(dir -> Collections.singletonList(keyFile.toPath()))
                    .build(null);
                SshSessionFactory.setInstance(factory);

                // Passphrase via ssh-askpass is not available; keys without passphrase are preferred.
                // Encrypted keys: Apache MINA may prompt; we write passphrase file for custom use later.
                if (passphrase != null && !passphrase.isEmpty()) {
                    Files.write(
                        new File(sshDir, "passphrase").toPath(),
                        passphrase.getBytes(StandardCharsets.UTF_8)
                    );
                }

                File target = new File(targetPath);
                if (target.exists()) {
                    deleteRecursive(target);
                }
                //noinspection ResultOfMethodCallIgnored
                target.mkdirs();

                git = Git.cloneRepository()
                    .setURI(repoUrl)
                    .setDirectory(target)
                    .setBranch(branch)
                    .setCloneAllBranches(false)
                    .setTimeout(120)
                    .call();

                Repository repo = git.getRepository();
                ObjectId remoteHead = repo.resolve(Constants.R_REMOTES + "origin/" + branch);
                if (remoteHead == null) {
                    remoteHead = repo.resolve(Constants.HEAD);
                }
                if (remoteHead != null) {
                    git.reset().setMode(ResetCommand.ResetType.HARD).setRef(remoteHead.getName()).call();
                }

                if (testOnly) {
                    deleteRecursive(target);
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", testOnly ? "SSH 认证与克隆成功" : "同步完成");
                call.resolve(ret);
            } catch (GitAPIException | IOException | RuntimeException e) {
                reject(call, formatError(e));
            } finally {
                if (git != null) {
                    git.close();
                }
                SshSessionFactory.setInstance(previous);
                deleteRecursive(home);
            }
        }, "ark-git-pull").start();
    }

    private static void reject(PluginCall call, String message) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("message", message);
        call.resolve(ret);
    }

    private static String formatError(Exception e) {
        String message = e.getMessage() == null ? e.toString() : e.getMessage();
        if (message.matches("(?i).*(auth|permission denied|publickey|not authorized).*")) {
            return "Git 身份验证失败，请检查仓库权限或 SSH 私钥";
        }
        if (message.matches("(?i).*(not found|couldn't find remote ref|remote branch).*")) {
            return "未找到指定仓库或分支";
        }
        if (message.matches("(?i).*(network|timed out|timeout|connection|unknown host).*")) {
            return "无法连接远程仓库，请检查网络后重试";
        }
        return message;
    }

    private static void deleteRecursive(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursive(child);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
