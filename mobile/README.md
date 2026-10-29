# arkNote Reader（只读移动端）

Capacitor 只读客户端：用与桌面端相同的密码解锁加密仓库，支持列表、搜索、Markdown 预览。  
**不编辑、无账号。** 支持从 Git **单向同步**（云端 → 本机）。

## 环境

- Node.js 20+
- Android：Android Studio + SDK（`npx cap run android`）
- iOS：需 macOS + Xcode（先执行 `npm run cap:add:ios`）

## 安装与开发

```bash
cd mobile
npm install
npm run plugin:ark-git:build   # 编译本地 ArkGit 插件
npm run dev                    # 浏览器调试 http://localhost:5174（SSH 不可用，请用 HTTPS+Token）
npm run build
npm run cap:sync
```

根目录也可：

```bash
npm run mobile:dev
npm run mobile:build
npm run mobile:sync
```

## 在 Android 真机 / 模拟器运行

```bash
cd mobile
npm run build
npx cap sync android
npx cap open android
# 或
npx cap run android
```

首次若没有 `android/` 工程：`npm run cap:add:android`。

## iOS

```bash
cd mobile
npm run cap:add:ios   # 仅首次
npm run cap:sync
npx cap open ios
```

SSH 拉取在 iOS 上需要链接 libgit2 并定义编译宏 `ARK_GIT_HAS_LIBGIT2=1`（见 `plugins/ark-git/ios/Plugin/ark_git_ssh_clone.c`）。未链接时请改用 **HTTPS 仓库地址 + Token**。

## Git 单向同步

1. 打开应用 → **从 Git 同步…**（解锁页）或笔记列表顶栏 **同步**
2. 填写仓库地址与分支  
   - HTTPS：`https://github.com/org/vault.git`，私有库填写 PAT  
   - SSH：`git@github.com:org/vault.git`，导入 OpenSSH 私钥（可用 Deploy Key 只读）
3. **测试连接** → **立即同步**
4. 同步成功后用原仓库密码重新解锁

规则：

- 只拉不推，本地以远端为准
- SSH URL 走私钥；HTTPS URL 走 Token（按地址 scheme 选择，不混用）
- 私钥与 Token 仅存本机沙箱，不进入笔记仓库

## GitHub Actions 自动打包

与桌面端共用 [`.github/workflows/package.yml`](../.github/workflows/package.yml)：

- 推送 `v*` 标签，或手动 **Run workflow**
- Release 会附带 `arkNote-Reader-<tag>-android.apk`（已配置签名密钥时）或 `…-android-debug.apk`

| Secret | 说明 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `.jks` / `.p12` 的 base64 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | 别名（脚本默认 `arknote`） |
| `ANDROID_KEY_PASSWORD` | 密钥密码 |

## 使用流程（离线导入）

1. 桌面 arkNote：**设置 → 备份 → 导出加密备份**（zip）
2. 拷到手机 → **导入加密备份（zip）** → 同一密码 → **解锁只读**

也可「选择仓库目录」（需含 `salt.bin` / `verify.enc` / `metadata.json.enc`）。

## 架构

```text
mobile/src                 React UI（解锁 / 同步设置 / 列表 / 预览）
mobile/src/lib/vaultStore  Capacitor FS 持久化 vault
mobile/src/lib/syncPull    HTTPS isomorphic-git / SSH ArkGit 插件
mobile/plugins/ark-git     Capacitor 原生 SSH clone（Android JGit，iOS libgit2 可选）
shared/vaultRead.ts        只读解锁与检索
shared/gitRemote.ts        Git URL 校验（与桌面共用）
shared/vaultCrypto.ts      AES-256-GCM + PBKDF2-SHA512
```

## 明确不做

- 笔记编辑、标签改写、向 Git 推送
- 冲突合并 UI、自动定时同步
- S3 冷备上传
- 密码找回
- App Store / Play 上架与公证（本仓库只提供工程与本地运行方式）
