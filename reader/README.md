# arkNote Reader CLI

只读命令行工具，与移动端共用 [`shared/vaultRead.ts`](../shared/vaultRead.ts)。

## 用法

在仓库根目录：

```bash
npm run reader -- list --dir ~/.ark-note
npm run reader -- search "关键词" --dir ~/.ark-note
npm run reader -- show <note-id> --dir ~/.ark-note
```

或：

```bash
node reader/vault-reader.mjs list --dir %USERPROFILE%\.ark-note
```

密码通过环境变量传入：

```bash
set ARKNOTE_PASSWORD=your-password
npm run reader -- list --dir %USERPROFILE%\.ark-note
```

## 移动端 App

见 [`mobile/README.md`](../mobile/README.md)（Capacitor 只读客户端）。
