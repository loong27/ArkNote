import Foundation
import Capacitor

/**
 * SSH Git pull for iOS via embedded clone helper (`ark_git_ssh_clone`).
 * Production builds should compile with libgit2 + libssh2 (`ARK_GIT_HAS_LIBGIT2=1`).
 * Without libgit2, HTTPS + Token (isomorphic-git) remains the supported path on iOS.
 */

@_silgen_name("ark_git_ssh_clone")
func ark_git_ssh_clone(
  _ repoUrl: UnsafePointer<CChar>?,
  _ branch: UnsafePointer<CChar>?,
  _ privateKeyPath: UnsafePointer<CChar>?,
  _ passphrase: UnsafePointer<CChar>?,
  _ targetPath: UnsafePointer<CChar>?,
  _ errorBuf: UnsafeMutablePointer<CChar>?,
  _ errorBufLen: Int32
) -> Int32

@objc(ArkGitPlugin)
public class ArkGitPlugin: CAPPlugin, CAPBridgedPlugin {
  public let identifier = "ArkGitPlugin"
  public let jsName = "ArkGit"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "testAuth", returnType: CAPPluginReturnPromise),
  ]

  @objc func pull(_ call: CAPPluginCall) {
    runPull(call, testOnly: false)
  }

  @objc func testAuth(_ call: CAPPluginCall) {
    runPull(call, testOnly: true)
  }

  private func runPull(_ call: CAPPluginCall, testOnly: Bool) {
    let repoUrl = call.getString("repoUrl") ?? ""
    let branch = call.getString("branch") ?? "main"
    let privateKey = call.getString("privateKey") ?? ""
    let passphrase = call.getString("passphrase") ?? ""
    let targetPath = call.getString("targetPath") ?? ""

    guard !repoUrl.isEmpty else {
      call.resolve(["success": false, "message": "仓库地址不能为空"])
      return
    }
    guard !privateKey.isEmpty else {
      call.resolve(["success": false, "message": "SSH 私钥不能为空"])
      return
    }
    guard !targetPath.isEmpty else {
      call.resolve(["success": false, "message": "目标路径不能为空"])
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let home = FileManager.default.temporaryDirectory
          .appendingPathComponent("ark-git-ssh-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: home) }

        let keyURL = home.appendingPathComponent("id_arknote")
        guard let keyData = privateKey.data(using: .utf8) else {
          call.resolve(["success": false, "message": "SSH 私钥编码失败"])
          return
        }
        try keyData.write(to: keyURL)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: keyURL.path)

        let target = URL(fileURLWithPath: targetPath)
        if FileManager.default.fileExists(atPath: target.path) {
          try FileManager.default.removeItem(at: target)
        }
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)

        var errorBuf = [CChar](repeating: 0, count: 1024)
        let rc = repoUrl.withCString { repoC in
          branch.withCString { branchC in
            keyURL.path.withCString { keyC in
              passphrase.withCString { passC in
                target.path.withCString { targetC in
                  ark_git_ssh_clone(repoC, branchC, keyC, passC, targetC, &errorBuf, Int32(errorBuf.count))
                }
              }
            }
          }
        }

        if rc != 0 {
          let msg = String(cString: errorBuf)
          call.resolve(["success": false, "message": Self.formatError(msg.isEmpty ? "SSH clone failed (\(rc))" : msg)])
          return
        }

        if testOnly {
          try? FileManager.default.removeItem(at: target)
        }

        call.resolve([
          "success": true,
          "message": testOnly ? "SSH 认证与克隆成功" : "同步完成",
        ])
      } catch {
        call.resolve(["success": false, "message": Self.formatError(error.localizedDescription)])
      }
    }
  }

  private static func formatError(_ message: String) -> String {
    if message.range(of: #"auth|permission denied|publickey|not authorized"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return "Git 身份验证失败，请检查仓库权限或 SSH 私钥"
    }
    if message.range(of: #"not found|couldn't find remote ref|remote branch"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return "未找到指定仓库或分支"
    }
    if message.range(of: #"network|timed out|timeout|connection|unknown host"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return "无法连接远程仓库，请检查网络后重试"
    }
    return message
  }
}
