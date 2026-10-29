# arkNote Reader（只读移动端）

Capacitor 只读客户端：用与桌面端相同的密码解锁加密仓库，支持列表、搜索、Markdown 预览。  
**不编辑、不同步、无账号。**

## 环境

- Node.js 20+
- Android：Android Studio + SDK（`npx cap run android`）
- iOS：需 macOS + Xcode（先执行 `npm run cap:add:ios`）

## 安装与开发

在仓库根目录或本目录：

```bash
cd mobile
npm install
npm run dev          # 浏览器调试 http://localhost:5174
npm run build        # 产出 dist/
npm run cap:sync     # 同步到 android/
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

## GitHub Actions 自动打包

与桌面端共用 [`.github/workflows/package.yml`](../.github/workflows/package.yml)：

- 推送 `v*` 标签，或手动 **Run workflow**
- Release 会附带 `arkNote-Reader-<tag>-android.apk`（已配置签名密钥时）或 `…-android-debug.apk`（默认，可侧载安装）

**正式签名不是侧载必需。** 自用/内测用 debug APK 即可。长期同一身份升级或以后上 Play 才需要固定签名。

在仓库根目录生成本机密钥（不入库，默认 `~/.arknote-certs/`）并写入 GitHub Secrets：

```bash
npm run android:keystore -- --set-secrets
```

| Secret | 说明 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `.jks` / `.p12` 的 base64 |
| `ANDROID_KEYSTORE_PASSWORD` | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | 别名（脚本默认 `arknote`） |
| `ANDROID_KEY_PASSWORD` | 密钥密码 |

丢失 keystore 后无法用同一签名升级。未配置 Secrets 时仍会产出 debug APK，不阻断桌面打包。

## 使用流程（验收）

1. 桌面 arkNote：**设置 → 备份 → 导出加密备份**（zip）
2. 把 zip 拷到手机（或模拟器共享目录）
3. 打开 arkNote Reader → **导入加密备份（zip）** → 输入同一密码 → **解锁只读**
4. 浏览列表、搜索、打开笔记正文

也可在支持的环境中「选择仓库目录」（需含 `salt.bin` / `verify.enc` / `metadata.json.enc`）。

## 架构

```text
mobile/src          React UI（解锁 / 列表 / 搜索 / 预览）
shared/vaultRead.ts 只读解锁与检索（Web Crypto，与 CLI 共用）
shared/vaultCrypto.ts AES-256-GCM + PBKDF2-SHA512
reader/vault-reader.mjs  Node CLI，调用同一共享模块
```

## 明确不做

- 笔记编辑、标签改写
- Git / 冷备份上传
- 密码找回
- App Store / Play 上架与公证（本仓库只提供工程与本地运行方式）
