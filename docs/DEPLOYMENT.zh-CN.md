# arkNote 部署与发布指南

[English](./DEPLOYMENT.en.md) | 简体中文

本文面向 arkNote 维护者，覆盖本地开发、生产构建、跨平台打包、GitHub Release、自动更新以及加密数据仓库的初始化与恢复。

## 1. 部署模型

arkNote 包含两个彼此独立的仓库概念：

| 仓库 | 用途 | 是否包含用户笔记 |
| --- | --- | --- |
| 应用源码仓库 `loong27/ArkNote` | 源码、Actions、安装包和 Release | 否 |
| 用户加密数据仓库 | 密文笔记、图片、元数据和版本历史 | 是，但全部为密文 |

数字方舟的关键原则是让应用代码、托管服务和用户数据相互解耦。即使更换设备或 Git 服务，只要保留加密数据、密码和可运行的 arkNote，数据仍然可以恢复。

## 2. 环境要求

通用要求：

- Node.js 20
- npm
- Git
- 至少 4 GB 可用磁盘空间用于依赖和打包缓存

平台要求：

- Windows：PowerShell，NSIS 资源由 electron-builder 自动下载
- Linux：`libfuse2` 和 `rpm`；AppImage 运行环境需要 FUSE
- macOS：Xcode Command Line Tools；正式分发需要 Apple Developer 证书和公证

确认版本：

```bash
node --version
npm --version
git --version
```

## 3. 本地开发

```bash
git clone git@github.com:loong27/ArkNote.git
cd ArkNote
npm ci
npm run dev
```

`npm run dev` 会启动 Vite 开发服务器和 Electron。主进程、preload 与 React 渲染进程会分别构建并支持热更新。

不要使用真实生产数据验证破坏性场景。测试恢复或迁移时，应使用独立的临时用户目录和测试仓库。

## 4. 构建与测试

完整验证：

```bash
npm run build
```

执行顺序包括：

1. 图标尺寸、透明通道和 ICO 校验
2. 品牌命名与旧数据兼容测试
3. 密码策略、限流、加密和旧验证标记迁移
4. GitHub 数据仓库恢复安全测试
5. GitHub Release 更新配置测试
6. 中英翻译键、参数插值和动态消息测试
7. Git 双向同步集成测试
8. Markdown 扩展渲染测试
9. Vite、Electron 主进程和 preload 生产构建

单项测试：

```bash
npm run verify:icons
npm run test:brand
npm run test:auth
npm run test:restore
npm run test:updater
npm run test:i18n
npm run test:sync
npm run test:markdown
```

## 5. 本地打包

### Windows

```bash
npm run package:win
```

生成 NSIS x64、ia32 安装包。配置 GitHub 发布源后，还会生成：

```text
release/latest.yml
release/*.exe.blockmap
release/*Setup*.exe
```

### Linux

```bash
npm run package:linux
```

生成 AppImage、DEB 和 RPM。用于 AppImage 自动更新的文件包括：

```text
release/latest-linux.yml
release/*.AppImage.blockmap
release/*.AppImage
```

### macOS

```bash
npm run package:mac
```

应在 macOS 上执行。当前配置不自动选择签名身份，正式分发前必须补充签名、公证和 macOS Release 工作流。

## 6. GitHub Actions 自动发布

工作流文件：`.github/workflows/package.yml`

触发方式：

- 推送 `v*` 标签
- 在 GitHub Actions 页面手动运行 `workflow_dispatch`

推荐发布流程，以下以 `1.0.4` 为示例：

```bash
npm version 1.0.4 --no-git-tag-version
npm run build
git add package.json package-lock.json
git commit -m "release: v1.0.4"
git tag -a v1.0.4 -m "arkNote v1.0.4"
git push origin main
git push origin v1.0.4
```

工作流会：

1. 创建或复用对应的 GitHub Release
2. 在 Ubuntu 构建 AppImage、DEB 和 RPM
3. 在 Windows 构建 x64 与 ia32 NSIS 安装包
4. 上传安装包、`latest*.yml` 和 blockmap

发布完成后必须检查 Release 中至少包含：

```text
latest.yml
latest-linux.yml
*.blockmap
Windows installer(s)
AppImage
DEB
RPM
```

缺少 `latest*.yml` 时客户端无法发现更新；缺少 blockmap 时差分下载不可用；元数据中的 SHA-512 与实际安装包不一致时下载会被拒绝。

## 7. GitHub Release 自动更新

发布源定义在 `package.json`：

```json
{
  "provider": "github",
  "owner": "loong27",
  "repo": "ArkNote"
}
```

更新流程：

```text
应用启动
-> 延迟检查 GitHub Release
-> 比较语义版本
-> 通知用户发现新版本
-> 用户确认下载
-> SHA-512 校验与 blockmap 下载
-> 保存未落盘内容
-> 重启并安装
```

运行策略：

- 启动 12 秒后自动检查
- 运行期间每 6 小时检查一次
- 允许在设置页手动检查
- 下载完成后由用户确认重启
- 退出安装前复用笔记保存协调器，保存失败时取消安装

平台支持：

| 平台/格式 | 应用内更新 | 说明 |
| --- | --- | --- |
| Windows NSIS | 支持 | 使用 `latest.yml` |
| Linux AppImage | 支持 | 使用 `latest-linux.yml`，要求从 AppImage 启动 |
| Linux DEB / RPM | 不支持 | 通过系统包管理器或 Release 手动升级 |
| 开发模式 | 禁用 | 避免开发环境误下载正式版本 |

## 8. 代码签名

当前默认安装包未签名。面向公众部署时应配置：

- Windows Authenticode 代码签名证书
- macOS Developer ID Application 证书
- macOS notarization 凭据
- CI 中的证书和密码 Secrets

不要把 `.p12`、`.pfx`、私钥或密码提交到仓库。仓库 `.gitignore` 已排除常见证书和私钥格式。

自动更新使用 Release HTTPS 与 `latest*.yml` 中的 SHA-512 验证文件完整性，但这不能替代操作系统代码签名。

## 9. 用户加密数据仓库

建议为每位用户或每套数据建立独立的私有 GitHub 仓库，例如：

```text
git@github.com:<account>/<private-data-repo>.git
```

不要把用户数据提交到 `loong27/ArkNote` 源码仓库。

### 创建新数字方舟

1. 首次启动选择“创建新仓库”。
2. 设置至少 12 个字符的新密码。
3. 进入“设置 -> 同步”。
4. 填写独立数据仓库的 HTTPS 或 SSH 地址与分支。
5. 保存配置并执行首次同步。
6. 在 GitHub 确认远端只有密文文件。

### 在新设备恢复

1. 安装 arkNote，但不要创建新仓库。
2. 选择“从 GitHub 恢复”。
3. 输入加密数据仓库地址和分支。
4. 等待克隆和仓库结构验证完成。
5. 使用原 arkNote 密码解锁。
6. 检查目录、笔记、图片和版本历史。
7. 执行一次手动同步，确认远端连接正常。

恢复的安全约束：

- 仅接受 `https://github.com/...` 或 `git@github.com:...`
- 本地目标目录必须为空
- 禁止覆盖现有加密数据
- 先克隆到同磁盘临时目录
- 必须存在有效的 `salt.bin`、`verify.enc` 和 `metadata.json.enc`
- 拒绝包含符号链接的仓库
- 验证通过后使用原子重命名切换

私有仓库建议使用 SSH。运行应用的系统用户必须能够执行：

```bash
ssh -T git@github.com
git ls-remote git@github.com:<account>/<private-data-repo>.git
```

## 10. 配置与数据路径

默认路径：

```text
~/.ark-note-config.json   非敏感应用配置
~/.ark-note/              加密数据仓库
```

旧版本路径会在启动时兼容读取，并写入新的 arkNote 配置。不要在应用运行或密码变更过程中手动修改数据目录。

备份必须至少包含：

- `salt.bin`
- `verify.enc`
- `metadata.json.enc`
- `notes/`
- `images/`
- `versions/`
- `trash/`

只有笔记密文而没有 `salt.bin` 时无法重新派生原密钥。

## 11. 发布后检查

每次发布后执行以下检查：

1. GitHub Actions 的 Windows 与 Linux job 均为成功。
2. Release 标签和 `package.json` 版本一致。
3. 安装包名称使用 `arkNote`。
4. `latest*.yml` 指向 Release 中真实存在的文件。
5. SHA-512 和文件大小与安装包一致。
6. 在上一版本安装包中检查并下载新版本。
7. 验证有未保存笔记时，更新安装会先完成保存。
8. 在空数据目录测试 GitHub 恢复。
9. 在非空数据目录确认恢复被拒绝。

## 12. 常见问题

### 客户端提示找不到更新

- 确认新版本号高于当前版本。
- 确认 Release 不是草稿，并包含对应平台的 `latest*.yml`。
- 检查 `app-update.yml` 的 owner 和 repo。
- 检查系统代理、防火墙和 GitHub 可访问性。

### 更新下载完成但无法安装

- 确认安装包与 `latest.yml` SHA-512 一致。
- 检查安装目录写权限。
- Windows 正式分发应配置代码签名。
- Linux 只有 AppImage 支持应用内替换。

### GitHub 恢复失败

- 确认填写的是加密数据仓库，不是应用源码仓库。
- 确认分支存在。
- 私有仓库确认 SSH 密钥或 Git Credential Manager 可用。
- 确认本地数据目录为空。
- 确认远端包含完整的加密仓库文件。

### 密码无法解锁恢复的数据

- 必须使用创建该数据仓库时的密码。
- 密码区分大小写。
- 确认 `salt.bin` 来自同一个数据仓库。
- arkNote 不保存密码，也无法绕过加密恢复内容。
