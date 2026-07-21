# arkNote

[English](./README.en.md) | 简体中文

[产品官网与下载](https://loong27.github.io/ArkNote/) · [GitHub Releases](https://github.com/loong27/ArkNote/releases/latest)

[![Package Desktop App](https://github.com/loong27/ArkNote/actions/workflows/package.yml/badge.svg)](https://github.com/loong27/ArkNote/actions/workflows/package.yml)
[![Latest Release](https://img.shields.io/github/v/release/loong27/ArkNote)](https://github.com/loong27/ArkNote/releases/latest)

> 为长期保存个人知识而建造的数字方舟。

arkNote 是一款本地优先、端到端加密、支持 Git 同步的跨平台笔记应用。它不要求把可读的笔记交给某一家云服务，而是将笔记、图片、标签和版本历史加密后保存在用户控制的数据目录中，并允许通过独立的 GitHub 仓库迁移和恢复。

## 数字方舟

设备会损坏，平台会停止服务，账号和网络环境也会变化。arkNote 所说的“数字方舟”，不是云盘的另一个名字，而是一套让数字资产穿越设备、平台和服务生命周期的生存策略：

- **本地所有权**：数据首先存在本机，离线时仍可完整使用。
- **加密封存**：远端只保存密文；仓库泄露不等于笔记内容泄露。
- **可迁移性**：数据目录由用户控制，可复制、备份或托管到独立 Git 仓库。
- **可验证恢复**：新设备可以先恢复加密仓库，再用原密码解锁，无需创建空仓库。
- **服务可替换**：GitHub 是同步和恢复通道，不是数据格式本身的所有者。

arkNote 关注的不只是“今天把笔记写下来”，还包括多年后能否重新找到、验证并打开这些内容。

## 核心能力

- AES-256-GCM 本地加密存储
- PBKDF2-SHA512 密钥派生，600,000 次迭代
- Markdown 编辑、实时预览和常用扩展语法
- Mermaid 图表、任务列表、脚注、定义列表等增强渲染
- 图片加密存储、粘贴导入及尺寸保留
- 目录、标签、全文搜索、回收站和版本历史
- 中文与 English 界面即时切换，语言偏好本地持久化
- Git 双向同步、自动同步和冲突处理
- 首次启动支持“创建新仓库”与“从 GitHub 恢复”
- 基于 GitHub Release 的自动检查、下载和重启安装
- Windows、Linux 和 macOS 构建配置

## 首次启动

本地没有用户数据时，arkNote 不会强制先创建密码。启动页提供两条互不覆盖的路径：

```text
本地没有加密数据
├─ 创建新仓库
│  └─ 设置新密码 -> 初始化本地加密仓库
└─ 从 GitHub 恢复
   └─ 克隆加密数据仓库 -> 验证仓库结构 -> 使用原密码解锁
```

恢复操作只接受 GitHub HTTPS 或 SSH 地址，并且仅允许写入空数据目录。远端仓库会先克隆到临时目录，通过 `salt.bin`、`verify.enc`、`metadata.json.enc` 和符号链接检查后，再原子切换为正式数据目录。

> 应用源码仓库是 `loong27/ArkNote`。恢复时应填写你自己的**加密数据仓库**，不要填写应用源码仓库。

## 安全模型

| 项目 | 实现 |
| --- | --- |
| 内容加密 | AES-256-GCM |
| 密钥派生 | PBKDF2-SHA512，600,000 次迭代 |
| 密码要求 | 新密码至少 12 个字符，并拦截常见弱密码 |
| 解锁防护 | 失败退避、状态持久化、操作串行化 |
| 自动锁定 | 可配置空闲锁定和最小化锁定 |
| 密码变更 | 事务式重新加密，支持中断恢复 |
| 云端数据 | Git 仓库中保存加密文件，不保存明文笔记 |

密码不会上传，也没有找回通道。丢失密码意味着无法恢复数据，请在安全的位置保存密码和离线备份。

## 快速开始

### 环境要求

- Node.js 20
- npm
- Git

### 本地开发

```bash
git clone git@github.com:loong27/ArkNote.git
cd ArkNote
npm ci
npm run dev
```

### 验证生产构建

```bash
npm run build
```

该命令会依次验证品牌素材、认证安全、仓库恢复、自动更新配置、中英翻译完整性、Git 同步和 Markdown 渲染，然后构建渲染进程、Electron 主进程与 preload。

### 平台打包

```bash
npm run package:win
npm run package:linux
npm run package:mac
```

建议在目标操作系统上打包，正式 Release 建议使用仓库内的 GitHub Actions 工作流。

## 数据与同步

默认路径：

| 类型 | 路径 |
| --- | --- |
| 应用配置 | `~/.ark-note-config.json` |
| 加密数据目录 | `~/.ark-note` |

推荐为 arkNote 数据建立独立的私有 GitHub 仓库。同步仓库中通常包含：

```text
salt.bin
verify.enc
metadata.json.enc
notes/
images/
versions/
trash/
.git/
```

除 `.git/` 外，业务内容均以加密形式存储。多设备使用时，每台设备需要相同的仓库访问权限和相同的 arkNote 密码。

## 自动更新

正式安装包会读取 `loong27/ArkNote` 的 GitHub Release：

- Windows NSIS：支持应用内检查、下载和重启安装。
- Linux AppImage：支持应用内检查、下载和重启安装。
- Linux DEB / RPM：提示前往 Release 手动更新。
- 开发环境：不执行自动更新。

自动更新依赖 Release 中的 `latest*.yml`、安装包和 blockmap。仓库工作流会在发布时一并上传这些文件。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 与 Electron 开发环境 |
| `npm run build` | 运行完整测试并生成生产构建 |
| `npm run test:auth` | 验证认证、限流和加密流程 |
| `npm run test:restore` | 验证 GitHub 恢复和禁止覆盖策略 |
| `npm run test:sync` | 运行 Git 同步集成测试 |
| `npm run test:updater` | 验证 GitHub Release 更新配置 |
| `npm run test:i18n` | 验证中英翻译键、参数插值和动态消息 |
| `npm run brand:generate` | 从 SVG 母版重新生成品牌素材 |

## 项目结构

```text
electron/                 Electron 主进程、IPC 与本地服务
shared/                   主进程和渲染进程共享逻辑
src/                      React 界面、状态管理与编辑器
build/                    品牌 SVG 母版和平台图标
public/                   Web 与桌面运行时静态素材
scripts/                  安全、同步、恢复、更新和素材测试
.github/workflows/        跨平台打包与 GitHub Release 发布
```

## 部署文档

- [中文部署指南](./docs/DEPLOYMENT.zh-CN.md)
- [English deployment guide](./docs/DEPLOYMENT.en.md)

## 当前边界

- 自动更新的 Windows 包默认未签名；面向公众分发时应配置代码签名证书。
- macOS 已有本地构建配置，但当前 GitHub Actions 尚未发布 macOS 安装包。
- Linux DEB 与 RPM 由系统包管理器负责升级，不执行应用内替换。
- OSS 配置界面仍处于预留状态，当前稳定同步路径是 Git。

## 仓库

- Source: <https://github.com/loong27/ArkNote>
- Releases: <https://github.com/loong27/ArkNote/releases>
- Issues: <https://github.com/loong27/ArkNote/issues>
