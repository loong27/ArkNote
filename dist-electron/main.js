"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const simpleGit = require("simple-git");
const electronUpdater = require("electron-updater");
const EN_TRANSLATIONS = {
  "中文": "Chinese",
  "英语": "English",
  "显示窗口": "Show window",
  "退出": "Quit",
  "默认头像": "Default avatar",
  "确认": "Confirm",
  "取消": "Cancel",
  "未命名笔记": "Untitled note",
  "已打开的笔记": "Open notes",
  "关闭 {title}": "Close {title}",
  "更新已就绪": "Update ready",
  "arkNote 有新版本": "A new arkNote version is available",
  "下载进度 {progress}%": "Download progress {progress}%",
  "重启安装": "Restart and install",
  "下载": "Download",
  "暂时关闭": "Dismiss",
  "移动到...": "Move to...",
  "搜索目录...": "Search folders...",
  "选中: {path}": "Selected: {path}",
  "未找到匹配的目录": "No matching folders",
  "暂无目录": "No folders yet",
  "移动中...": "Moving...",
  "确认移动": "Move",
  "历史版本": "Version history",
  "暂无历史版本": "No version history",
  "使用 Ctrl+S 手动保存版本，或等待自动保存": "Press Ctrl+S to save a version, or wait for automatic saving",
  "手动保存": "Manual save",
  "自动保存": "Automatic save",
  "版本预览": "Version preview",
  "加载中...": "Loading...",
  "关闭": "Close",
  "恢复中...": "Restoring...",
  "恢复此版本": "Restore this version",
  "选择一个目录": "Select a folder",
  "从左侧目录树中选择一个目录查看其内容": "Select a folder from the tree on the left to view its contents",
  "首页": "Home",
  "列表视图": "List view",
  "卡片视图": "Card view",
  "批量导出": "Batch export",
  "展开全部": "Expand all",
  "折叠全部": "Collapse all",
  "{count} 篇笔记": "{count} notes",
  "笔记 ({count})": "Notes ({count})",
  "此目录为空": "This folder is empty",
  "在左侧目录树中右键可以新建笔记": "Right-click a folder in the tree to create a note",
  "未选择标签": "No tag selected",
  "该标签下暂无笔记": "No notes with this tag",
  "在笔记中搜索...": "Search in note...",
  "上一个 (Shift+Enter)": "Previous (Shift+Enter)",
  "下一个 (Enter)": "Next (Enter)",
  "关闭 (Esc)": "Close (Esc)",
  "安全、加密的跨平台笔记应用": "A secure, encrypted, cross-platform notes app",
  "保存版本": "Save version",
  "笔记内搜索": "Search in note",
  "粘贴图片": "Paste image",
  "锁定笔记库": "Lock vault",
  "最小化": "Minimize",
  "还原": "Restore",
  "最大化": "Maximize",
  "关闭窗口": "Close window",
  "请选择关闭窗口后的操作：": "Choose what happens after closing the window:",
  "最小化到托盘": "Minimize to tray",
  "窗口隐藏，后台继续运行": "Hide the window and keep running in the background",
  "退出应用": "Quit application",
  "完全关闭应用程序": "Close the application completely",
  "记住我的选择（可在设置中重置）": "Remember my choice (changeable in Settings)",
  "搜索...": "Search...",
  "全部笔记": "All notes",
  "标签": "Tags",
  "回收站": "Trash",
  "设置": "Settings",
  "刷新": "Refresh",
  "清空回收站": "Empty trash",
  "无标题": "Untitled",
  "新建子目录": "New subfolder",
  "新建笔记": "New note",
  "更多": "More",
  "重命名": "Rename",
  "导入 MD": "Import Markdown",
  "导入 PDF": "Import PDF",
  "删除": "Delete",
  "新目录名称": "New folder name",
  "新笔记标题": "New note title",
  "搜索目录和笔记...": "Search folders and notes...",
  "新增": "New",
  "新增目录": "New folder",
  "新增笔记": "New note",
  "新笔记名称": "New note name",
  "未找到匹配的目录或笔记": "No matching folders or notes",
  "暂无目录，点击上方新增创建": "No folders yet. Use New above to create one",
  "移入回收站": "Move to trash",
  "确定要将目录「{name}」及其所有内容移入回收站吗？": 'Move the folder "{name}" and all of its contents to trash?',
  "确定要将笔记「{name}」移入回收站吗？": 'Move the note "{name}" to trash?',
  "搜索标签...": "Search tags...",
  "返回标签列表": "Back to tags",
  "未找到匹配的标签": "No matching tags",
  "暂无标签": "No tags yet",
  "在所有笔记中搜索...": "Search all notes...",
  "在 {count} 个目录中搜索": "Searching in {count} folders",
  "在所有笔记中搜索": "Searching all notes",
  "选择搜索范围": "Choose search scope",
  "选择搜索范围 (不选则搜索全部)": "Choose search scope (leave empty to search all)",
  "搜索中...": "Searching...",
  "未找到匹配结果": "No matching results",
  "第 {line} 行: {context}": "Line {line}: {context}",
  "...还有 {count} 处匹配": "...and {count} more matches",
  "输入关键词搜索所有笔记": "Enter keywords to search all notes",
  "回收站为空": "Trash is empty",
  "恢复": "Restore",
  "彻底删除": "Delete permanently",
  "恢复确认": "Confirm restore",
  "确定要恢复「{name}」吗？": 'Restore "{name}"?',
  "确定要彻底删除「{name}」吗？此操作不可撤销，所有内容及历史版本将被永久删除。": 'Permanently delete "{name}"? This cannot be undone, and all content and version history will be deleted.',
  "确认删除": "Delete permanently",
  "确定要清空回收站吗？所有内容将被永久删除，此操作不可撤销。": "Empty the trash? All content will be permanently deleted and this cannot be undone.",
  "确认清空": "Empty trash",
  "更多操作": "More actions",
  "下载 MD": "Download Markdown",
  "导出为 PDF": "Export as PDF",
  "添加标签": "Add tags",
  "保存失败": "Save failed",
  "保存版本失败": "Failed to save version",
  "标题保存失败": "Failed to save title",
  "保存版本 (Ctrl+S)": "Save version (Ctrl+S)",
  "未保存": "Unsaved",
  "保存中...": "Saving...",
  "已保存": "Saved",
  "保存失败：{message}": "Save failed: {message}",
  "请重试": "Please try again",
  "编辑": "Edit",
  "分栏": "Split",
  "预览": "Preview",
  "关闭原图预览": "Close image preview",
  "原图预览": "Full-size image preview",
  "粗体文本": "bold text",
  "斜体文本": "italic text",
  "标题": "Heading",
  "插入文本": "inserted text",
  "删除线文本": "strikethrough text",
  "高亮文本": "highlighted text",
  "下标": "Subscript",
  "上标": "Superscript",
  "引用内容": "Quoted text",
  "列表项": "List item",
  "任务项": "Task item",
  "代码": "code",
  "链接文本": "Link text",
  "图片": "Image",
  "列 {number}": "Column {number}",
  "内容": "Content",
  "正文": "Body text",
  "脚注内容": "Footnote text",
  "术语": "Term",
  "定义内容": "Definition",
  "彩色文本": "Colored text",
  "参与者 A": "Participant A",
  "参与者 B": "Participant B",
  "请求": "Request",
  "响应": "Response",
  "开始": "Start",
  "判断": "Decision",
  "是": "Yes",
  "处理": "Process",
  "否": "No",
  "结束": "End",
  "饼图示例": "Pie chart example",
  "类别 {letter}": "Category {letter}",
  "标题与正文": "Headings and body text",
  "引用": "Quote",
  "代码块": "Code block",
  "加粗 (Ctrl+B)": "Bold (Ctrl+B)",
  "斜体 (Ctrl+I)": "Italic (Ctrl+I)",
  "插入文本 / 下划线": "Inserted text / underline",
  "删除线": "Strikethrough",
  "文本高亮": "Highlight",
  "字体颜色": "Text color",
  "内嵌代码": "Inline code",
  "无序列表": "Bulleted list",
  "有序列表": "Numbered list",
  "任务列表": "Task list",
  "定义列表": "Definition list",
  "水平线": "Horizontal rule",
  "插入链接": "Insert link",
  "插入图片": "Insert image",
  "插入表格": "Insert table",
  "插入脚注": "Insert footnote",
  "时序图": "Sequence diagram",
  "流程图": "Flowchart",
  "饼图": "Pie chart",
  "插入表情": "Insert emoji",
  "插入笔记链接": "Insert note link",
  "一级标题": "Heading 1",
  "{level} 级标题": "Heading {level}",
  "{rows} 行 × {cols} 列": "{rows} rows x {cols} columns",
  "选择表格大小": "Choose table size",
  "插入 {rows} 行 {cols} 列表格": "Insert a {rows} by {cols} table",
  "搜索笔记...": "Search notes...",
  "未找到笔记": "No notes found",
  "创建标签失败": "Failed to create tag",
  "删除标签失败": "Failed to delete tag",
  "新标签名称 (回车添加)": "New tag name (press Enter)",
  "标签颜色": "Tag color",
  "该标签关联了其他笔记，无法删除": "This tag is used by other notes and cannot be deleted",
  "删除标签": "Delete tag",
  "暂无标签，请创建一个": "No tags yet. Create one to get started",
  "已选择 {count} 个标签": "{count} tags selected",
  "保存": "Save",
  "({count} 篇笔记)": "({count} notes)",
  "操作失败，请重试": "Operation failed. Please try again",
  "请设置加密密码": "Set an encryption password",
  "密码至少需要 12 个字符": "Password must contain at least 12 characters",
  "两次输入的密码不一致": "The passwords do not match",
  "初始化失败，请重试": "Initialization failed. Please try again",
  "请输入密码": "Enter your password",
  "解锁失败，请重试": "Unlock failed. Please try again",
  "请输入 GitHub 仓库地址": "Enter a GitHub repository URL",
  "恢复失败，请检查网络和仓库权限后重试": "Restore failed. Check your network and repository access, then try again",
  "欢迎使用 arkNote": "Welcome to arkNote",
  "选择新建加密仓库，或恢复已有的 GitHub 数据。": "Create a new encrypted vault or restore existing data from GitHub.",
  "创建新仓库": "Create a new vault",
  "设置新密码并初始化本地加密数据": "Set a new password and initialize encrypted local data",
  "从 GitHub 恢复": "Restore from GitHub",
  "拉取已有加密仓库并使用原密码解锁": "Clone an encrypted vault and unlock it with its existing password",
  "返回": "Back",
  "恢复加密仓库": "Restore encrypted vault",
  "仓库将恢复到当前空数据目录，完成后使用原密码解锁。": "The vault will be restored into the current empty data folder. Unlock it with the existing password when complete.",
  "GitHub 仓库地址": "GitHub repository URL",
  "分支": "Branch",
  "正在从 GitHub 恢复...": "Restoring from GitHub...",
  "恢复加密数据": "Restore encrypted data",
  "正在加载...": "Loading...",
  "首次使用需要设置加密密码。此密码用于加密所有本地文件，": "Set an encryption password before creating your first vault. It encrypts every local file.",
  "请务必牢记密码，密码丢失将无法恢复数据。": "Keep this password safe. Lost passwords and encrypted data cannot be recovered.",
  "设置密码（至少 12 个字符）": "Set password (at least 12 characters)",
  "输入密码": "Enter password",
  "确认密码": "Confirm password",
  "再次输入密码": "Enter password again",
  "密码强度: {strength}": "Password strength: {strength}",
  "太短": "Too short",
  "一般": "Fair",
  "较强": "Strong",
  "初始化中...": "Initializing...",
  "创建加密仓库": "Create encrypted vault",
  "关于加密": "About encryption",
  "所有笔记、图片均使用 AES-256-GCM 加密存储": "All notes and images are stored with AES-256-GCM encryption",
  "密码通过 PBKDF2 派生密钥，安全可靠": "Keys are securely derived from your password using PBKDF2",
  "关闭软件后密码自动清除，下次需重新输入": "The password is cleared when the app closes and must be entered next time",
  "可在设置中随时修改密码和数据存储位置": "Change the password and data location at any time in Settings",
  "数据恢复完成，请输入原仓库密码解锁": "Restore complete. Enter the vault's existing password to unlock it",
  "请输入密码解锁您的笔记": "Enter your password to unlock your notes",
  "{seconds} 秒后重试": "Try again in {seconds}s",
  "解锁中...": "Unlocking...",
  "解锁": "Unlock",
  "尚未检查更新": "Updates have not been checked",
  "{message}。需要重启应用以生效。": "{message}. Restart the application to apply the change.",
  "操作失败: {message}": "Operation failed: {message}",
  "请输入当前密码": "Enter your current password",
  "请输入新密码": "Enter a new password",
  "新密码至少需要 12 个字符": "The new password must contain at least 12 characters",
  "两次输入的新密码不一致": "The new passwords do not match",
  "新密码不能与旧密码相同": "The new password must differ from the current password",
  "密码修改成功！所有文件已使用新密码重新加密。": "Password changed. All files have been re-encrypted with the new password.",
  "密码修改失败": "Failed to change password",
  "密码修改失败: {message}": "Failed to change password: {message}",
  "安全设置已保存": "Security settings saved",
  "设置保存失败: {message}": "Failed to save settings: {message}",
  "同步配置已保存": "Sync settings saved",
  "配置失败: {message}": "Configuration failed: {message}",
  "同步失败: {message}": "Sync failed: {message}",
  "请为每个冲突文件选择保留版本": "Choose a version to keep for every conflicting file",
  "冲突已解决，数据已更新": "Conflicts resolved and data updated",
  "解决冲突失败: {message}": "Failed to resolve conflicts: {message}",
  "通用": "General",
  "数据存储": "Storage",
  "密码与安全": "Password & security",
  "同步": "Sync",
  "语言": "Language",
  "选择应用界面的显示语言。": "Choose the application display language.",
  "外观": "Appearance",
  "选择应用界面的显示模式。": "Choose the application appearance.",
  "白天模式": "Light",
  "暗夜模式": "Dark",
  "关闭窗口时的操作": "When closing the window",
  "选择点击关闭按钮后的行为。": "Choose what the close button does.",
  "每次询问": "Ask every time",
  "每次点击关闭按钮时弹出选择对话框": "Show a choice whenever the close button is clicked",
  "直接隐藏窗口，应用在后台继续运行": "Hide the window and keep the application running in the background",
  "直接关闭并退出整个应用程序": "Close the window and quit the application",
  "应用更新": "Application updates",
  "当前版本 {version}": "Current version {version}",
  "下载更新": "Download update",
  "检查中": "Checking",
  "检查更新": "Check for updates",
  "上次检查 {date}": "Last checked {date}",
  "数据存储目录": "Data storage folder",
  "所有笔记、图片、标签和版本历史都加密存储在此目录中。你可以将此目录指向 Git 仓库、Dropbox、OneDrive 或其他云同步文件夹，实现多平台数据同步。": "All notes, images, tags, and version history are encrypted in this folder. Point it to a Git repository, Dropbox, OneDrive, or another synchronized folder to keep encrypted data available across devices.",
  "选择数据存储目录...": "Choose a data storage folder...",
  "浏览": "Browse",
  "默认目录:": "Default folder:",
  "配置文件:": "Configuration file:",
  "重启应用": "Restart application",
  "应用中...": "Applying...",
  "应用目录变更": "Apply folder change",
  "多平台同步提示": "Cross-platform sync tips",
  "将数据目录设为 Git 仓库目录，然后通过 GitHub/GitLab 同步": "Use a Git repository as the data folder, then synchronize through GitHub or GitLab",
  "或将数据目录指向 Dropbox / OneDrive / 坚果云等云盘的同步文件夹": "Or use a synchronized folder from Dropbox, OneDrive, Nutstore, or another provider",
  "所有文件都已加密，即使在云端也是安全的": "Every file remains encrypted when stored in the cloud",
  "多台设备使用相同密码即可解锁同一个数据仓库": "Use the same password to unlock the vault on each device",
  "修改加密密码": "Change encryption password",
  "修改密码后，所有本地文件将使用新密码重新加密。此操作可能需要一些时间，具体取决于你的笔记和图片数量。": "Changing the password re-encrypts every local file. This may take some time depending on the number of notes and images.",
  "当前密码": "Current password",
  "输入当前密码": "Enter current password",
  "新密码（至少 12 个字符）": "New password (at least 12 characters)",
  "输入新密码": "Enter new password",
  "确认新密码": "Confirm new password",
  "再次输入新密码": "Enter new password again",
  "加密处理中，请稍候...": "Re-encrypting files...",
  "请在 {seconds} 秒后重试": "Try again in {seconds}s",
  "修改密码": "Change password",
  "自动锁定": "Automatic locking",
  "空闲后锁定": "Lock after inactivity",
  "从不": "Never",
  "{minutes} 分钟": "{minutes} minutes",
  "最小化或隐藏窗口时锁定": "Lock when the window is minimized or hidden",
  "保存安全设置": "Save security settings",
  "注意事项": "Important",
  "修改密码会重新加密所有文件（笔记、图片、版本历史）": "Changing the password re-encrypts all files, including notes, images, and version history",
  "请务必记住新密码，密码丢失将无法恢复数据": "Keep the new password safe. Lost passwords and encrypted data cannot be recovered",
  "无法恢复": "cannot be recovered",
  "如果你使用多平台同步，所有设备都需要使用新密码": "Every synchronized device must use the new password",
  "处理过程中请勿关闭应用": "Do not close the application while re-encryption is in progress",
  "同步配置": "Sync configuration",
  "配置远程仓库或 OSS 来同步你的加密笔记数据。": "Configure a remote repository or OSS provider to synchronize encrypted notes.",
  "同步方式": "Sync provider",
  "OSS 对象存储": "OSS object storage",
  "仓库地址（HTTPS 或 SSH）": "Repository URL (HTTPS or SSH)",
  "https://github.com/user/repo.git 或 git@github.com:user/repo.git": "https://github.com/user/repo.git or git@github.com:user/repo.git",
  "分支名称": "Branch name",
  "Bucket 名称": "Bucket name",
  "自动同步": "Automatic sync",
  "每": "Every",
  "分钟": "minutes",
  "保存同步配置": "Save sync settings",
  "同步操作": "Sync actions",
  "同步中...": "Syncing...",
  "立即同步": "Sync now",
  "状态:": "Status:",
  "就绪": "Ready",
  "上次同步: {date}": "Last synced: {date}",
  "冲突文件 ({count})": "Conflicting files ({count})",
  "加密文件无法自动合并，请为每个文件选择要保留的完整版本。未选择的一侧将被覆盖。": "Encrypted files cannot be merged automatically. Choose the complete version to keep for each file; the other version will be overwritten.",
  "保留本地": "Keep local",
  "使用远程": "Use remote",
  "处理中...": "Processing...",
  "解决冲突并继续同步": "Resolve conflicts and continue syncing",
  "密码错误，请重试": "Incorrect password. Please try again",
  "密码长度超出允许范围": "Password exceeds the allowed length",
  "该密码过于常见，请使用更长的随机密码或多个单词组成的口令": "This password is too common. Use a longer random password or a multi-word passphrase",
  "密码不能只包含重复字符或数字": "Password cannot contain only repeated characters or digits",
  "少于 16 个字符的密码需要包含至少两类字符": "Passwords shorter than 16 characters must use at least two character types",
  "解锁失败，请检查数据目录后重试": "Unlock failed. Check the data folder and try again",
  "本地已有加密数据，不能执行首次恢复": "Encrypted local data already exists, so first-time restore is unavailable",
  "恢复任务正在进行，请稍候": "A restore is already in progress",
  "加密数据已恢复，请使用原仓库密码解锁": "Encrypted data restored. Unlock it with the existing vault password",
  "请输入有效的 GitHub HTTPS 或 SSH 仓库地址": "Enter a valid GitHub HTTPS or SSH repository URL",
  "分支名称无效": "Invalid branch name",
  "本地数据路径不是目录": "The local data path is not a folder",
  "本地数据目录已有内容，已取消恢复以避免覆盖数据": "The local data folder is not empty. Restore was cancelled to prevent overwriting data",
  "远程仓库不是有效的 Git 仓库": "The remote repository is not a valid Git repository",
  "远程仓库缺少有效的 salt.bin": "The remote repository does not contain a valid salt.bin",
  "远程仓库缺少有效的 verify.enc": "The remote repository does not contain a valid verify.enc",
  "远程仓库缺少有效的 metadata.json.enc": "The remote repository does not contain a valid metadata.json.enc",
  "远程仓库包含不受支持的符号链接": "The remote repository contains unsupported symbolic links",
  "GitHub 身份验证失败，请检查仓库权限或 SSH 密钥": "GitHub authentication failed. Check repository access or your SSH key",
  "未找到指定仓库或分支": "The specified repository or branch was not found",
  "无法连接 GitHub，请检查网络后重试": "Unable to reach GitHub. Check your network and try again",
  "当前正在使用此数据目录，不会执行迁移或切换。": "This data folder is already in use. No migration or switch will be performed.",
  "检测到已有 arkNote 数据仓库：应用后只会切换到此目录，不会迁移或覆盖当前数据。": "An existing arkNote vault was found. Applying this change will switch to it without migrating or overwriting current data.",
  "未检测到已有 arkNote 数据仓库：应用后会把当前数据迁移到此目录。": "No arkNote vault was found. Applying this change will migrate current data to this folder.",
  "已切换到已有的数据仓库": "Switched to the existing vault",
  "数据已迁移到新目录": "Data migrated to the new folder",
  "窗口未找到": "Window not found",
  "已取消": "Cancelled",
  "标签已删除": "Tag deleted",
  "正在检查 GitHub Release...": "Checking GitHub Releases...",
  "检查更新失败": "Failed to check for updates",
  "正在下载更新...": "Downloading update...",
  "下载更新失败": "Failed to download update",
  "当前已是最新版本": "You are running the latest version",
  "自动更新失败": "Automatic update failed",
  "开发环境不执行自动更新": "Automatic updates are disabled in development",
  "当前 Linux 安装格式不支持应用内更新，请从 GitHub Release 更新": "This Linux package cannot update in the application. Install the latest version from GitHub Releases",
  "Git 仓库地址不能为空": "Git repository URL is required",
  "当前仓库仍有未完成的 merge，不能更换远程仓库地址": "The repository has an unfinished merge, so the remote URL cannot be changed",
  "同步未配置": "Sync is not configured",
  "暂不支持此同步方式": "This sync provider is not supported yet",
  "Git 未初始化": "Git is not initialized",
  "自动同步已跳过：当前内容尚未保存": "Automatic sync was skipped because current changes could not be saved",
  "仓库仍有未解决的冲突": "The repository still has unresolved conflicts",
  "Git merge 未能正常结束": "The Git merge did not finish correctly",
  "已恢复旧版同步遗留的 rebase，请重新执行同步。": "A rebase left by an older version was recovered. Run sync again.",
  "当前没有正在处理的 Git merge，请重新执行同步。": "There is no Git merge in progress. Run sync again.",
  "冲突文件已经变化，请重新选择保留版本。": "Conflicting files have changed. Choose the versions to keep again.",
  "冲突文件已暂存，但 Git merge 仍未结束": "Conflicting files were staged, but the Git merge is still in progress",
  "冲突已解决并同步到远程": "Conflicts resolved and synchronized to the remote repository",
  "正在同步": "Syncing",
  "检测到旧版同步遗留的 rebase，下次同步时将自动恢复。": "A rebase left by an older version was found and will be recovered during the next sync.",
  "Git merge 尚未完成，请重新执行同步以继续。": "A Git merge is unfinished. Run sync again to continue.",
  "已同步": "Synchronized",
  "同步成功": "Sync completed",
  "自动同步成功": "Automatic sync completed",
  "目录层级最多为3级": "Folders can be nested up to three levels",
  "密码盐文件已损坏，请从备份恢复 salt.bin": "The password salt is damaged. Restore salt.bin from a backup",
  "检测到加密数据但缺少 salt.bin，请从备份恢复后再解锁": "Encrypted data was found without salt.bin. Restore it from a backup before unlocking",
  "密码验证文件缺失，请从备份恢复 verify.enc": "The password verification file is missing. Restore verify.enc from a backup",
  "密码验证文件已损坏，请从备份恢复 verify.enc": "The password verification file is damaged. Restore verify.enc from a backup",
  "根目录": "Root",
  "选择数据存储目录": "Choose data storage folder",
  "选择此目录": "Choose this folder",
  "下载笔记": "Download note",
  "选择导出目录": "Choose export folder",
  "导出到此目录": "Export here",
  "导出为PDF": "Export as PDF",
  "选择图片": "Choose image",
  "导入 Markdown 文件": "Import Markdown files",
  "导入 PDF 文件": "Import PDF files",
  "PDF 文件": "PDF files",
  "所有文件": "All files",
  "导入的笔记": "Imported note",
  "导入的PDF笔记": "Imported PDF note",
  "从 PDF 文件导入: {file}": "Imported from PDF: {file}",
  "PDF 信息: {pages} 页": "PDF information: {pages} pages",
  "未知": "Unknown",
  "PDF 文本提取失败。错误: {message}": "PDF text extraction failed. Error: {message}",
  "你可以手动将 PDF 内容复制粘贴到此笔记中。": "You can manually copy and paste the PDF content into this note."
};
const EN_PATTERN_TRANSLATIONS = [
  { pattern: /^尝试次数过多，请在 (\d+) 秒后重试$/, replace: (seconds) => `Too many attempts. Try again in ${seconds}s` },
  { pattern: /^密码错误，请在 (\d+) 秒后重试$/, replace: (seconds) => `Incorrect password. Try again in ${seconds}s` },
  { pattern: /^密码至少需要 (\d+) 个字符$/, replace: (count) => `Password must contain at least ${count} characters` },
  { pattern: /^该标签关联了 (\d+) 篇笔记，无法删除。请先移除关联后再删除。$/, replace: (count) => `This tag is used by ${count} notes. Remove those associations before deleting it.` },
  { pattern: /^发现新版本 (.+)$/, replace: (version) => `Version ${version} is available` },
  { pattern: /^正在下载更新 (\d+)%$/, replace: (progress) => `Downloading update ${progress}%` },
  { pattern: /^版本 (.+) 已下载，重启后安装$/, replace: (version) => `Version ${version} is downloaded and will install after restart` },
  { pattern: /^迁移失败: (.+)$/, replace: (message) => `Migration failed: ${message}` },
  { pattern: /^导出完成！共导出 (\d+) 篇笔记到 (.+)$/, replace: (count, target) => `Exported ${count} notes to ${target}` },
  { pattern: /^导出失败: (.+)$/, replace: (message) => `Export failed: ${message}` },
  { pattern: /^成功导入 (\d+) 个文件$/, replace: (count) => `Imported ${count} files` },
  { pattern: /^成功导入 (\d+) 个 PDF 文件$/, replace: (count) => `Imported ${count} PDF files` },
  { pattern: /^导入失败: (.+)$/, replace: (message) => `Import failed: ${message}` },
  { pattern: /^有 (\d+) 个文件存在冲突，需要选择保留版本$/, replace: (count) => `${count} files conflict and require a version choice` },
  { pattern: /^有 (\d+) 个文件待同步$/, replace: (count) => `${count} files are waiting to sync` },
  { pattern: /^分支 (.+) 仍有未完成的 merge，无法切换到 (.+)$/, replace: (current, target) => `Branch ${current} has an unfinished merge and cannot switch to ${target}` },
  { pattern: /^文件 (.+) 缺少冲突解决方案$/, replace: (file) => `No conflict resolution was chosen for ${file}` },
  { pattern: /^非法冲突文件路径: (.+)$/, replace: (file) => `Invalid conflict file path: ${file}` },
  { pattern: /^解决冲突失败: (.+)$/, replace: (message) => `Failed to resolve conflicts: ${message}` },
  { pattern: /^状态查询失败: (.+)$/, replace: (message) => `Failed to query status: ${message}` },
  { pattern: /^同步失败: (.+)$/, replace: (message) => `Sync failed: ${message}` },
  { pattern: /^自动同步失败: (.+)$/, replace: (message) => `Automatic sync failed: ${message}` },
  { pattern: /^检查更新失败: (.+)$/, replace: (message) => `Failed to check for updates: ${message}` },
  { pattern: /^下载更新失败: (.+)$/, replace: (message) => `Failed to download update: ${message}` },
  { pattern: /^自动更新失败: (.+)$/, replace: (message) => `Automatic update failed: ${message}` },
  { pattern: /^\[标题\] (.+)$/, replace: (title) => `[Title] ${title}` }
];
function normalizeLanguage(value) {
  return value === "en-US" || value === "en" ? "en-US" : "zh-CN";
}
function translate(language, source, params = {}) {
  let template = source;
  if (language === "en-US") {
    template = EN_TRANSLATIONS[source] ?? source;
    if (template === source) {
      for (const entry of EN_PATTERN_TRANSLATIONS) {
        const match = entry.pattern.exec(source);
        if (match) {
          template = entry.replace(...match.slice(1));
          break;
        }
      }
    }
  }
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
}
const CONFIG_PATH = path.join(os.homedir(), ".ark-note-config.json");
const DEFAULT_DATA_DIR = path.join(os.homedir(), ".ark-note");
const LEGACY_BRAND_SLUG = globalThis.atob("enotbm90ZQ==");
const LEGACY_CONFIG_PATH = path.join(os.homedir(), `.${LEGACY_BRAND_SLUG}-config.json`);
const LEGACY_DEFAULT_DATA_DIR = path.join(os.homedir(), `.${LEGACY_BRAND_SLUG}`);
class AppConfig {
  constructor() {
    __publicField(this, "config");
    this.config = this.load();
    if (!fs.existsSync(CONFIG_PATH)) {
      this.save();
    }
  }
  /**
   * Load config from disk, or create default
   */
  load() {
    const existingDefaultDataDir = !fs.existsSync(DEFAULT_DATA_DIR) && fs.existsSync(LEGACY_DEFAULT_DATA_DIR) ? LEGACY_DEFAULT_DATA_DIR : DEFAULT_DATA_DIR;
    try {
      const configPath = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : fs.existsSync(LEGACY_CONFIG_PATH) ? LEGACY_CONFIG_PATH : null;
      const fallbackDataDir = configPath === LEGACY_CONFIG_PATH ? LEGACY_DEFAULT_DATA_DIR : existingDefaultDataDir;
      if (configPath) {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(content);
        return {
          dataDir: parsed.dataDir || fallbackDataDir,
          windowBounds: parsed.windowBounds,
          closeAction: parsed.closeAction || "ask",
          theme: parsed.theme || "dark",
          language: normalizeLanguage(parsed.language),
          sidebarWidth: this.clampSidebarWidth(parsed.sidebarWidth),
          autoLockMinutes: this.clampAutoLockMinutes(parsed.autoLockMinutes),
          lockOnMinimize: parsed.lockOnMinimize !== false,
          authThrottle: this.sanitizeAuthThrottle(parsed.authThrottle)
        };
      }
    } catch (error) {
      console.error("Failed to load app config:", error);
    }
    return {
      dataDir: existingDefaultDataDir,
      closeAction: "ask",
      theme: "dark",
      language: "zh-CN",
      sidebarWidth: 15,
      autoLockMinutes: 15,
      lockOnMinimize: true,
      authThrottle: {}
    };
  }
  clampSidebarWidth(width) {
    return typeof width === "number" && Number.isFinite(width) ? Math.min(40, Math.max(10, width)) : 15;
  }
  clampAutoLockMinutes(minutes) {
    if (typeof minutes !== "number" || !Number.isFinite(minutes)) return 15;
    if (minutes <= 0) return 0;
    return Math.min(240, Math.max(1, Math.round(minutes)));
  }
  sanitizeAuthThrottle(value) {
    if (!value || typeof value !== "object") return {};
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!/^[a-f0-9]{64}$/.test(key) || !entry || typeof entry !== "object") continue;
      const candidate = entry;
      if (typeof candidate.failedAttempts !== "number" || typeof candidate.nextAllowedAt !== "number" || typeof candidate.lastFailureAt !== "number") continue;
      result[key] = {
        failedAttempts: Math.max(0, Math.floor(candidate.failedAttempts)),
        nextAllowedAt: Math.max(0, candidate.nextAllowedAt),
        lastFailureAt: Math.max(0, candidate.lastFailureAt)
      };
    }
    return result;
  }
  /**
   * Save config to disk
   */
  save() {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to save app config:", error);
    }
  }
  /**
   * Get the data directory path
   */
  getDataDir() {
    return this.config.dataDir;
  }
  /**
   * Set the data directory path.
   * Does NOT move existing data - caller must handle migration.
   */
  setDataDir(newDir) {
    this.config.dataDir = newDir;
    this.save();
  }
  /**
   * Get window bounds
   */
  getWindowBounds() {
    return this.config.windowBounds;
  }
  /**
   * Save window bounds
   */
  setWindowBounds(bounds) {
    this.config.windowBounds = bounds;
    this.save();
  }
  /**
   * Get close action preference
   */
  getCloseAction() {
    return this.config.closeAction;
  }
  /**
   * Set close action preference
   */
  setCloseAction(action) {
    this.config.closeAction = action;
    this.save();
  }
  /**
   * Get theme
   */
  getTheme() {
    return this.config.theme;
  }
  /**
   * Set theme
   */
  setTheme(theme) {
    this.config.theme = theme;
    this.save();
  }
  getLanguage() {
    return this.config.language;
  }
  setLanguage(language) {
    this.config.language = normalizeLanguage(language);
    this.save();
  }
  getSidebarWidth() {
    return this.config.sidebarWidth;
  }
  setSidebarWidth(width) {
    this.config.sidebarWidth = this.clampSidebarWidth(width);
    this.save();
  }
  getSecurityConfig() {
    return {
      autoLockMinutes: this.config.autoLockMinutes,
      lockOnMinimize: this.config.lockOnMinimize
    };
  }
  setSecurityConfig(config) {
    this.config.autoLockMinutes = this.clampAutoLockMinutes(config.autoLockMinutes);
    this.config.lockOnMinimize = Boolean(config.lockOnMinimize);
    this.save();
    return this.getSecurityConfig();
  }
  getAuthThrottle(key) {
    return this.config.authThrottle[key] ? { ...this.config.authThrottle[key] } : null;
  }
  setAuthThrottle(key, state) {
    this.config.authThrottle[key] = { ...state };
    this.save();
  }
  clearAuthThrottle(key) {
    if (!this.config.authThrottle[key]) return;
    delete this.config.authThrottle[key];
    this.save();
  }
  /**
   * Get the full config
   */
  getAll() {
    return { ...this.config };
  }
  /**
   * Get the config file path (for display to user)
   */
  static getConfigPath() {
    return CONFIG_PATH;
  }
  /**
   * Get the default data directory
   */
  static getDefaultDataDir() {
    return DEFAULT_DATA_DIR;
  }
  inspectDataDir(dir) {
    if (path.resolve(dir) === path.resolve(this.config.dataDir)) {
      return { mode: "current", message: "当前正在使用此数据目录，不会执行迁移或切换。" };
    }
    if (fs.existsSync(path.join(dir, "salt.bin"))) {
      return { mode: "switch", message: "检测到已有 arkNote 数据仓库：应用后只会切换到此目录，不会迁移或覆盖当前数据。" };
    }
    return { mode: "migrate", message: "未检测到已有 arkNote 数据仓库：应用后会把当前数据迁移到此目录。" };
  }
  /**
   * Move/copy data from old directory to new directory.
   * Returns true on success, false on failure.
   */
  async migrateData(oldDir, newDir) {
    try {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }
      const entries = fs.readdirSync(newDir);
      const hasExistingVault = entries.includes("salt.bin");
      if (hasExistingVault) {
        this.setDataDir(newDir);
        return {
          success: true,
          message: "已切换到已有的数据仓库"
        };
      }
      if (fs.existsSync(oldDir)) {
        this.copyDirRecursive(oldDir, newDir);
      }
      this.setDataDir(newDir);
      return {
        success: true,
        message: "数据已迁移到新目录"
      };
    } catch (error) {
      return {
        success: false,
        message: `迁移失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  /**
   * Recursively copy directory contents
   */
  copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 6e5;
const DIGEST = "sha512";
const VERIFY_TEXT = "ARK-NOTE-VERIFY";
const LEGACY_VERIFY_TEXT = globalThis.atob("WlotTk9URS1WRVJJRlk=");
const PASSWORD_CHANGE_DIR = ".password-change";
class VaultIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = "VaultIntegrityError";
  }
}
class EncryptionService {
  constructor(dataDir) {
    __publicField(this, "key", null);
    __publicField(this, "salt", null);
    __publicField(this, "dataDir");
    __publicField(this, "passwordChangeInProgress", false);
    this.dataDir = dataDir;
  }
  /**
   * Initialize encryption with user password.
   * On first use, generates salt and stores it.
   * On subsequent uses, reads existing salt.
   */
  async unlock(password) {
    try {
      this.recoverIncompletePasswordChange();
      const saltPath = path.join(this.dataDir, "salt.bin");
      const verifyPath = path.join(this.dataDir, "verify.enc");
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      let isFirstTime = false;
      if (fs.existsSync(saltPath)) {
        this.salt = fs.readFileSync(saltPath);
        if (this.salt.length !== SALT_LENGTH) {
          throw new VaultIntegrityError("密码盐文件已损坏，请从备份恢复 salt.bin");
        }
      } else {
        if (this.hasExistingVaultData()) {
          throw new VaultIntegrityError("检测到加密数据但缺少 salt.bin，请从备份恢复后再解锁");
        }
        this.salt = crypto.randomBytes(SALT_LENGTH);
        this.writeFileAtomic(saltPath, this.salt);
        isFirstTime = true;
      }
      this.key = await this.deriveKey(password, this.salt);
      if (isFirstTime) {
        const verifyData = this.encrypt(Buffer.from(VERIFY_TEXT));
        this.writeFileAtomic(verifyPath, verifyData);
        return true;
      } else {
        if (!fs.existsSync(verifyPath)) {
          this.clearKey();
          throw new VaultIntegrityError("密码验证文件缺失，请从备份恢复 verify.enc");
        }
        try {
          const verifyEnc = fs.readFileSync(verifyPath);
          if (verifyEnc.length < IV_LENGTH + TAG_LENGTH + 1) {
            throw new VaultIntegrityError("密码验证文件已损坏，请从备份恢复 verify.enc");
          }
          const decrypted = this.decrypt(verifyEnc);
          const verifyText = decrypted.toString("utf-8");
          const matches = this.isSupportedVerifyText(verifyText);
          decrypted.fill(0);
          if (!matches) this.clearKey();
          if (matches && verifyText !== VERIFY_TEXT) {
            this.writeFileAtomic(verifyPath, this.encrypt(Buffer.from(VERIFY_TEXT)));
          }
          return matches;
        } catch (error) {
          this.clearKey();
          if (error instanceof VaultIntegrityError) throw error;
          return false;
        }
      }
    } catch (error) {
      this.clearKey();
      throw error;
    }
  }
  /**
   * Check if this is first time setup (no salt file)
   */
  isFirstTime() {
    const saltPath = path.join(this.dataDir, "salt.bin");
    return !fs.existsSync(saltPath) && !this.hasExistingVaultData();
  }
  /**
   * Lock the vault - clear the encryption key from memory
   */
  lock() {
    this.clearKey();
  }
  /**
   * Check if the vault is locked
   */
  isLocked() {
    return this.key === null;
  }
  /**
   * Change password - re-derive key and update verification
   */
  async changePassword(oldPassword, newPassword) {
    if (this.passwordChangeInProgress || !this.salt || !this.key) return false;
    this.passwordChangeInProgress = true;
    const originalKey = this.key;
    const originalSalt = this.salt;
    let oldKey = null;
    let newKey = null;
    try {
      this.recoverIncompletePasswordChange();
      oldKey = await this.deriveKey(oldPassword, originalSalt);
      const verifyPath = path.join(this.dataDir, "verify.enc");
      const verifyEnc = fs.readFileSync(verifyPath);
      const decrypted = this.decryptWithKey(verifyEnc, oldKey);
      const matches = this.isSupportedVerifyText(decrypted.toString("utf-8"));
      decrypted.fill(0);
      if (!matches) {
        return false;
      }
      const newSalt = crypto.randomBytes(SALT_LENGTH);
      newKey = await this.deriveKey(newPassword, newSalt);
      this.reEncryptAllFilesTransactionally(oldKey, newSalt, newKey);
      this.salt = newSalt;
      this.key = newKey;
      newKey = null;
      originalKey.fill(0);
      return true;
    } catch (error) {
      try {
        this.recoverIncompletePasswordChange();
      } catch (recoveryError) {
        console.error("Password change recovery failed:", recoveryError);
      }
      this.key = originalKey;
      this.salt = originalSalt;
      console.error("Password change failed:", error);
      return false;
    } finally {
      oldKey == null ? void 0 : oldKey.fill(0);
      newKey == null ? void 0 : newKey.fill(0);
      this.passwordChangeInProgress = false;
    }
  }
  /**
   * Encrypt data
   * Format: [IV (12 bytes)][Auth Tag (16 bytes)][Encrypted Data]
   */
  encrypt(data) {
    if (!this.key) throw new Error("Vault is locked");
    return this.encryptWithKey(data, this.key);
  }
  /**
   * Decrypt data
   */
  decrypt(data) {
    if (!this.key) throw new Error("Vault is locked");
    return this.decryptWithKey(data, this.key);
  }
  /**
   * Encrypt string to buffer
   */
  encryptString(text) {
    return this.encrypt(Buffer.from(text, "utf-8"));
  }
  /**
   * Decrypt buffer to string
   */
  decryptString(data) {
    return this.decrypt(data).toString("utf-8");
  }
  /**
   * Encrypt and write file
   */
  encryptFile(filePath, data) {
    const encrypted = this.encrypt(data);
    this.writeFileAtomic(filePath, encrypted);
  }
  /**
   * Read and decrypt file
   */
  decryptFile(filePath) {
    const encrypted = fs.readFileSync(filePath);
    return this.decrypt(encrypted);
  }
  /**
   * Encrypt string and write to file
   */
  encryptStringToFile(filePath, text) {
    this.encryptFile(filePath, Buffer.from(text, "utf-8"));
  }
  /**
   * Read file and decrypt to string
   */
  decryptFileToString(filePath) {
    return this.decryptFile(filePath).toString("utf-8");
  }
  /**
   * Derive encryption key from password and salt using PBKDF2
   */
  deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }
  clearKey() {
    if (!this.key) return;
    this.key.fill(0);
    this.key = null;
  }
  isSupportedVerifyText(value) {
    return value === VERIFY_TEXT || value === LEGACY_VERIFY_TEXT;
  }
  hasExistingVaultData() {
    const files = ["verify.enc", "metadata.json.enc"];
    if (files.some((file) => fs.existsSync(path.join(this.dataDir, file)))) return true;
    return ["notes", "images", "versions", "trash"].some((directory) => {
      const fullPath = path.join(this.dataDir, directory);
      return fs.existsSync(fullPath) && fs.readdirSync(fullPath).length > 0;
    });
  }
  encryptWithKey(data, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }
  decryptWithKey(data, key) {
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
  reEncryptAllFilesTransactionally(oldKey, newSalt, newKey) {
    const txnDir = this.passwordChangeDir;
    const backupDir = path.join(txnDir, "backup");
    const stagedDir = path.join(txnDir, "staged");
    this.removeDirIfExists(txnDir);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(stagedDir, { recursive: true });
    const files = this.collectEncryptedVaultFiles();
    const manifest = {
      id: crypto.randomUUID(),
      state: "preparing",
      files
    };
    this.writeManifest(manifest);
    this.backupPasswordChangeFiles(backupDir, files);
    manifest.state = "staging";
    this.writeManifest(manifest);
    this.stageReEncryptedFiles(stagedDir, files, oldKey, newSalt, newKey);
    this.validateStagedFiles(stagedDir, files, newKey);
    manifest.state = "committing";
    this.writeManifest(manifest);
    this.commitStagedFiles(stagedDir, files);
    this.removeDirIfExists(txnDir);
  }
  recoverIncompletePasswordChange() {
    const txnDir = this.passwordChangeDir;
    const manifestPath = path.join(txnDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return;
    const backupDir = path.join(txnDir, "backup");
    if (fs.existsSync(backupDir)) {
      const manifest = this.readManifest(manifestPath);
      const files = (manifest == null ? void 0 : manifest.files) ?? this.collectBackupEncryptedFiles(backupDir);
      for (const relPath of files) {
        const backupPath = this.resolveInBase(backupDir, relPath);
        if (fs.existsSync(backupPath)) {
          this.copyFileEnsuringDir(backupPath, this.resolveInDataDir(relPath));
        }
      }
      for (const fileName of ["salt.bin", "verify.enc"]) {
        const backupPath = path.join(backupDir, fileName);
        if (fs.existsSync(backupPath)) {
          this.copyFileEnsuringDir(backupPath, path.join(this.dataDir, fileName));
        }
      }
    }
    this.removeDirIfExists(txnDir);
  }
  backupPasswordChangeFiles(backupDir, files) {
    for (const relPath of files) {
      const sourcePath = this.resolveInDataDir(relPath);
      if (fs.existsSync(sourcePath)) {
        this.copyFileEnsuringDir(sourcePath, this.resolveInBase(backupDir, relPath));
      }
    }
    for (const fileName of ["salt.bin", "verify.enc"]) {
      const sourcePath = path.join(this.dataDir, fileName);
      if (fs.existsSync(sourcePath)) {
        this.copyFileEnsuringDir(sourcePath, path.join(backupDir, fileName));
      }
    }
  }
  stageReEncryptedFiles(stagedDir, files, oldKey, newSalt, newKey) {
    for (const relPath of files) {
      const encrypted = fs.readFileSync(this.resolveInDataDir(relPath));
      const decrypted = this.decryptWithKey(encrypted, oldKey);
      try {
        this.writeFileAtomic(this.resolveInBase(stagedDir, relPath), this.encryptWithKey(decrypted, newKey));
      } finally {
        decrypted.fill(0);
      }
    }
    this.writeFileAtomic(path.join(stagedDir, "salt.bin"), newSalt);
    this.writeFileAtomic(path.join(stagedDir, "verify.enc"), this.encryptWithKey(Buffer.from(VERIFY_TEXT), newKey));
  }
  validateStagedFiles(stagedDir, files, newKey) {
    const verify = this.decryptWithKey(fs.readFileSync(path.join(stagedDir, "verify.enc")), newKey);
    const verifyMatches = verify.toString("utf-8") === VERIFY_TEXT;
    verify.fill(0);
    if (!verifyMatches) {
      throw new Error("Staged verification file is invalid");
    }
    for (const relPath of files) {
      const decrypted = this.decryptWithKey(fs.readFileSync(this.resolveInBase(stagedDir, relPath)), newKey);
      decrypted.fill(0);
    }
  }
  commitStagedFiles(stagedDir, files) {
    for (const relPath of files) {
      this.copyFileEnsuringDir(this.resolveInBase(stagedDir, relPath), this.resolveInDataDir(relPath));
    }
    for (const fileName of ["salt.bin", "verify.enc"]) {
      this.copyFileEnsuringDir(path.join(stagedDir, fileName), path.join(this.dataDir, fileName));
    }
  }
  collectEncryptedVaultFiles() {
    const files = [];
    const metadataPath = path.join(this.dataDir, "metadata.json.enc");
    if (fs.existsSync(metadataPath)) {
      files.push("metadata.json.enc");
    }
    for (const rootName of ["notes", "images", "versions", "trash"]) {
      this.collectEncryptedFilesInDir(path.join(this.dataDir, rootName), files);
    }
    return files.sort();
  }
  collectBackupEncryptedFiles(backupDir) {
    const files = [];
    this.collectEncryptedFilesInDir(backupDir, files, backupDir);
    return files.filter((file) => file !== "verify.enc").sort();
  }
  collectEncryptedFilesInDir(dirPath, files, baseDir = this.dataDir) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === PASSWORD_CHANGE_DIR) continue;
        this.collectEncryptedFilesInDir(fullPath, files, baseDir);
      } else if (entry.name.endsWith(".enc")) {
        files.push(this.toRelativeVaultPath(fullPath, baseDir));
      }
    }
  }
  writeManifest(manifest) {
    this.writeFileAtomic(path.join(this.passwordChangeDir, "manifest.json"), Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
  }
  readManifest(manifestPath) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {
      return null;
    }
  }
  writeFileAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
    const fd = fs.openSync(tempPath, "w");
    try {
      fs.writeFileSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, filePath);
  }
  copyFileEnsuringDir(src, dest) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = fs.readFileSync(src);
    this.writeFileAtomic(dest, data);
  }
  removeDirIfExists(dir) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  resolveInDataDir(relPath) {
    return this.resolveInBase(this.dataDir, relPath);
  }
  resolveInBase(baseDir, relPath) {
    const resolved = path.resolve(baseDir, ...relPath.split("/"));
    const base = path.resolve(baseDir);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Invalid vault path: ${relPath}`);
    }
    return resolved;
  }
  toRelativeVaultPath(filePath, baseDir = this.dataDir) {
    return path.relative(baseDir, filePath).split(path.sep).join("/");
  }
  get passwordChangeDir() {
    return path.join(this.dataDir, PASSWORD_CHANGE_DIR);
  }
}
const MAX_NOTE_CONTENT_CACHE = 100;
class FileManager {
  constructor(dataDir, encryption) {
    __publicField(this, "encryption");
    __publicField(this, "dataDir");
    __publicField(this, "metadata", null);
    __publicField(this, "noteContentCache", /* @__PURE__ */ new Map());
    __publicField(this, "noteContentCacheOrder", []);
    __publicField(this, "imageFileCache", null);
    this.dataDir = dataDir;
    this.encryption = encryption;
  }
  // ========== Directory Paths ==========
  get notesDir() {
    return path.join(this.dataDir, "notes");
  }
  get imagesDir() {
    return path.join(this.dataDir, "images");
  }
  get versionsDir() {
    return path.join(this.dataDir, "versions");
  }
  get metadataPath() {
    return path.join(this.dataDir, "metadata.json.enc");
  }
  // ========== Initialization ==========
  ensureDirectories() {
    const dirs = [this.notesDir, this.imagesDir, this.versionsDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
  // ========== Metadata Operations ==========
  loadMetadata() {
    if (this.metadata) return this.metadata;
    if (fs.existsSync(this.metadataPath)) {
      const content = this.encryption.decryptFileToString(this.metadataPath);
      this.metadata = JSON.parse(content);
    } else {
      this.metadata = this.createDefaultMetadata();
      this.saveMetadata();
    }
    return this.metadata;
  }
  saveMetadata() {
    if (!this.metadata) return;
    this.encryption.encryptStringToFile(
      this.metadataPath,
      JSON.stringify(this.metadata, null, 2)
    );
  }
  getMetadata() {
    if (!this.metadata) {
      return this.loadMetadata();
    }
    return this.metadata;
  }
  createDefaultMetadata() {
    return {
      directories: [],
      notes: [],
      tags: [],
      syncConfig: {
        enabled: false,
        provider: "git",
        repoUrl: "",
        branch: "main",
        ossEndpoint: "",
        ossBucket: "",
        ossAccessKey: "",
        ossSecretKey: "",
        ossRegion: "",
        autoSync: false,
        syncInterval: 30
      }
    };
  }
  // ========== Note File Operations ==========
  getNotePath(noteId) {
    return path.join(this.notesDir, `${noteId}.md.enc`);
  }
  readNoteContent(noteId) {
    const cached = this.noteContentCache.get(noteId);
    if (cached !== void 0) {
      const idx = this.noteContentCacheOrder.indexOf(noteId);
      if (idx >= 0) {
        this.noteContentCacheOrder.splice(idx, 1);
        this.noteContentCacheOrder.push(noteId);
      }
      return cached;
    }
    const filePath = this.getNotePath(noteId);
    if (!fs.existsSync(filePath)) {
      this.noteContentCache.delete(noteId);
      const idx = this.noteContentCacheOrder.indexOf(noteId);
      if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1);
      return "";
    }
    if (this.noteContentCacheOrder.length >= MAX_NOTE_CONTENT_CACHE) {
      const oldest = this.noteContentCacheOrder.shift();
      this.noteContentCache.delete(oldest);
    }
    const content = this.encryption.decryptFileToString(filePath);
    this.noteContentCache.set(noteId, content);
    this.noteContentCacheOrder.push(noteId);
    return content;
  }
  writeNoteContent(noteId, content) {
    this.encryption.encryptStringToFile(this.getNotePath(noteId), content);
    if (!this.noteContentCache.has(noteId) && this.noteContentCacheOrder.length >= MAX_NOTE_CONTENT_CACHE) {
      const oldest = this.noteContentCacheOrder.shift();
      this.noteContentCache.delete(oldest);
    }
    this.noteContentCache.set(noteId, content);
    const idx = this.noteContentCacheOrder.indexOf(noteId);
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1);
    this.noteContentCacheOrder.push(noteId);
  }
  deleteNoteFile(noteId) {
    this.noteContentCache.delete(noteId);
    const idx = this.noteContentCacheOrder.indexOf(noteId);
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1);
    const filePath = this.getNotePath(noteId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const versionDir = path.join(this.versionsDir, noteId);
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true });
    }
  }
  // ========== Image Operations ==========
  getImageFileMap() {
    if (this.imageFileCache) return this.imageFileCache;
    this.imageFileCache = /* @__PURE__ */ new Map();
    if (!fs.existsSync(this.imagesDir)) return this.imageFileCache;
    const files = fs.readdirSync(this.imagesDir);
    for (const f of files) {
      if (!f.endsWith(".enc")) continue;
      const dotIdx = f.lastIndexOf(".");
      const baseName = dotIdx > 0 ? f.substring(0, dotIdx) : f;
      const uuidMatch = baseName.match(/^([a-f0-9-]{36})/);
      if (uuidMatch) {
        this.imageFileCache.set(uuidMatch[1], f);
      }
    }
    return this.imageFileCache;
  }
  invalidateImageCache() {
    this.imageFileCache = null;
  }
  saveImage(imageData, extension) {
    const imageId = crypto.randomUUID();
    const imagePath = path.join(this.imagesDir, `${imageId}${extension}.enc`);
    this.encryption.encryptFile(imagePath, imageData);
    this.invalidateImageCache();
    return imageId;
  }
  readImage(imageId) {
    const imageFile = this.getImageFileMap().get(imageId);
    if (!imageFile) return null;
    const imagePath = path.join(this.imagesDir, imageFile);
    return this.encryption.decryptFile(imagePath);
  }
  getImageMimeType(imageId) {
    const imageFile = this.getImageFileMap().get(imageId);
    if (!imageFile) return "image/png";
    const ext = imageFile.replace(imageId, "").replace(/\.enc$/, "").toLowerCase();
    const mimeMap = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp"
    };
    return mimeMap[ext] || "image/png";
  }
  deleteImage(imageId) {
    const imageFile = this.getImageFileMap().get(imageId);
    if (imageFile) {
      fs.unlinkSync(path.join(this.imagesDir, imageFile));
      this.invalidateImageCache();
    }
  }
  // ========== Version Operations ==========
  getVersionDir(noteId) {
    return path.join(this.versionsDir, noteId);
  }
  saveVersion(noteId, content, isManual) {
    const versionDir = this.getVersionDir(noteId);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const prefix = isManual ? "manual" : "auto";
    const fileName = `${prefix}_${timestamp}.md.enc`;
    this.encryption.encryptStringToFile(path.join(versionDir, fileName), content);
  }
  listVersions(noteId) {
    const versionDir = this.getVersionDir(noteId);
    if (!fs.existsSync(versionDir)) return [];
    const files = fs.readdirSync(versionDir).filter((f) => f.endsWith(".md.enc")).sort().reverse();
    return files.map((f) => {
      const isManual = f.startsWith("manual_");
      f.replace(/^(manual|auto)_/, "").replace(".md.enc", "").replace(/-/g, (m, offset) => {
        if (offset <= 7) return "-";
        if (offset === 10) return "T";
        return ":";
      });
      return {
        timestamp: f.replace(/^(manual|auto)_/, "").replace(".md.enc", ""),
        isManual,
        fileName: f
      };
    });
  }
  readVersion(noteId, fileName) {
    const filePath = path.join(this.getVersionDir(noteId), fileName);
    return this.encryption.decryptFileToString(filePath);
  }
  // ========== Directory & Note Metadata Operations ==========
  addDirectory(dir) {
    const meta = this.getMetadata();
    meta.directories.push(dir);
    this.saveMetadata();
  }
  updateDirectory(id, updates) {
    const meta = this.getMetadata();
    const idx = meta.directories.findIndex((d) => d.id === id);
    if (idx !== -1) {
      meta.directories[idx] = { ...meta.directories[idx], ...updates };
      this.saveMetadata();
    }
  }
  removeDirectory(id) {
    const meta = this.getMetadata();
    meta.directories = meta.directories.filter((d) => d.id !== id);
    this.saveMetadata();
  }
  addNote(note) {
    const meta = this.getMetadata();
    meta.notes.push(note);
    this.saveMetadata();
  }
  updateNote(id, updates) {
    const meta = this.getMetadata();
    const idx = meta.notes.findIndex((n) => n.id === id);
    if (idx !== -1) {
      meta.notes[idx] = { ...meta.notes[idx], ...updates };
      this.saveMetadata();
    }
  }
  removeNote(id) {
    const meta = this.getMetadata();
    meta.notes = meta.notes.filter((n) => n.id !== id);
    this.noteContentCache.delete(id);
    const idx = this.noteContentCacheOrder.indexOf(id);
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1);
    this.saveMetadata();
  }
  addTag(tag) {
    const meta = this.getMetadata();
    meta.tags.push(tag);
    this.saveMetadata();
  }
  removeTag(id) {
    const meta = this.getMetadata();
    meta.tags = meta.tags.filter((t) => t.id !== id);
    meta.notes.forEach((note) => {
      note.tags = note.tags.filter((t) => t !== id);
    });
    this.saveMetadata();
  }
  updateSyncConfig(config) {
    const meta = this.getMetadata();
    meta.syncConfig = { ...meta.syncConfig, ...config };
    this.saveMetadata();
  }
  // ========== Utility ==========
  generateId() {
    return crypto.randomUUID();
  }
  clearCache() {
    this.metadata = null;
    this.noteContentCache.clear();
    this.noteContentCacheOrder.length = 0;
    this.imageFileCache = null;
  }
}
class NoteService {
  // 30 minutes
  constructor(fileManager) {
    __publicField(this, "fileManager");
    __publicField(this, "autoSaveTimers", /* @__PURE__ */ new Map());
    __publicField(this, "lastVersionTime", /* @__PURE__ */ new Map());
    __publicField(this, "noteModified", /* @__PURE__ */ new Map());
    __publicField(this, "VERSION_INTERVAL", 30 * 60 * 1e3);
    this.fileManager = fileManager;
  }
  list() {
    const meta = this.fileManager.getMetadata();
    return meta.notes;
  }
  get(id) {
    const meta = this.fileManager.getMetadata();
    const noteMeta = meta.notes.find((n) => n.id === id);
    if (!noteMeta) throw new Error(`Note not found: ${id}`);
    const content = this.fileManager.readNoteContent(id);
    return { id, content, metadata: noteMeta };
  }
  create(directoryId, title) {
    const id = this.fileManager.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const note = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.list().filter((n) => n.directoryId === directoryId).length
    };
    this.fileManager.addNote(note);
    this.fileManager.writeNoteContent(id, `# ${title}

`);
    return note;
  }
  update(id, content) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.fileManager.writeNoteContent(id, content);
    this.fileManager.updateNote(id, { updatedAt: now });
    this.noteModified.set(id, true);
    this.scheduleAutoVersion(id, content);
  }
  updateTitle(id, title) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.fileManager.updateNote(id, { title, updatedAt: now });
  }
  delete(id) {
    this.fileManager.deleteNoteFile(id);
    this.fileManager.removeNote(id);
    this.clearTimers(id);
  }
  move(id, targetDirectoryId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const order = this.list().filter((n) => n.directoryId === targetDirectoryId).length;
    this.fileManager.updateNote(id, {
      directoryId: targetDirectoryId,
      updatedAt: now,
      order
    });
  }
  /**
   * Manual version save (Ctrl+S)
   */
  saveVersion(id) {
    const content = this.fileManager.readNoteContent(id);
    this.fileManager.saveVersion(id, content, true);
    this.lastVersionTime.set(id, Date.now());
    this.noteModified.set(id, false);
  }
  /**
   * Schedule auto-version check.
   * If 30 minutes pass without modification, save a version.
   */
  scheduleAutoVersion(noteId, content) {
    const existingTimer = this.autoSaveTimers.get(noteId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      if (this.noteModified.get(noteId)) {
        const lastVersion = this.lastVersionTime.get(noteId) || 0;
        const elapsed = Date.now() - lastVersion;
        if (elapsed >= this.VERSION_INTERVAL) {
          this.fileManager.saveVersion(noteId, content, false);
          this.lastVersionTime.set(noteId, Date.now());
          this.noteModified.set(noteId, false);
        }
      }
      this.autoSaveTimers.delete(noteId);
    }, this.VERSION_INTERVAL);
    this.autoSaveTimers.set(noteId, timer);
  }
  clearTimers(noteId) {
    const timer = this.autoSaveTimers.get(noteId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(noteId);
    }
    this.lastVersionTime.delete(noteId);
    this.noteModified.delete(noteId);
  }
  /**
   * Cleanup all timers on app close
   */
  cleanup() {
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSaveTimers.clear();
    this.lastVersionTime.clear();
    this.noteModified.clear();
  }
}
class DirectoryService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    this.fileManager = fileManager;
  }
  list() {
    const meta = this.fileManager.getMetadata();
    return meta.directories;
  }
  create(parentId, name) {
    const level = this.getLevel(parentId);
    if (level >= 3) {
      throw new Error("目录层级最多为3级");
    }
    const id = this.fileManager.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const meta = this.fileManager.getMetadata();
    const dir = {
      id,
      name,
      parentId,
      order: meta.directories.filter((d) => d.parentId === parentId).length,
      createdAt: now,
      updatedAt: now
    };
    this.fileManager.addDirectory(dir);
    return dir;
  }
  rename(id, name) {
    this.fileManager.updateDirectory(id, {
      name,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  delete(id) {
    const meta = this.fileManager.getMetadata();
    const subDirs = meta.directories.filter((d) => d.parentId === id);
    if (subDirs.length > 0) {
      for (const subDir of subDirs) {
        this.delete(subDir.id);
      }
    }
    const notes = meta.notes.filter((n) => n.directoryId === id);
    for (const note of notes) {
      this.fileManager.deleteNoteFile(note.id);
      this.fileManager.removeNote(note.id);
    }
    this.fileManager.removeDirectory(id);
    return true;
  }
  /**
   * Get the depth level of a directory.
   * Root level is 0, so creating under root makes level 1, etc.
   */
  getLevel(parentId) {
    if (parentId === null) return 0;
    const meta = this.fileManager.getMetadata();
    let level = 0;
    let currentId = parentId;
    while (currentId) {
      level++;
      const dir = meta.directories.find((d) => d.id === currentId);
      if (!dir) break;
      currentId = dir.parentId;
    }
    return level;
  }
  /**
   * Get the level of a specific directory by its ID
   */
  getLevelById(id) {
    const meta = this.fileManager.getMetadata();
    const dir = meta.directories.find((d) => d.id === id);
    if (!dir) return 0;
    return this.getLevel(dir.parentId) + 1;
  }
  /**
   * Get all descendant directory IDs recursively
   */
  getDescendantIds(id) {
    const meta = this.fileManager.getMetadata();
    const result = [];
    const collect = (parentId) => {
      const children = meta.directories.filter((d) => d.parentId === parentId);
      for (const child of children) {
        result.push(child.id);
        collect(child.id);
      }
    };
    collect(id);
    return result;
  }
  /**
   * Get the full path of a directory as an array of names
   */
  getPath(id) {
    const meta = this.fileManager.getMetadata();
    const parts = [];
    let currentId = id;
    while (currentId) {
      const dir = meta.directories.find((d) => d.id === currentId);
      if (!dir) break;
      parts.unshift(dir.name);
      currentId = dir.parentId;
    }
    return parts;
  }
}
class TagService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    this.fileManager = fileManager;
  }
  list() {
    const meta = this.fileManager.getMetadata();
    return meta.tags;
  }
  create(name, color) {
    const meta = this.fileManager.getMetadata();
    if (meta.tags.some((t) => t.name === name)) {
      throw new Error(`Tag already exists: ${name}`);
    }
    const tag = {
      id: this.fileManager.generateId(),
      name,
      color,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.fileManager.addTag(tag);
    return tag;
  }
  delete(id) {
    const meta = this.fileManager.getMetadata();
    const associatedNotes = meta.notes.filter((n) => n.tags.includes(id));
    if (associatedNotes.length > 0) {
      return {
        success: false,
        message: `该标签关联了 ${associatedNotes.length} 篇笔记，无法删除。请先移除关联后再删除。`
      };
    }
    this.fileManager.removeTag(id);
    return { success: true, message: "标签已删除" };
  }
  assign(noteId, tagIds) {
    this.fileManager.updateNote(noteId, { tags: tagIds });
  }
  getNotesForTag(tagId) {
    const meta = this.fileManager.getMetadata();
    return meta.notes.filter((n) => n.tags.includes(tagId));
  }
  /**
   * Get note count for each tag
   */
  getTagNoteCounts() {
    const meta = this.fileManager.getMetadata();
    const counts = /* @__PURE__ */ new Map();
    for (const tag of meta.tags) {
      const count = meta.notes.filter((n) => n.tags.includes(tag.id)).length;
      counts.set(tag.id, count);
    }
    return counts;
  }
}
const MANUAL_SAVE_DEDUP_MS = 3e4;
class VersionService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    __publicField(this, "lastManualSaveTime", /* @__PURE__ */ new Map());
    this.fileManager = fileManager;
  }
  list(noteId) {
    const meta = this.fileManager.getMetadata();
    const note = meta.notes.find((n) => n.id === noteId);
    if (!note) return [];
    const versions = this.fileManager.listVersions(noteId);
    return versions.map((v) => ({
      noteId,
      timestamp: v.timestamp,
      title: note.title,
      isManual: v.isManual
    }));
  }
  get(noteId, timestamp) {
    const versions = this.fileManager.listVersions(noteId);
    const version = versions.find((v) => v.timestamp === timestamp);
    if (!version) throw new Error(`Version not found: ${timestamp}`);
    return this.fileManager.readVersion(noteId, version.fileName);
  }
  save(noteId) {
    const now = Date.now();
    const lastSave = this.lastManualSaveTime.get(noteId) || 0;
    if (now - lastSave < MANUAL_SAVE_DEDUP_MS) return;
    const content = this.fileManager.readNoteContent(noteId);
    this.fileManager.saveVersion(noteId, content, true);
    this.lastManualSaveTime.set(noteId, now);
  }
}
const MAX_GLOBAL_MATCHES_PER_NOTE = 3;
const DEFAULT_GLOBAL_TOTAL_LIMIT = 20;
const MAX_SEARCH_CACHE_ENTRIES = 200;
class SearchService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    __publicField(this, "globalSearchCache", /* @__PURE__ */ new Map());
    __publicField(this, "searchCacheOrder", []);
    this.fileManager = fileManager;
  }
  clearCache() {
    this.globalSearchCache.clear();
    this.searchCacheOrder.length = 0;
  }
  removeNote(noteId) {
    this.globalSearchCache.delete(noteId);
    const idx = this.searchCacheOrder.indexOf(noteId);
    if (idx >= 0) this.searchCacheOrder.splice(idx, 1);
  }
  upsertNote(noteId) {
    const meta = this.fileManager.getMetadata();
    const note = meta.notes.find((n) => n.id === noteId);
    if (!note) {
      this.removeNote(noteId);
      return;
    }
    if (!this.globalSearchCache.has(noteId) && this.searchCacheOrder.length >= MAX_SEARCH_CACHE_ENTRIES) {
      const oldest = this.searchCacheOrder.shift();
      this.globalSearchCache.delete(oldest);
    }
    this.globalSearchCache.set(noteId, {
      noteId,
      title: note.title,
      titleLower: note.title.toLowerCase(),
      directoryId: note.directoryId,
      content: this.fileManager.readNoteContent(noteId)
    });
    const idx = this.searchCacheOrder.indexOf(noteId);
    if (idx >= 0) this.searchCacheOrder.splice(idx, 1);
    this.searchCacheOrder.push(noteId);
  }
  /**
   * Global search across all notes or within specified directories
   */
  global(query, directoryIds, totalLimit = DEFAULT_GLOBAL_TOTAL_LIMIT) {
    if (!query.trim()) return [];
    const meta = this.fileManager.getMetadata();
    let notes = meta.notes;
    if (directoryIds && directoryIds.length > 0) {
      const allDirIds = /* @__PURE__ */ new Set();
      const addSubDirs = (dirId) => {
        allDirIds.add(dirId);
        const subDirs = meta.directories.filter((d) => d.parentId === dirId);
        subDirs.forEach((d) => addSubDirs(d.id));
      };
      directoryIds.forEach((id) => addSubDirs(id));
      notes = notes.filter((n) => allDirIds.has(n.directoryId));
    }
    const results = [];
    const lowerQuery = query.toLowerCase();
    for (const note of notes) {
      try {
        const cached = this.getOrCreateCachedEntry(note.id);
        const matches = this.findMatches(cached.content, query, lowerQuery, MAX_GLOBAL_MATCHES_PER_NOTE);
        const titleIdx = cached.titleLower.indexOf(lowerQuery);
        if (titleIdx !== -1) {
          matches.unshift({
            line: 0,
            column: titleIdx,
            length: query.length,
            text: query,
            context: `[标题] ${cached.title}`
          });
        }
        const limitedMatches = matches.slice(0, MAX_GLOBAL_MATCHES_PER_NOTE);
        if (limitedMatches.length > 0) {
          results.push({
            noteId: note.id,
            noteTitle: cached.title,
            directoryId: cached.directoryId,
            directoryPath: this.getDirectoryPath(cached.directoryId),
            matches: limitedMatches
          });
          if (results.length >= totalLimit) {
            break;
          }
        }
      } catch {
        this.globalSearchCache.delete(note.id);
        continue;
      }
    }
    return results;
  }
  /**
   * Search within a specific note.
   * HTML tags, markdown link/image URLs, and mermaid fenced code blocks
   * are stripped before matching so that invisible content is not counted.
   */
  inNote(noteId, query) {
    if (!query.trim()) return [];
    const rawContent = this.fileManager.readNoteContent(noteId);
    let cleaned = rawContent.replace(/```mermaid[\s\S]*?```/g, "");
    cleaned = cleaned.replace(/<[^>]*>/g, "");
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]+\)/g, "$1");
    return this.findMatches(cleaned, query, query.toLowerCase());
  }
  getOrCreateCachedEntry(noteId) {
    const cached = this.globalSearchCache.get(noteId);
    if (cached) {
      return cached;
    }
    this.upsertNote(noteId);
    const refreshed = this.globalSearchCache.get(noteId);
    if (!refreshed) {
      throw new Error(`Search cache entry not found for note: ${noteId}`);
    }
    return refreshed;
  }
  /**
   * Find all matches of query in content
   */
  findMatches(content, query, lowerQuery, limit) {
    const matches = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      let searchStart = 0;
      while (true) {
        const idx = lineLower.indexOf(lowerQuery, searchStart);
        if (idx === -1) break;
        const contextStart = Math.max(0, i - 1);
        const contextEnd = Math.min(lines.length - 1, i + 1);
        const context = lines.slice(contextStart, contextEnd + 1).join("\n");
        matches.push({
          line: i + 1,
          column: idx,
          length: query.length,
          text: line.substring(idx, idx + query.length),
          context
        });
        if (limit && matches.length >= limit) {
          return matches;
        }
        searchStart = idx + 1;
      }
    }
    return matches;
  }
  /**
   * Build the full directory path string
   */
  getDirectoryPath(directoryId) {
    const meta = this.fileManager.getMetadata();
    const parts = [];
    let currentId = directoryId;
    while (currentId) {
      const dir = meta.directories.find((d) => d.id === currentId);
      if (!dir) break;
      parts.unshift(dir.name);
      currentId = dir.parentId;
    }
    return parts.join(" / ") || "根目录";
  }
}
class PdfService {
  /**
   * Export HTML content to PDF using Electron's built-in printToPDF
   */
  async exportToPdf(htmlContent, outputPath) {
    const win = new electron.BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    try {
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-bottom: 0.5em; color: #2a2a2a; }
    h3 { font-size: 1.25em; margin-bottom: 0.5em; color: #3a3a3a; }
    h4, h5, h6 { font-size: 1em; margin-bottom: 0.5em; }
    p { margin-bottom: 1em; }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #4a9eff;
      margin: 1em 0;
      padding: 0.5em 1em;
      background: #f8f9fa;
      color: #555;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; margin-bottom: 1em; }
    li { margin-bottom: 0.3em; }
    a { color: #4a9eff; text-decoration: none; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        margins: {
          marginType: "custom",
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5
        }
      });
      fs.writeFileSync(outputPath, pdfData);
    } finally {
      win.destroy();
    }
  }
}
class SyncService {
  constructor(dataDir, options = {}) {
    __publicField(this, "dataDir");
    __publicField(this, "git", null);
    __publicField(this, "syncInterval", null);
    __publicField(this, "config", null);
    __publicField(this, "conflicts", []);
    __publicField(this, "operationQueue", Promise.resolve());
    __publicField(this, "operationActive", false);
    __publicField(this, "beforeAutoSync");
    __publicField(this, "onDataChanged");
    this.dataDir = dataDir;
    this.beforeAutoSync = options.beforeAutoSync;
    this.onDataChanged = options.onDataChanged;
  }
  getConfig() {
    return this.config;
  }
  async configure(config) {
    this.config = config;
    this.stopAutoSync();
    if (!config.enabled) {
      this.git = null;
      this.conflicts = [];
      return;
    }
    if (config.provider === "git") {
      await this.runExclusive(() => this.configureGit(config));
    }
    if (config.autoSync) {
      this.startAutoSync(config.syncInterval);
    }
  }
  async runExclusive(operation) {
    const previous = this.operationQueue;
    let release;
    this.operationQueue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    this.operationActive = true;
    try {
      return await operation();
    } finally {
      this.operationActive = false;
      release();
    }
  }
  setupSshEnvironment() {
    var _a;
    if (!process.env.GIT_SSH_COMMAND) {
      process.env.GIT_SSH_COMMAND = "ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes";
    }
    if (!process.env.SSH_AUTH_SOCK) {
      const uid = (_a = process.getuid) == null ? void 0 : _a.call(process);
      if (uid !== void 0) {
        const candidates = [
          `/run/user/${uid}/keyring/ssh`,
          `/run/user/${uid}/ssh-agent.socket`
        ];
        for (const sock of candidates) {
          if (fs.existsSync(sock)) {
            process.env.SSH_AUTH_SOCK = sock;
            break;
          }
        }
      }
    }
  }
  async configureGit(config) {
    if (!config.repoUrl) {
      throw new Error("Git 仓库地址不能为空");
    }
    this.setupSshEnvironment();
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.git = simpleGit.simpleGit(this.dataDir);
    if (!fs.existsSync(path.join(this.dataDir, ".git"))) {
      await this.git.init();
    }
    await this.ensureGitIdentity();
    await this.recoverLegacyRebase();
    await this.configureRemote(config.repoUrl);
    const branch = config.branch || "main";
    if (this.isMergeInProgress()) {
      const currentBranch = (await this.git.raw(["branch", "--show-current"])).trim();
      if (currentBranch !== branch) {
        throw new Error(`分支 ${currentBranch} 仍有未完成的 merge，无法切换到 ${branch}`);
      }
    } else {
      await this.ensureLocalBranch(branch);
    }
    await this.refreshConflicts();
  }
  async ensureGitIdentity() {
    if (!this.git) return;
    try {
      await this.git.raw(["config", "--get", "user.name"]);
    } catch {
      await this.git.raw(["config", "user.name", "arkNote Sync"]);
    }
    try {
      await this.git.raw(["config", "--get", "user.email"]);
    } catch {
      await this.git.raw(["config", "user.email", "ark-note@local"]);
    }
  }
  async configureRemote(repoUrl) {
    if (!this.git) return;
    const remotes = await this.git.getRemotes(true);
    const origin = remotes.find((remote) => remote.name === "origin");
    if (origin) {
      if (this.isMergeInProgress() && origin.refs.fetch !== repoUrl) {
        throw new Error("当前仓库仍有未完成的 merge，不能更换远程仓库地址");
      }
      await this.git.remote(["set-url", "origin", repoUrl]);
    } else {
      await this.git.addRemote("origin", repoUrl);
    }
  }
  async ensureLocalBranch(branch) {
    if (!this.git) return;
    const currentBranch = (await this.git.raw(["branch", "--show-current"])).trim();
    if (currentBranch === branch) return;
    const branches = await this.git.branchLocal();
    if (branches.all.includes(branch)) {
      await this.git.checkout(branch);
    } else {
      await this.git.checkoutLocalBranch(branch);
    }
  }
  async sync() {
    const validation = this.validateConfiguration();
    if (validation) return validation;
    return this.runExclusive(() => this.gitSynchronize("manual"));
  }
  validateConfiguration() {
    var _a;
    if (!((_a = this.config) == null ? void 0 : _a.enabled)) {
      return { lastSync: null, status: "error", message: "同步未配置" };
    }
    if (this.config.provider !== "git") {
      return { lastSync: null, status: "error", message: "暂不支持此同步方式" };
    }
    if (!this.git) {
      return { lastSync: null, status: "error", message: "Git 未初始化" };
    }
    return null;
  }
  async gitSynchronize(action) {
    var _a, _b;
    if (!this.git) {
      return { lastSync: null, status: "error", message: "Git 未初始化" };
    }
    const branch = ((_a = this.config) == null ? void 0 : _a.branch) || "main";
    try {
      if (action === "auto" && this.beforeAutoSync && !await this.beforeAutoSync()) {
        return {
          lastSync: null,
          status: "idle",
          message: "自动同步已跳过：当前内容尚未保存"
        };
      }
      const interruptedStatus = await this.finishOrReportInterruptedOperation(action);
      if (interruptedStatus) return interruptedStatus;
      await this.commitLocalChanges(`arkNote ${action} sync: ${(/* @__PURE__ */ new Date()).toISOString()}`);
      const remoteExists = await this.remoteBranchExists(branch);
      if (!remoteExists) {
        await this.pushRemote(branch);
        this.conflicts = [];
        return this.successStatus(action);
      }
      await this.git.fetch("origin", branch, ["--prune"]);
      const mergeResult = await this.mergeRemoteBranch(branch);
      if (mergeResult.conflictStatus) return mergeResult.conflictStatus;
      if (mergeResult.dataChanged) {
        (_b = this.onDataChanged) == null ? void 0 : _b.call(this, action);
      }
      await this.pushRemote(branch);
      this.conflicts = [];
      return this.successStatus(action);
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent();
      if (conflictStatus) return conflictStatus;
      return {
        lastSync: null,
        status: "error",
        message: `${this.actionLabel(action)}失败: ${this.formatError(error)}`
      };
    }
  }
  async commitLocalChanges(message) {
    if (!this.git) return;
    const status = await this.git.status();
    if (status.conflicted.length > 0) {
      throw new Error("仓库仍有未解决的冲突");
    }
    await this.git.add(".");
    const stagedStatus = await this.git.status();
    if (stagedStatus.files.length > 0) {
      await this.git.commit(message);
    }
  }
  async remoteBranchExists(branch) {
    if (!this.git) return false;
    const remoteRefs = await this.git.listRemote(["--heads", "origin", branch]);
    return Boolean(remoteRefs.trim());
  }
  async mergeRemoteBranch(branch) {
    if (!this.git) return { conflictStatus: null, dataChanged: false };
    const remoteRef = `origin/${branch}`;
    const mergeArgs = [remoteRef, "--no-edit", "--allow-unrelated-histories"];
    const headBeforeMerge = (await this.git.revparse("HEAD")).trim();
    try {
      await this.git.raw(["merge", ...mergeArgs]);
      const headAfterMerge = (await this.git.revparse("HEAD")).trim();
      return {
        conflictStatus: null,
        dataChanged: headAfterMerge !== headBeforeMerge
      };
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent();
      if (conflictStatus) {
        return { conflictStatus, dataChanged: false };
      }
      throw error;
    }
  }
  async pushRemote(branch) {
    if (!this.git) return;
    await this.git.raw(["push", "--set-upstream", "origin", `HEAD:${branch}`]);
  }
  async finishOrReportInterruptedOperation(action) {
    var _a;
    if (!this.git) return null;
    if (this.isRebaseInProgress()) {
      await this.recoverLegacyRebase();
    }
    if (!this.isMergeInProgress()) return null;
    const conflictStatus = await this.getConflictStatusIfPresent();
    if (conflictStatus) return conflictStatus;
    await this.git.commit("arkNote: complete interrupted merge");
    if (this.isMergeInProgress()) {
      throw new Error("Git merge 未能正常结束");
    }
    (_a = this.onDataChanged) == null ? void 0 : _a.call(this, action);
    return null;
  }
  async recoverLegacyRebase() {
    if (!this.git || !this.isRebaseInProgress()) return;
    await this.git.raw(["rebase", "--abort"]);
    this.conflicts = [];
  }
  isRebaseInProgress() {
    const gitDir = path.join(this.dataDir, ".git");
    return fs.existsSync(path.join(gitDir, "rebase-merge")) || fs.existsSync(path.join(gitDir, "rebase-apply"));
  }
  isMergeInProgress() {
    return fs.existsSync(path.join(this.dataDir, ".git", "MERGE_HEAD"));
  }
  async getConflictStatusIfPresent() {
    const conflicts = await this.refreshConflicts();
    if (conflicts.length === 0) return null;
    return {
      lastSync: null,
      status: "conflict",
      message: `有 ${conflicts.length} 个文件存在冲突，需要选择保留版本`,
      conflicts
    };
  }
  async refreshConflicts() {
    if (!this.git) {
      this.conflicts = [];
      return this.conflicts;
    }
    const status = await this.git.status();
    this.conflicts = await Promise.all(status.conflicted.map(async (file) => ({
      file,
      localContent: await this.readConflictStage(file, 2),
      remoteContent: await this.readConflictStage(file, 3),
      resolved: false
    })));
    return this.conflicts;
  }
  async readConflictStage(file, stage) {
    if (!this.git) return "";
    try {
      const content = await this.git.binaryCatFile(["-p", `:${stage}:${file}`]);
      if (content.includes(0)) return "";
      return content.toString("utf-8");
    } catch {
      return "";
    }
  }
  async resolveConflicts(resolutions) {
    const validation = this.validateConfiguration();
    if (validation) return validation;
    return this.runExclusive(() => this.resolveGitConflicts(resolutions));
  }
  async resolveGitConflicts(resolutions) {
    var _a, _b;
    if (!this.git) {
      return { lastSync: null, status: "error", message: "Git 未初始化" };
    }
    const branch = ((_a = this.config) == null ? void 0 : _a.branch) || "main";
    try {
      if (this.isRebaseInProgress()) {
        await this.recoverLegacyRebase();
        return {
          lastSync: null,
          status: "error",
          message: "已恢复旧版同步遗留的 rebase，请重新执行同步。"
        };
      }
      if (!this.isMergeInProgress()) {
        this.conflicts = [];
        return {
          lastSync: null,
          status: "error",
          message: "当前没有正在处理的 Git merge，请重新执行同步。"
        };
      }
      const currentConflicts = await this.refreshConflicts();
      const currentFiles = currentConflicts.map((conflict) => conflict.file).sort();
      const resolutionFiles = [...new Set(resolutions.map((item) => this.validateConflictPath(item.file)))].sort();
      if (currentFiles.join("\n") !== resolutionFiles.join("\n")) {
        return {
          lastSync: null,
          status: "conflict",
          message: "冲突文件已经变化，请重新选择保留版本。",
          conflicts: currentConflicts
        };
      }
      const resolutionMap = new Map(
        resolutions.map((item) => [this.validateConflictPath(item.file), item.resolution])
      );
      for (const file of currentFiles) {
        const resolution = resolutionMap.get(file);
        if (!resolution) {
          throw new Error(`文件 ${file} 缺少冲突解决方案`);
        }
        await this.selectConflictStage(file, resolution === "local" ? 2 : 3);
      }
      const remainingStatus = await this.getConflictStatusIfPresent();
      if (remainingStatus) return remainingStatus;
      await this.git.commit("arkNote: merge remote changes");
      if (this.isMergeInProgress()) {
        throw new Error("冲突文件已暂存，但 Git merge 仍未结束");
      }
      (_b = this.onDataChanged) == null ? void 0 : _b.call(this, "resolve");
      await this.pushRemote(branch);
      this.conflicts = [];
      return {
        lastSync: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        message: "冲突已解决并同步到远程"
      };
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent();
      if (conflictStatus) return conflictStatus;
      return {
        lastSync: null,
        status: "error",
        message: `解决冲突失败: ${this.formatError(error)}`
      };
    }
  }
  validateConflictPath(file) {
    const normalized = file.replace(/\\/g, "/");
    if (!normalized || path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) {
      throw new Error(`非法冲突文件路径: ${file}`);
    }
    return normalized;
  }
  async selectConflictStage(file, stage) {
    if (!this.git) return;
    const entries = await this.git.raw(["ls-files", "-u", "--", file]);
    const stageExists = entries.split(/\r?\n/).some((line) => new RegExp(`\\s${stage}\\t`).test(line));
    if (stageExists) {
      await this.git.raw(["checkout", stage === 2 ? "--ours" : "--theirs", "--", file]);
      await this.git.raw(["add", "--", file]);
    } else {
      await this.git.raw(["rm", "--", file]);
    }
  }
  async getStatus() {
    var _a;
    if (!((_a = this.config) == null ? void 0 : _a.enabled)) {
      return { lastSync: null, status: "idle", message: "同步未配置" };
    }
    if (this.operationActive) {
      return { lastSync: null, status: "syncing", message: "正在同步" };
    }
    if (this.config.provider === "git" && this.git) {
      try {
        if (this.isRebaseInProgress()) {
          return {
            lastSync: null,
            status: "error",
            message: "检测到旧版同步遗留的 rebase，下次同步时将自动恢复。"
          };
        }
        const conflictStatus = await this.getConflictStatusIfPresent();
        if (conflictStatus) return conflictStatus;
        if (this.isMergeInProgress()) {
          return {
            lastSync: null,
            status: "error",
            message: "Git merge 尚未完成，请重新执行同步以继续。"
          };
        }
        const status = await this.git.status();
        const hasChanges = status.files.length > 0;
        return {
          lastSync: null,
          status: "idle",
          message: hasChanges ? `有 ${status.files.length} 个文件待同步` : "已同步"
        };
      } catch (error) {
        return {
          lastSync: null,
          status: "error",
          message: `状态查询失败: ${this.formatError(error)}`
        };
      }
    }
    return { lastSync: null, status: "idle", message: "就绪" };
  }
  successStatus(action) {
    const messages = {
      manual: "同步成功",
      auto: "自动同步成功"
    };
    return {
      lastSync: (/* @__PURE__ */ new Date()).toISOString(),
      status: "success",
      message: messages[action]
    };
  }
  actionLabel(action) {
    if (action === "auto") return "自动同步";
    return "同步";
  }
  formatError(error) {
    return error instanceof Error ? error.message : String(error);
  }
  startAutoSync(intervalMinutes) {
    this.stopAutoSync();
    const safeIntervalMinutes = Math.max(1, intervalMinutes);
    this.syncInterval = setInterval(() => {
      if (this.operationActive) return;
      void this.runExclusive(() => this.gitSynchronize("auto")).then((result) => {
        if (result.status === "error") {
          console.error(result.message);
        }
      }).catch((error) => {
        console.error("自动同步失败:", error);
      });
    }, safeIntervalMinutes * 60 * 1e3);
  }
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  cleanup() {
    this.stopAutoSync();
  }
}
class TrashService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    __publicField(this, "trashMetadata", null);
    this.fileManager = fileManager;
  }
  get trashDir() {
    return path.join(this.fileManager.dataDir, "trash");
  }
  get trashNotesDir() {
    return path.join(this.trashDir, "notes");
  }
  get trashVersionsDir() {
    return path.join(this.trashDir, "versions");
  }
  get trashMetadataPath() {
    return path.join(this.trashDir, "trash-meta.json.enc");
  }
  ensureTrashDirs() {
    const dirs = [this.trashDir, this.trashNotesDir, this.trashVersionsDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
  loadTrashMetadata() {
    if (this.trashMetadata) return this.trashMetadata;
    this.ensureTrashDirs();
    if (fs.existsSync(this.trashMetadataPath)) {
      try {
        const content = this.fileManager.encryption.decryptFileToString(this.trashMetadataPath);
        this.trashMetadata = JSON.parse(content);
      } catch {
        this.trashMetadata = { items: [] };
      }
    } else {
      this.trashMetadata = { items: [] };
    }
    return this.trashMetadata;
  }
  saveTrashMetadata() {
    if (!this.trashMetadata) return;
    this.ensureTrashDirs();
    this.fileManager.encryption.encryptStringToFile(
      this.trashMetadataPath,
      JSON.stringify(this.trashMetadata, null, 2)
    );
  }
  /**
   * Get directory path as string for display
   */
  getDirPath(dirId) {
    if (!dirId) return "/";
    const meta = this.fileManager.getMetadata();
    const parts = [];
    let currentId = dirId;
    while (currentId) {
      const dir = meta.directories.find((d) => d.id === currentId);
      if (!dir) break;
      parts.unshift(dir.name);
      currentId = dir.parentId;
    }
    return "/" + parts.join("/");
  }
  restoreNoteFileAndVersions(noteId) {
    const srcPath = path.join(this.trashNotesDir, `${noteId}.md.enc`);
    const destPath = this.fileManager.getNotePath(noteId);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
    }
    const srcVersionDir = path.join(this.trashVersionsDir, noteId);
    const destVersionDir = this.fileManager.getVersionDir(noteId);
    if (fs.existsSync(srcVersionDir)) {
      if (!fs.existsSync(destVersionDir)) {
        fs.mkdirSync(destVersionDir, { recursive: true });
      }
      const versionFiles = fs.readdirSync(srcVersionDir);
      for (const file of versionFiles) {
        fs.copyFileSync(
          path.join(srcVersionDir, file),
          path.join(destVersionDir, file)
        );
      }
      fs.rmSync(srcVersionDir, { recursive: true });
    }
  }
  getFallbackDirectoryId(meta) {
    const rootDir = meta.directories.find((d) => d.parentId === null);
    return (rootDir == null ? void 0 : rootDir.id) ?? null;
  }
  listVersionFiles(versionDir) {
    if (!fs.existsSync(versionDir)) return [];
    const files = fs.readdirSync(versionDir).filter((f) => f.endsWith(".md.enc")).sort().reverse();
    return files.map((f) => ({
      timestamp: f.replace(/^(manual|auto)_/, "").replace(".md.enc", ""),
      isManual: f.startsWith("manual_"),
      fileName: f
    }));
  }
  listVersions(noteId) {
    const trashMeta = this.loadTrashMetadata();
    const item = trashMeta.items.find((i) => i.id === noteId && i.type === "note");
    if (!item) return [];
    const versionDir = path.join(this.trashVersionsDir, noteId);
    return this.listVersionFiles(versionDir).map((v) => ({
      noteId,
      timestamp: v.timestamp,
      title: item.metadata.title,
      isManual: v.isManual
    }));
  }
  getVersion(noteId, timestamp) {
    const versionDir = path.join(this.trashVersionsDir, noteId);
    const version = this.listVersionFiles(versionDir).find((v) => v.timestamp === timestamp);
    if (!version) throw new Error(`Trash version not found: ${timestamp}`);
    return this.fileManager.encryption.decryptFileToString(path.join(versionDir, version.fileName));
  }
  /**
   * Move a note to trash (soft delete)
   */
  trashNote(noteId) {
    const meta = this.fileManager.getMetadata();
    const noteMeta = meta.notes.find((n) => n.id === noteId);
    if (!noteMeta) return;
    this.ensureTrashDirs();
    const trashMeta = this.loadTrashMetadata();
    trashMeta.items = trashMeta.items.filter((i) => !(i.id === noteId && i.type === "note"));
    const srcPath = this.fileManager.getNotePath(noteId);
    const destPath = path.join(this.trashNotesDir, `${noteId}.md.enc`);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
    }
    const srcVersionDir = this.fileManager.getVersionDir(noteId);
    const destVersionDir = path.join(this.trashVersionsDir, noteId);
    if (fs.existsSync(srcVersionDir)) {
      if (!fs.existsSync(destVersionDir)) {
        fs.mkdirSync(destVersionDir, { recursive: true });
      }
      const versionFiles = fs.readdirSync(srcVersionDir);
      for (const file of versionFiles) {
        fs.copyFileSync(
          path.join(srcVersionDir, file),
          path.join(destVersionDir, file)
        );
      }
      fs.rmSync(srcVersionDir, { recursive: true });
    }
    trashMeta.items.push({
      type: "note",
      id: noteId,
      name: noteMeta.title,
      parentId: null,
      directoryId: noteMeta.directoryId,
      deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
      originalPath: this.getDirPath(noteMeta.directoryId),
      metadata: { ...noteMeta }
    });
    this.saveTrashMetadata();
    this.fileManager.removeNote(noteId);
  }
  /**
   * Move a directory and all its contents to trash (soft delete)
   */
  trashDirectory(dirId) {
    const meta = this.fileManager.getMetadata();
    const rootDir = meta.directories.find((d) => d.id === dirId);
    if (!rootDir) return;
    this.ensureTrashDirs();
    const trashMeta = this.loadTrashMetadata();
    const deletedAt = (/* @__PURE__ */ new Date()).toISOString();
    const groupId = dirId;
    trashMeta.items = trashMeta.items.filter((i) => i.id !== dirId && i.groupId !== groupId);
    const subtreeDirs = [];
    const subtreeNotes = [];
    const collectDescendants = (parentId) => {
      const currentDir = meta.directories.find((d) => d.id === parentId);
      if (currentDir) {
        subtreeDirs.push(currentDir);
      }
      const childNotes = meta.notes.filter((n) => n.directoryId === parentId);
      subtreeNotes.push(...childNotes);
      const childDirs = meta.directories.filter((d) => d.parentId === parentId);
      for (const childDir of childDirs) {
        collectDescendants(childDir.id);
      }
    };
    collectDescendants(dirId);
    for (const noteMeta of subtreeNotes) {
      const srcPath = this.fileManager.getNotePath(noteMeta.id);
      const destPath = path.join(this.trashNotesDir, `${noteMeta.id}.md.enc`);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath);
      }
      const srcVersionDir = this.fileManager.getVersionDir(noteMeta.id);
      const destVersionDir = path.join(this.trashVersionsDir, noteMeta.id);
      if (fs.existsSync(srcVersionDir)) {
        if (!fs.existsSync(destVersionDir)) {
          fs.mkdirSync(destVersionDir, { recursive: true });
        }
        const versionFiles = fs.readdirSync(srcVersionDir);
        for (const file of versionFiles) {
          fs.copyFileSync(
            path.join(srcVersionDir, file),
            path.join(destVersionDir, file)
          );
        }
        fs.rmSync(srcVersionDir, { recursive: true });
      }
    }
    for (const directoryMeta of subtreeDirs) {
      trashMeta.items.push({
        type: "directory",
        id: directoryMeta.id,
        name: directoryMeta.name,
        parentId: directoryMeta.parentId,
        deletedAt,
        originalPath: this.getDirPath(directoryMeta.parentId),
        groupId,
        metadata: { ...directoryMeta }
      });
    }
    for (const noteMeta of subtreeNotes) {
      trashMeta.items.push({
        type: "note",
        id: noteMeta.id,
        name: noteMeta.title,
        parentId: noteMeta.directoryId,
        directoryId: noteMeta.directoryId,
        deletedAt,
        originalPath: this.getDirPath(noteMeta.directoryId),
        groupId,
        metadata: { ...noteMeta }
      });
    }
    this.saveTrashMetadata();
    for (const noteMeta of subtreeNotes) {
      this.fileManager.removeNote(noteMeta.id);
    }
    for (const directoryMeta of [...subtreeDirs].sort((a, b) => b.order - a.order)) {
      this.fileManager.removeDirectory(directoryMeta.id);
    }
  }
  /**
   * List all items in trash
   */
  list() {
    const trashMeta = this.loadTrashMetadata();
    return trashMeta.items.filter((item) => item.type === "note" || !item.groupId || item.groupId === item.id).map((item) => ({
      type: item.type,
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      directoryId: item.directoryId,
      deletedAt: item.deletedAt,
      originalPath: item.originalPath
    }));
  }
  /**
   * Restore a note from trash
   */
  restoreNote(noteId) {
    const trashMeta = this.loadTrashMetadata();
    const item = trashMeta.items.find((i) => i.id === noteId && i.type === "note");
    if (!item) return;
    const meta = this.fileManager.getMetadata();
    const noteMeta = item.metadata ?? {
      id: item.id,
      title: item.name,
      directoryId: item.directoryId ?? this.getFallbackDirectoryId(meta) ?? "",
      tags: [],
      createdAt: item.deletedAt,
      updatedAt: item.deletedAt,
      order: 0
    };
    let directoryId = noteMeta.directoryId;
    if (!meta.directories.find((d) => d.id === directoryId)) {
      const fallbackDirectoryId = this.getFallbackDirectoryId(meta);
      if (!fallbackDirectoryId) {
        return;
      }
      directoryId = fallbackDirectoryId;
    }
    this.restoreNoteFileAndVersions(noteId);
    this.fileManager.addNote({
      ...noteMeta,
      directoryId
    });
    trashMeta.items = trashMeta.items.filter((i) => !(i.id === noteId && i.type === "note"));
    this.saveTrashMetadata();
  }
  /**
   * Restore a directory from trash
   */
  restoreDirectory(dirId) {
    const trashMeta = this.loadTrashMetadata();
    const rootItem = trashMeta.items.find((i) => i.id === dirId && i.type === "directory");
    if (!rootItem) return;
    const groupId = rootItem.groupId || dirId;
    const directoryItems = trashMeta.items.filter((i) => i.type === "directory" && i.groupId === groupId).sort((a, b) => {
      const aIsRoot = a.id === dirId ? 0 : 1;
      const bIsRoot = b.id === dirId ? 0 : 1;
      if (aIsRoot !== bIsRoot) return aIsRoot - bIsRoot;
      return a.originalPath.localeCompare(b.originalPath);
    });
    const existingMeta = this.fileManager.getMetadata();
    const restoredDirIds = /* @__PURE__ */ new Set();
    for (const item of directoryItems) {
      let parentId = item.metadata.parentId;
      if (item.id === dirId) {
        if (parentId && !existingMeta.directories.find((d) => d.id === parentId)) {
          parentId = null;
        }
      } else if (parentId && !restoredDirIds.has(parentId) && !this.fileManager.getMetadata().directories.find((d) => d.id === parentId)) {
        parentId = dirId;
      }
      this.fileManager.addDirectory({
        ...item.metadata,
        parentId
      });
      restoredDirIds.add(item.id);
    }
    const noteItems = trashMeta.items.filter((i) => i.type === "note" && i.groupId === groupId).sort((a, b) => a.metadata.order - b.metadata.order);
    for (const noteItem of noteItems) {
      const currentMeta = this.fileManager.getMetadata();
      let directoryId = noteItem.metadata.directoryId;
      if (!currentMeta.directories.find((d) => d.id === directoryId)) {
        directoryId = dirId;
      }
      this.restoreNoteFileAndVersions(noteItem.id);
      this.fileManager.addNote({
        ...noteItem.metadata,
        directoryId
      });
    }
    trashMeta.items = trashMeta.items.filter((i) => i.groupId !== groupId);
    this.saveTrashMetadata();
  }
  /**
   * Permanently delete a note (and all versions)
   */
  deletePermanentlyNote(noteId) {
    const trashMeta = this.loadTrashMetadata();
    const notePath = path.join(this.trashNotesDir, `${noteId}.md.enc`);
    if (fs.existsSync(notePath)) {
      fs.unlinkSync(notePath);
    }
    const versionDir = path.join(this.trashVersionsDir, noteId);
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true });
    }
    trashMeta.items = trashMeta.items.filter((i) => !(i.id === noteId && i.type === "note"));
    this.saveTrashMetadata();
  }
  /**
   * Permanently delete a directory and all its contents
   */
  deletePermanentlyDirectory(dirId) {
    const trashMeta = this.loadTrashMetadata();
    const item = trashMeta.items.find((i) => i.id === dirId && i.type === "directory");
    if (!item) return;
    const groupId = item.groupId || dirId;
    const noteIds = trashMeta.items.filter((i) => i.type === "note" && i.groupId === groupId).map((i) => i.id);
    for (const noteId of noteIds) {
      this.deletePermanentlyNote(noteId);
    }
    trashMeta.items = trashMeta.items.filter((i) => i.groupId !== groupId);
    this.saveTrashMetadata();
  }
  /**
   * Empty the entire trash
   */
  emptyTrash() {
    const trashMeta = this.loadTrashMetadata();
    if (fs.existsSync(this.trashNotesDir)) {
      const files = fs.readdirSync(this.trashNotesDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.trashNotesDir, file));
      }
    }
    if (fs.existsSync(this.trashVersionsDir)) {
      const dirs = fs.readdirSync(this.trashVersionsDir);
      for (const dir of dirs) {
        fs.rmSync(path.join(this.trashVersionsDir, dir), { recursive: true });
      }
    }
    trashMeta.items = [];
    this.saveTrashMetadata();
  }
  /**
   * Get note content from trash for preview
   */
  getNoteContent(noteId) {
    const trashMeta = this.loadTrashMetadata();
    const item = trashMeta.items.find((i) => i.id === noteId && i.type === "note");
    if (!item) return null;
    const notePath = path.join(this.trashNotesDir, `${noteId}.md.enc`);
    if (!fs.existsSync(notePath)) return null;
    try {
      const content = this.fileManager.encryption.decryptFileToString(notePath);
      return {
        id: noteId,
        content,
        metadata: { ...item.metadata }
      };
    } catch {
      return null;
    }
  }
  /**
   * Clear cache
   */
  clearCache() {
    this.trashMetadata = null;
  }
}
const BRAND_ID = "arknote";
const IMAGE_PROTOCOL = `${BRAND_ID}://`;
const NOTE_LINK_PROTOCOL = `${BRAND_ID}-link://`;
const LEGACY_BRAND_ID = globalThis.atob("enpub3Rl");
globalThis.atob("enotbm90ZQ==");
function migrateLegacyBrandReferences(value) {
  return value.split(`${LEGACY_BRAND_ID}-link://`).join(NOTE_LINK_PROTOCOL).split(`${LEGACY_BRAND_ID}://`).join(IMAGE_PROTOCOL).split(`data-${LEGACY_BRAND_ID}-`).join(`data-${BRAND_ID}-`);
}
class ImportService {
  constructor(fileManager) {
    __publicField(this, "fileManager");
    this.fileManager = fileManager;
  }
  /**
   * Import a Markdown file into a directory
   */
  importMdFile(filePath, directoryId, language = "zh-CN") {
    const content = migrateLegacyBrandReferences(fs.readFileSync(filePath, "utf-8"));
    const fileName = path.basename(filePath, path.extname(filePath));
    const title = fileName || translate(language, "导入的笔记");
    const id = this.fileManager.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const note = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.fileManager.getMetadata().notes.filter((n) => n.directoryId === directoryId).length
    };
    this.fileManager.addNote(note);
    let processedContent = content;
    const mdDir = path.dirname(filePath);
    const imageRegex = /!\[([^\]]*)\]\((?!https?:\/\/|data:|arknote:\/\/)([^)]+)\)/g;
    const matches = [...processedContent.matchAll(imageRegex)];
    for (const match of matches) {
      const altText = match[1];
      const imagePath = match[2];
      const absoluteImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(mdDir, imagePath);
      if (fs.existsSync(absoluteImagePath)) {
        try {
          const ext = path.extname(absoluteImagePath);
          const imageData = fs.readFileSync(absoluteImagePath);
          const imageId = this.fileManager.saveImage(imageData, ext);
          processedContent = processedContent.replace(
            match[0],
            `![${altText}](arknote://${imageId})`
          );
        } catch (err) {
          console.error(`Failed to import image ${absoluteImagePath}:`, err);
        }
      }
    }
    const htmlImgRegex = /<img[^>]+src="(?!https?:\/\/|data:|arknote:\/\/)([^"]+)"[^>]*>/g;
    const htmlMatches = [...processedContent.matchAll(htmlImgRegex)];
    for (const match of htmlMatches) {
      const imagePath = match[1];
      const absoluteImagePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(mdDir, imagePath);
      if (fs.existsSync(absoluteImagePath)) {
        try {
          const ext = path.extname(absoluteImagePath);
          const imageData = fs.readFileSync(absoluteImagePath);
          const imageId = this.fileManager.saveImage(imageData, ext);
          processedContent = processedContent.replace(
            match[1],
            `arknote://${imageId}`
          );
        } catch (err) {
          console.error(`Failed to import HTML image ${absoluteImagePath}:`, err);
        }
      }
    }
    this.fileManager.writeNoteContent(id, processedContent);
    return note;
  }
  /**
   * Convert extracted PDF page text to Markdown, preserving formatting heuristically.
   * Detects headings (short standalone lines), bullet lists, numbered lists,
   * and preserves line breaks within structured blocks.
   */
  convertPageTextToMarkdown(pageText) {
    var _a;
    const lines = pageText.split("\n");
    let md = "";
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === "") {
        if (md.length > 0 && !md.endsWith("\n\n")) {
          md += "\n";
        }
        i++;
        continue;
      }
      if (/^(\d+[\.\)）、]|（\d+）)\s/.test(trimmed)) {
        const listContent = trimmed.replace(/^(\d+)[\.\)）、]\s*/, "$1. ").replace(/^（(\d+)）\s*/, "$1. ");
        md += listContent + "\n";
        i++;
        continue;
      }
      if (/^[•·\-–—■●○◆▸▹►☞➤]\s/.test(trimmed)) {
        const listContent = trimmed.replace(/^[•·\-–—■●○◆▸▹►☞➤]\s*/, "- ");
        md += listContent + "\n";
        i++;
        continue;
      }
      const nextLine = i + 1 < lines.length ? (_a = lines[i + 1]) == null ? void 0 : _a.trim() : "";
      const isShortLine = trimmed.length <= 60;
      const nextIsEmpty = nextLine === "";
      const looksLikeHeading = isShortLine && nextIsEmpty && !trimmed.endsWith(",") && !trimmed.endsWith("，") && !trimmed.endsWith(";") && !trimmed.endsWith("；") && !trimmed.endsWith("、");
      if (looksLikeHeading && trimmed.length > 0) {
        md += `
## ${trimmed}

`;
        i++;
        continue;
      }
      md += trimmed + "\n";
      i++;
    }
    return md;
  }
  /**
   * Import a PDF file - convert to MD
   * Uses pdf-parse v2.x (PDFParse class) to extract text and images.
   * Processes each page separately to preserve document structure.
   */
  async importPdfFile(filePath, directoryId, language = "zh-CN") {
    const fileName = path.basename(filePath, ".pdf");
    const title = fileName || translate(language, "导入的PDF笔记");
    const id = this.fileManager.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const note = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.fileManager.getMetadata().notes.filter((n) => n.directoryId === directoryId).length
    };
    this.fileManager.addNote(note);
    let markdownContent = `# ${title}

`;
    markdownContent += `> ${translate(language, "从 PDF 文件导入: {file}", { file: path.basename(filePath) })}

`;
    try {
      const { PDFParse } = require("pdf-parse");
      const pdfBuffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
      const textResult = await parser.getText();
      const totalPages = textResult.total || 0;
      if (textResult.pages && textResult.pages.length > 0) {
        for (let p = 0; p < textResult.pages.length; p++) {
          const pageData = textResult.pages[p];
          const pageText = pageData.text || "";
          if (!pageText.trim()) continue;
          if (totalPages > 1 && p > 0) {
            markdownContent += `
---

`;
          }
          try {
            const imageResult = await parser.getImage({
              imageBuffer: true,
              imageDataUrl: false,
              partial: [pageData.num]
            });
            if (imageResult && imageResult.pages) {
              for (const imgPage of imageResult.pages) {
                if (imgPage.images) {
                  for (const img of imgPage.images) {
                    if (img.data && img.width > 50 && img.height > 50) {
                      try {
                        const imageId = this.fileManager.saveImage(Buffer.from(img.data), ".png");
                        markdownContent += `<img src="arknote://${imageId}" alt="PDF image" width="${Math.min(img.width, 600)}" />

`;
                      } catch (imgErr) {
                        console.error("Failed to save PDF image:", imgErr);
                      }
                    }
                  }
                }
              }
            }
          } catch {
          }
          markdownContent += this.convertPageTextToMarkdown(pageText);
          markdownContent += "\n";
        }
      } else {
        const text = textResult.text || "";
        markdownContent += this.convertPageTextToMarkdown(text);
      }
      markdownContent += `
---

`;
      markdownContent += `*${translate(language, "PDF 信息: {pages} 页", { pages: totalPages || translate(language, "未知") })}*
`;
      try {
        await parser.destroy();
      } catch {
      }
    } catch (error) {
      console.error("PDF parsing failed:", error);
      markdownContent += `*${translate(language, "PDF 文本提取失败。错误: {message}", { message: error instanceof Error ? error.message : String(error) })}*

`;
      markdownContent += `*${translate(language, "你可以手动将 PDF 内容复制粘贴到此笔记中。")}*
`;
    }
    this.fileManager.writeNoteContent(id, markdownContent);
    return note;
  }
}
const HTTPS_REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i;
const SSH_REPOSITORY = /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i;
const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/;
class VaultRestoreService {
  constructor(dataDir, options = {}) {
    __publicField(this, "cloneRepository");
    __publicField(this, "restoreInProgress", false);
    this.dataDir = dataDir;
    this.cloneRepository = options.cloneRepository ?? this.cloneGithubRepository.bind(this);
  }
  async restore(request) {
    if (this.restoreInProgress) {
      return { success: false, message: "恢复任务正在进行，请稍候" };
    }
    let stagingDir = "";
    let restored = false;
    this.restoreInProgress = true;
    try {
      const repoUrl = this.validateRepoUrl(request.repoUrl);
      const branch = this.validateBranch(request.branch);
      this.assertTargetIsEmpty();
      const parentDir = path.dirname(this.dataDir);
      fs.mkdirSync(parentDir, { recursive: true });
      stagingDir = path.join(
        parentDir,
        `.${path.basename(this.dataDir)}.restore-${process.pid}-${crypto.randomUUID()}`
      );
      await this.cloneRepository(repoUrl, stagingDir, branch);
      this.validateRestoredVault(stagingDir);
      this.assertTargetIsEmpty();
      if (fs.existsSync(this.dataDir)) {
        fs.rmdirSync(this.dataDir);
      }
      fs.renameSync(stagingDir, this.dataDir);
      restored = true;
      return {
        success: true,
        message: "加密数据已恢复，请使用原仓库密码解锁"
      };
    } catch (error) {
      return {
        success: false,
        message: this.formatError(error)
      };
    } finally {
      if (!restored && stagingDir && fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      this.restoreInProgress = false;
    }
  }
  validateRepoUrl(value) {
    const repoUrl = value.trim();
    if (!HTTPS_REPOSITORY.test(repoUrl) && !SSH_REPOSITORY.test(repoUrl)) {
      throw new Error("请输入有效的 GitHub HTTPS 或 SSH 仓库地址");
    }
    return repoUrl;
  }
  validateBranch(value) {
    const branch = value.trim() || "main";
    if (branch.length > 200 || !BRANCH_NAME.test(branch) || branch.startsWith("-") || branch.startsWith("/") || branch.endsWith("/") || branch.endsWith(".") || branch.includes("..") || branch.includes("//") || branch.includes("@{")) {
      throw new Error("分支名称无效");
    }
    return branch;
  }
  assertTargetIsEmpty() {
    if (!fs.existsSync(this.dataDir)) return;
    if (!fs.statSync(this.dataDir).isDirectory()) {
      throw new Error("本地数据路径不是目录");
    }
    if (fs.readdirSync(this.dataDir).length > 0) {
      throw new Error("本地数据目录已有内容，已取消恢复以避免覆盖数据");
    }
  }
  validateRestoredVault(dir) {
    const gitDir = path.join(dir, ".git");
    const saltPath = path.join(dir, "salt.bin");
    const verifyPath = path.join(dir, "verify.enc");
    const metadataPath = path.join(dir, "metadata.json.enc");
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      throw new Error("远程仓库不是有效的 Git 仓库");
    }
    if (!fs.existsSync(saltPath) || fs.statSync(saltPath).size !== 32) {
      throw new Error("远程仓库缺少有效的 salt.bin");
    }
    if (!fs.existsSync(verifyPath) || fs.statSync(verifyPath).size < 29) {
      throw new Error("远程仓库缺少有效的 verify.enc");
    }
    if (!fs.existsSync(metadataPath) || fs.statSync(metadataPath).size < 29) {
      throw new Error("远程仓库缺少有效的 metadata.json.enc");
    }
    this.rejectSymbolicLinks(dir);
  }
  rejectSymbolicLinks(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        throw new Error("远程仓库包含不受支持的符号链接");
      }
      if (entry.isDirectory()) {
        this.rejectSymbolicLinks(path.join(dir, entry.name));
      }
    }
  }
  async cloneGithubRepository(repoUrl, targetDir, branch) {
    const env = { ...process.env };
    env.GIT_TERMINAL_PROMPT = "0";
    env.GIT_SSH_COMMAND = env.GIT_SSH_COMMAND || "ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes";
    await simpleGit.simpleGit({ binary: "git", maxConcurrentProcesses: 1 }).env(env).clone(repoUrl, targetDir, ["--branch", branch, "--single-branch"]);
  }
  formatError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/authentication|permission denied|publickey|could not read/i.test(message)) {
      return "GitHub 身份验证失败，请检查仓库权限或 SSH 密钥";
    }
    if (/couldn't find remote ref|remote branch|not found/i.test(message)) {
      return "未找到指定仓库或分支";
    }
    if (/resolve host|network|timed out|timeout|connection/i.test(message)) {
      return "无法连接 GitHub，请检查网络后重试";
    }
    return message;
  }
}
const MIN_NEW_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 1024;
const FAILURE_RESET_MS = 24 * 60 * 60 * 1e3;
const DELAY_AFTER_FAILURES = 3;
const BASE_DELAY_MS = 1e3;
const MAX_DELAY_MS = 5 * 60 * 1e3;
const MAX_JITTER_MS = 250;
const COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "123456789012",
  "111111111111",
  "password1234",
  "password12345",
  "qwertyuiop12",
  "qwerty123456",
  "administrator",
  "letmein123456",
  "iloveyou1234",
  "arknote123456"
]);
function createVaultAuthKey(dataDir) {
  return crypto.createHash("sha256").update(path.resolve(dataDir)).digest("hex");
}
function validatePasswordInput(password) {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: "请输入密码" };
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return { valid: false, message: "密码长度超出允许范围" };
  }
  return { valid: true, message: "" };
}
function validateNewPassword(password) {
  const input = validatePasswordInput(password);
  if (!input.valid || typeof password !== "string") return input;
  const characters = Array.from(password);
  if (characters.length < MIN_NEW_PASSWORD_LENGTH) {
    return { valid: false, message: `密码至少需要 ${MIN_NEW_PASSWORD_LENGTH} 个字符` };
  }
  const normalized = password.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (COMMON_PASSWORDS.has(normalized)) {
    return { valid: false, message: "该密码过于常见，请使用更长的随机密码或多个单词组成的口令" };
  }
  if (/^(.)\1+$/u.test(normalized) || /^\d+$/u.test(normalized)) {
    return { valid: false, message: "密码不能只包含重复字符或数字" };
  }
  const categories = [
    new RegExp("\\p{Ll}", "u").test(password) || new RegExp("\\p{Lo}", "u").test(password),
    new RegExp("\\p{Lu}", "u").test(password),
    new RegExp("\\p{N}", "u").test(password),
    /[^\p{L}\p{N}\s]/u.test(password)
  ].filter(Boolean).length;
  if (characters.length < 16 && categories < 2) {
    return { valid: false, message: "少于 16 个字符的密码需要包含至少两类字符" };
  }
  return { valid: true, message: "" };
}
class AuthAttemptLimiter {
  constructor(vaultKey, store, now = Date.now, random = Math.random) {
    __publicField(this, "operationQueue", Promise.resolve());
    this.vaultKey = vaultKey;
    this.store = store;
    this.now = now;
    this.random = random;
  }
  async runExclusive(operation) {
    const previous = this.operationQueue;
    let release;
    this.operationQueue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
  getStatus() {
    const state = this.getCurrentState();
    return {
      failedAttempts: state.failedAttempts,
      retryAfterMs: Math.max(0, state.nextAllowedAt - this.now())
    };
  }
  recordFailure() {
    const current = this.getCurrentState();
    const failedAttempts = current.failedAttempts + 1;
    const exponentialStep = Math.max(0, failedAttempts - DELAY_AFTER_FAILURES);
    const baseDelay = failedAttempts >= DELAY_AFTER_FAILURES ? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** exponentialStep) : 0;
    const jitterRange = Math.min(MAX_JITTER_MS, Math.max(0, MAX_DELAY_MS - baseDelay));
    const jitter = baseDelay > 0 ? Math.floor(this.random() * jitterRange) : 0;
    const now = this.now();
    const nextAllowedAt = now + baseDelay + jitter;
    this.store.setAuthThrottle(this.vaultKey, {
      failedAttempts,
      nextAllowedAt,
      lastFailureAt: now
    });
    return { failedAttempts, retryAfterMs: baseDelay + jitter };
  }
  reset() {
    this.store.clearAuthThrottle(this.vaultKey);
  }
  getCurrentState() {
    const state = this.store.getAuthThrottle(this.vaultKey);
    if (!state) return { failedAttempts: 0, nextAllowedAt: 0, lastFailureAt: 0 };
    if (this.now() - state.lastFailureAt >= FAILURE_RESET_MS) {
      this.store.clearAuthThrottle(this.vaultKey);
      return { failedAttempts: 0, nextAllowedAt: 0, lastFailureAt: 0 };
    }
    return state;
  }
}
function registerIpcHandlers(dataDir, appConfig2, restartApp) {
  const encryption = new EncryptionService(dataDir);
  const fileManager = new FileManager(dataDir, encryption);
  const noteService = new NoteService(fileManager);
  const directoryService = new DirectoryService(fileManager);
  const tagService = new TagService(fileManager);
  const versionService = new VersionService(fileManager);
  const searchService = new SearchService(fileManager);
  const pdfService = new PdfService();
  const trashService = new TrashService(fileManager);
  const importService = new ImportService(fileManager);
  const vaultRestoreService = new VaultRestoreService(dataDir);
  let pendingAutoSyncResolver = null;
  let pendingAutoSyncTimeout = null;
  const authLimiter = new AuthAttemptLimiter(createVaultAuthKey(dataDir), appConfig2);
  const tr = (source) => translate(appConfig2.getLanguage(), source);
  const reloadDataCaches = () => {
    fileManager.clearCache();
    searchService.clearCache();
    fileManager.loadMetadata();
    trashService.clearCache();
  };
  const rateLimitResult = (retryAfterMs, failedAttempts) => ({
    success: false,
    error: "rate_limited",
    message: `尝试次数过多，请在 ${Math.max(1, Math.ceil(retryAfterMs / 1e3))} 秒后重试`,
    retryAfterMs,
    failedAttempts
  });
  const invalidPasswordResult = (retryAfterMs, failedAttempts) => ({
    success: false,
    error: "invalid_password",
    message: retryAfterMs > 0 ? `密码错误，请在 ${Math.max(1, Math.ceil(retryAfterMs / 1e3))} 秒后重试` : "密码错误，请重试",
    retryAfterMs,
    failedAttempts
  });
  const settleAutoSyncRequest = (ok) => {
    if (pendingAutoSyncTimeout) {
      clearTimeout(pendingAutoSyncTimeout);
      pendingAutoSyncTimeout = null;
    }
    const resolver = pendingAutoSyncResolver;
    pendingAutoSyncResolver = null;
    resolver == null ? void 0 : resolver(ok);
  };
  const requestRendererFlushForAutoSync = async () => {
    const win = electron.BrowserWindow.getAllWindows().find((window) => !window.isDestroyed());
    if (!win) return true;
    if (pendingAutoSyncResolver) return false;
    return new Promise((resolve) => {
      pendingAutoSyncResolver = resolve;
      win.webContents.send("sync:auto-requested");
      pendingAutoSyncTimeout = setTimeout(() => {
        settleAutoSyncRequest(false);
      }, 1e4);
    });
  };
  const syncService = new SyncService(dataDir, {
    beforeAutoSync: requestRendererFlushForAutoSync,
    onDataChanged: () => {
      try {
        reloadDataCaches();
        for (const win of electron.BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send("sync:data-changed");
          }
        }
      } catch (error) {
        console.error("Failed to reload data after sync:", error);
      }
    }
  });
  const lockVault = () => {
    noteService.cleanup();
    syncService.cleanup();
    settleAutoSyncRequest(false);
    fileManager.clearCache();
    searchService.clearCache();
    trashService.clearCache();
    encryption.lock();
  };
  electron.ipcMain.handle("auth:unlock", async (_event, password) => {
    return authLimiter.runExclusive(async () => {
      const isFirstTime = encryption.isFirstTime();
      const throttle = authLimiter.getStatus();
      if (throttle.retryAfterMs > 0) {
        return { ...rateLimitResult(throttle.retryAfterMs, throttle.failedAttempts), isFirstTime };
      }
      const inputValidation = validatePasswordInput(password);
      if (!inputValidation.valid) {
        const failed = authLimiter.recordFailure();
        return { ...invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts), isFirstTime };
      }
      if (isFirstTime) {
        const passwordValidation = validateNewPassword(password);
        if (!passwordValidation.valid) {
          return {
            success: false,
            isFirstTime,
            error: "weak_password",
            message: passwordValidation.message,
            retryAfterMs: 0,
            failedAttempts: 0
          };
        }
      }
      try {
        const success = await encryption.unlock(password);
        if (!success) {
          const failed = authLimiter.recordFailure();
          return { ...invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts), isFirstTime };
        }
        fileManager.ensureDirectories();
        fileManager.loadMetadata();
        trashService.ensureTrashDirs();
        const meta = fileManager.getMetadata();
        if (meta.syncConfig.enabled) {
          syncService.configure(meta.syncConfig).catch(console.error);
        }
        authLimiter.reset();
        return {
          success: true,
          isFirstTime,
          retryAfterMs: 0,
          failedAttempts: 0
        };
      } catch (error) {
        encryption.lock();
        if (error instanceof VaultIntegrityError) {
          return {
            success: false,
            isFirstTime,
            error: "vault_integrity",
            message: error.message,
            retryAfterMs: 0,
            failedAttempts: throttle.failedAttempts
          };
        }
        return {
          success: false,
          isFirstTime,
          error: "unlock_failed",
          message: "解锁失败，请检查数据目录后重试",
          retryAfterMs: 0,
          failedAttempts: throttle.failedAttempts
        };
      }
    });
  });
  electron.ipcMain.handle("auth:getUnlockStatus", async () => authLimiter.getStatus());
  electron.ipcMain.handle("auth:restoreFromGit", async (_event, request) => {
    return authLimiter.runExclusive(async () => {
      if (!encryption.isFirstTime()) {
        return { success: false, message: "本地已有加密数据，不能执行首次恢复" };
      }
      const result = await vaultRestoreService.restore({
        repoUrl: typeof (request == null ? void 0 : request.repoUrl) === "string" ? request.repoUrl : "",
        branch: typeof (request == null ? void 0 : request.branch) === "string" ? request.branch : "main"
      });
      if (result.success) authLimiter.reset();
      return result;
    });
  });
  electron.ipcMain.handle("auth:lock", async () => {
    lockVault();
  });
  electron.ipcMain.handle("auth:isLocked", async () => {
    return encryption.isLocked();
  });
  electron.ipcMain.handle("auth:isFirstTime", async () => {
    return encryption.isFirstTime();
  });
  electron.ipcMain.handle("auth:changePassword", async (_event, oldPassword, newPassword) => {
    return authLimiter.runExclusive(async () => {
      const throttle = authLimiter.getStatus();
      if (throttle.retryAfterMs > 0) {
        return rateLimitResult(throttle.retryAfterMs, throttle.failedAttempts);
      }
      const oldPasswordValidation = validatePasswordInput(oldPassword);
      const newPasswordValidation = validateNewPassword(newPassword);
      if (!newPasswordValidation.valid) {
        return {
          success: false,
          error: "weak_password",
          message: newPasswordValidation.message,
          retryAfterMs: 0,
          failedAttempts: throttle.failedAttempts
        };
      }
      if (!oldPasswordValidation.valid) {
        const failed = authLimiter.recordFailure();
        return invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts);
      }
      const success = await encryption.changePassword(oldPassword, newPassword);
      if (!success) {
        const failed = authLimiter.recordFailure();
        return invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts);
      }
      fileManager.clearCache();
      searchService.clearCache();
      fileManager.loadMetadata();
      trashService.clearCache();
      authLimiter.reset();
      return {
        success: true,
        retryAfterMs: 0,
        failedAttempts: 0
      };
    });
  });
  electron.ipcMain.handle("config:getDataDir", async () => {
    return appConfig2.getDataDir();
  });
  electron.ipcMain.handle("config:setDataDir", async (_event, newDir) => {
    const oldDir = appConfig2.getDataDir();
    noteService.cleanup();
    syncService.cleanup();
    fileManager.clearCache();
    searchService.clearCache();
    trashService.clearCache();
    encryption.lock();
    const result = await appConfig2.migrateData(oldDir, newDir);
    return result;
  });
  electron.ipcMain.handle("config:selectDataDir", async () => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await electron.dialog.showOpenDialog(win, {
      title: tr("选择数据存储目录"),
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: tr("选择此目录")
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle("config:inspectDataDir", async (_event, dir) => {
    return appConfig2.inspectDataDir(dir);
  });
  electron.ipcMain.handle("config:getAll", async () => {
    const security = appConfig2.getSecurityConfig();
    return {
      dataDir: appConfig2.getDataDir(),
      defaultDataDir: AppConfig.getDefaultDataDir(),
      configPath: AppConfig.getConfigPath(),
      theme: appConfig2.getTheme(),
      language: appConfig2.getLanguage(),
      sidebarWidth: appConfig2.getSidebarWidth(),
      autoLockMinutes: security.autoLockMinutes,
      lockOnMinimize: security.lockOnMinimize
    };
  });
  electron.ipcMain.handle("config:getSecurity", async () => appConfig2.getSecurityConfig());
  electron.ipcMain.handle("config:setSecurity", async (_event, config) => {
    return appConfig2.setSecurityConfig(config);
  });
  electron.ipcMain.handle("config:restartApp", async () => {
    await restartApp();
  });
  electron.ipcMain.handle("config:getTheme", async () => {
    return appConfig2.getTheme();
  });
  electron.ipcMain.handle("config:setTheme", async (_event, theme) => {
    appConfig2.setTheme(theme);
  });
  electron.ipcMain.handle("config:getLanguage", async () => appConfig2.getLanguage());
  electron.ipcMain.handle("config:setLanguage", async (_event, language) => {
    appConfig2.setLanguage(language);
    electron.ipcMain.emit("config:language-changed");
    for (const win of electron.BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send("config:language-changed");
    }
  });
  electron.ipcMain.handle("config:getSidebarWidth", async () => {
    return appConfig2.getSidebarWidth();
  });
  electron.ipcMain.handle("config:setSidebarWidth", async (_event, width) => {
    appConfig2.setSidebarWidth(width);
  });
  electron.ipcMain.handle("notes:list", async () => {
    return noteService.list();
  });
  electron.ipcMain.handle("notes:get", async (_event, id) => {
    return noteService.get(id);
  });
  electron.ipcMain.handle("notes:create", async (_event, directoryId, title) => {
    const note = noteService.create(directoryId, title);
    searchService.upsertNote(note.id);
    return note;
  });
  electron.ipcMain.handle("notes:update", async (_event, id, content) => {
    noteService.update(id, content);
    searchService.upsertNote(id);
  });
  electron.ipcMain.handle("notes:updateTitle", async (_event, id, title) => {
    noteService.updateTitle(id, title);
    searchService.upsertNote(id);
  });
  electron.ipcMain.handle("notes:delete", async (_event, id) => {
    trashService.trashNote(id);
    searchService.removeNote(id);
  });
  electron.ipcMain.handle("notes:move", async (_event, id, targetDirectoryId) => {
    noteService.move(id, targetDirectoryId);
    searchService.upsertNote(id);
  });
  const exportNoteWithImages = (noteId, targetDir) => {
    const note = noteService.get(noteId);
    let content = migrateLegacyBrandReferences(note.content);
    const imageRegex = /!\[([^\]]*)\]\(arknote:\/\/([^)]+)\)/g;
    const matches = [...content.matchAll(imageRegex)];
    if (matches.length > 0) {
      const imagesDir = path.join(targetDir, "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      for (const match of matches) {
        const imageId = match[2];
        try {
          const imageData = fileManager.readImage(imageId);
          if (imageData) {
            const files = fs.readdirSync(fileManager.imagesDir);
            const imageFile = files.find((f) => f.startsWith(imageId));
            const ext = imageFile ? imageFile.replace(imageId, "").replace(".enc", "") : ".png";
            const imageFileName = `${imageId}${ext}`;
            fs.writeFileSync(path.join(imagesDir, imageFileName), imageData);
            content = content.replace(match[0], `![${match[1]}](./images/${imageFileName})`);
          }
        } catch (err) {
          console.error(`Failed to export image ${imageId}:`, err);
        }
      }
    }
    const safeName = note.metadata.title.replace(/[<>:"/\\|?*]/g, "_");
    const mdPath = path.join(targetDir, `${safeName}.md`);
    fs.writeFileSync(mdPath, content, "utf-8");
  };
  electron.ipcMain.handle("notes:download", async (_event, id) => {
    const note = noteService.get(id);
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return;
    const result = await electron.dialog.showSaveDialog(win, {
      title: tr("下载笔记"),
      defaultPath: `${note.metadata.title}.md`,
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });
    if (!result.canceled && result.filePath) {
      const targetDir = path.dirname(result.filePath);
      exportNoteWithImages(id, targetDir);
    }
  });
  electron.ipcMain.handle("notes:batchExport", async (_event, directoryId) => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, message: "窗口未找到" };
    const result = await electron.dialog.showOpenDialog(win, {
      title: tr("选择导出目录"),
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: tr("导出到此目录")
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "已取消" };
    }
    const exportRoot = result.filePaths[0];
    try {
      const allDirs = directoryService.list();
      const allNotes = noteService.list();
      const getDirPath = (dirId) => {
        const parts = [];
        let currentId = dirId;
        while (currentId) {
          const dir = allDirs.find((d) => d.id === currentId);
          if (!dir) break;
          parts.unshift(dir.name.replace(/[<>:"/\\|?*]/g, "_"));
          currentId = dir.parentId;
        }
        return parts.join(path.sep);
      };
      let dirsToExport;
      if (directoryId) {
        const getDescendantIds = (parentId) => {
          const children = allDirs.filter((d) => d.parentId === parentId);
          const ids = [parentId];
          for (const child of children) {
            ids.push(...getDescendantIds(child.id));
          }
          return ids;
        };
        const dirIds = new Set(getDescendantIds(directoryId));
        dirsToExport = allDirs.filter((d) => dirIds.has(d.id));
      } else {
        dirsToExport = allDirs;
      }
      let exportedCount = 0;
      for (const dir of dirsToExport) {
        const dirPath = path.join(exportRoot, getDirPath(dir.id));
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        const dirNotes = allNotes.filter((n) => n.directoryId === dir.id);
        for (const noteMeta of dirNotes) {
          exportNoteWithImages(noteMeta.id, dirPath);
          exportedCount++;
        }
      }
      return {
        success: true,
        message: `导出完成！共导出 ${exportedCount} 篇笔记到 ${exportRoot}`
      };
    } catch (error) {
      return {
        success: false,
        message: `导出失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });
  electron.ipcMain.handle("notes:exportPdf", async (_event, id, htmlContent) => {
    const note = noteService.get(id);
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return;
    const result = await electron.dialog.showSaveDialog(win, {
      title: tr("导出为PDF"),
      defaultPath: `${note.metadata.title}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });
    if (!result.canceled && result.filePath) {
      await pdfService.exportToPdf(htmlContent, result.filePath);
    }
  });
  electron.ipcMain.handle("directories:list", async () => {
    return directoryService.list();
  });
  electron.ipcMain.handle("directories:create", async (_event, parentId, name) => {
    return directoryService.create(parentId, name);
  });
  electron.ipcMain.handle("directories:rename", async (_event, id, name) => {
    directoryService.rename(id, name);
  });
  electron.ipcMain.handle("directories:delete", async (_event, id) => {
    trashService.trashDirectory(id);
    return true;
  });
  electron.ipcMain.handle("directories:getLevel", async (_event, id) => {
    return directoryService.getLevelById(id);
  });
  electron.ipcMain.handle("tags:list", async () => {
    return tagService.list();
  });
  electron.ipcMain.handle("tags:create", async (_event, name, color) => {
    return tagService.create(name, color);
  });
  electron.ipcMain.handle("tags:delete", async (_event, id) => {
    return tagService.delete(id);
  });
  electron.ipcMain.handle("tags:assign", async (_event, noteId, tagIds) => {
    tagService.assign(noteId, tagIds);
  });
  electron.ipcMain.handle("tags:getNotesForTag", async (_event, tagId) => {
    return tagService.getNotesForTag(tagId);
  });
  electron.ipcMain.handle("versions:list", async (_event, noteId) => {
    return versionService.list(noteId);
  });
  electron.ipcMain.handle("versions:get", async (_event, noteId, timestamp) => {
    return versionService.get(noteId, timestamp);
  });
  electron.ipcMain.handle("versions:save", async (_event, noteId) => {
    versionService.save(noteId);
  });
  electron.ipcMain.handle("search:global", async (_event, query, directoryIds, totalLimit) => {
    return searchService.global(query, directoryIds, totalLimit);
  });
  electron.ipcMain.handle("search:inNote", async (_event, noteId, query) => {
    return searchService.inNote(noteId, query);
  });
  electron.ipcMain.handle("images:save", async (_event, _noteId, imageDataBase64, fileName) => {
    const ext = path.extname(fileName) || ".png";
    const imageData = Buffer.from(imageDataBase64, "base64");
    const imageId = fileManager.saveImage(imageData, ext);
    return imageId;
  });
  electron.ipcMain.handle("images:get", async (_event, imageId) => {
    const imageData = fileManager.readImage(imageId);
    if (!imageData) return null;
    const mimeType = fileManager.getImageMimeType(imageId);
    return `data:${mimeType};base64,${imageData.toString("base64")}`;
  });
  electron.ipcMain.handle("images:selectAndSave", async (_event, _noteId) => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await electron.dialog.showOpenDialog(win, {
      title: tr("选择图片"),
      filters: [
        { name: tr("图片"), extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] }
      ],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath);
    const imageData = fs.readFileSync(filePath);
    const imageId = fileManager.saveImage(imageData, ext);
    return imageId;
  });
  electron.ipcMain.handle("trash:list", async () => {
    return trashService.list();
  });
  electron.ipcMain.handle("trash:restore", async (_event, id, type) => {
    if (type === "note") {
      trashService.restoreNote(id);
      searchService.upsertNote(id);
    } else {
      trashService.restoreDirectory(id);
      const notes = noteService.list();
      for (const note of notes) {
        searchService.upsertNote(note.id);
      }
    }
  });
  electron.ipcMain.handle("trash:deletePermanently", async (_event, id, type) => {
    if (type === "note") {
      trashService.deletePermanentlyNote(id);
    } else {
      trashService.deletePermanentlyDirectory(id);
    }
  });
  electron.ipcMain.handle("trash:empty", async () => {
    trashService.emptyTrash();
  });
  electron.ipcMain.handle("trash:getNoteContent", async (_event, noteId) => {
    return trashService.getNoteContent(noteId);
  });
  electron.ipcMain.handle("trash:listVersions", async (_event, noteId) => {
    return trashService.listVersions(noteId);
  });
  electron.ipcMain.handle("trash:getVersion", async (_event, noteId, timestamp) => {
    return trashService.getVersion(noteId, timestamp);
  });
  electron.ipcMain.handle("import:importMd", async (_event, directoryId) => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, message: "窗口未找到" };
    const result = await electron.dialog.showOpenDialog(win, {
      title: tr("导入 Markdown 文件"),
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "txt"] }
      ],
      properties: ["openFile", "multiSelections"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "已取消" };
    }
    try {
      let lastNoteId = "";
      for (const filePath of result.filePaths) {
        const note = importService.importMdFile(filePath, directoryId, appConfig2.getLanguage());
        searchService.upsertNote(note.id);
        lastNoteId = note.id;
      }
      return {
        success: true,
        noteId: lastNoteId,
        message: `成功导入 ${result.filePaths.length} 个文件`
      };
    } catch (error) {
      return {
        success: false,
        message: `导入失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });
  electron.ipcMain.handle("import:importPdf", async (_event, directoryId) => {
    const win = electron.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, message: "窗口未找到" };
    const result = await electron.dialog.showOpenDialog(win, {
      title: tr("导入 PDF 文件"),
      filters: [
        { name: tr("PDF 文件"), extensions: ["pdf", "PDF"] },
        { name: tr("所有文件"), extensions: ["*"] }
      ],
      properties: ["openFile", "multiSelections"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: "已取消" };
    }
    try {
      let lastNoteId = "";
      for (const filePath of result.filePaths) {
        const note = await importService.importPdfFile(filePath, directoryId, appConfig2.getLanguage());
        searchService.upsertNote(note.id);
        lastNoteId = note.id;
      }
      return {
        success: true,
        noteId: lastNoteId,
        message: `成功导入 ${result.filePaths.length} 个 PDF 文件`
      };
    } catch (error) {
      return {
        success: false,
        message: `导入失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });
  electron.ipcMain.handle("sync:configure", async (_event, config) => {
    fileManager.updateSyncConfig(config);
    await syncService.configure(config);
  });
  electron.ipcMain.handle("sync:auto-response", async (_event, response) => {
    settleAutoSyncRequest(response.ok);
  });
  electron.ipcMain.handle("sync:getConfig", async () => {
    return syncService.getConfig() || {
      enabled: false,
      provider: "git",
      repoUrl: "",
      branch: "main",
      ossEndpoint: "",
      ossBucket: "",
      ossAccessKey: "",
      ossSecretKey: "",
      ossRegion: "",
      autoSync: false,
      syncInterval: 30
    };
  });
  electron.ipcMain.handle("sync:run", async () => {
    const result = await syncService.sync();
    if (result.status === "success") {
      reloadDataCaches();
    }
    return result;
  });
  electron.ipcMain.handle("sync:getStatus", async () => {
    return await syncService.getStatus();
  });
  electron.ipcMain.handle("sync:resolveConflicts", async (_event, resolutions) => {
    const result = await syncService.resolveConflicts(resolutions);
    if (result.status === "success") {
      reloadDataCaches();
    }
    return result;
  });
  return {
    lockVault,
    cleanup: () => {
      lockVault();
    }
  };
}
const INITIAL_CHECK_DELAY_MS = 12e3;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1e3;
class UpdateService {
  constructor(beforeInstall) {
    __publicField(this, "state", {
      phase: "idle",
      currentVersion: electron.app.getVersion(),
      availableVersion: null,
      progress: null,
      message: "尚未检查更新",
      checkedAt: null
    });
    __publicField(this, "initialCheckTimer", null);
    __publicField(this, "checkInterval", null);
    __publicField(this, "started", false);
    this.beforeInstall = beforeInstall;
    electronUpdater.autoUpdater.autoDownload = false;
    electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
    electronUpdater.autoUpdater.allowPrerelease = false;
  }
  registerIpcHandlers() {
    electron.ipcMain.handle("updates:getState", () => this.getState());
    electron.ipcMain.handle("updates:check", () => this.checkForUpdates());
    electron.ipcMain.handle("updates:download", () => this.downloadUpdate());
    electron.ipcMain.handle("updates:install", () => this.installUpdate());
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.registerUpdaterEvents();
    const unsupportedReason = this.getUnsupportedReason();
    if (unsupportedReason) {
      this.setState({ phase: "disabled", message: unsupportedReason });
      return;
    }
    this.initialCheckTimer = setTimeout(() => {
      void this.checkForUpdates();
    }, INITIAL_CHECK_DELAY_MS);
    this.checkInterval = setInterval(() => {
      void this.checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }
  cleanup() {
    if (this.initialCheckTimer) clearTimeout(this.initialCheckTimer);
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.initialCheckTimer = null;
    this.checkInterval = null;
  }
  getState() {
    return { ...this.state };
  }
  async checkForUpdates() {
    const unsupportedReason = this.getUnsupportedReason();
    if (unsupportedReason) {
      this.setState({ phase: "disabled", message: unsupportedReason });
      return this.getState();
    }
    if (this.state.phase === "checking" || this.state.phase === "downloading") {
      return this.getState();
    }
    this.setState({ phase: "checking", message: "正在检查 GitHub Release..." });
    try {
      await electronUpdater.autoUpdater.checkForUpdates();
    } catch (error) {
      this.setError(error, "检查更新失败");
    }
    return this.getState();
  }
  async downloadUpdate() {
    if (this.state.phase !== "available") return this.getState();
    this.setState({ phase: "downloading", progress: 0, message: "正在下载更新..." });
    try {
      await electronUpdater.autoUpdater.downloadUpdate();
    } catch (error) {
      this.setError(error, "下载更新失败");
    }
    return this.getState();
  }
  async installUpdate() {
    if (this.state.phase !== "downloaded") return false;
    if (!await this.beforeInstall()) return false;
    electronUpdater.autoUpdater.quitAndInstall(false, true);
    return true;
  }
  registerUpdaterEvents() {
    electronUpdater.autoUpdater.on("checking-for-update", () => {
      this.setState({ phase: "checking", message: "正在检查 GitHub Release..." });
    });
    electronUpdater.autoUpdater.on("update-available", (info) => {
      this.setState({
        phase: "available",
        availableVersion: info.version,
        progress: null,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: `发现新版本 ${info.version}`
      });
    });
    electronUpdater.autoUpdater.on("update-not-available", () => {
      this.setState({
        phase: "not-available",
        availableVersion: null,
        progress: null,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: "当前已是最新版本"
      });
    });
    electronUpdater.autoUpdater.on("download-progress", (progress) => {
      const percent = Math.max(0, Math.min(100, progress.percent));
      this.setState({
        phase: "downloading",
        progress: percent,
        message: `正在下载更新 ${Math.round(percent)}%`
      });
    });
    electronUpdater.autoUpdater.on("update-downloaded", (info) => {
      this.setState({
        phase: "downloaded",
        availableVersion: info.version,
        progress: 100,
        message: `版本 ${info.version} 已下载，重启后安装`
      });
    });
    electronUpdater.autoUpdater.on("error", (error) => {
      this.setError(error, "自动更新失败");
    });
  }
  getUnsupportedReason() {
    if (!electron.app.isPackaged) return "开发环境不执行自动更新";
    if (process.platform === "linux" && !process.env.APPIMAGE) {
      return "当前 Linux 安装格式不支持应用内更新，请从 GitHub Release 更新";
    }
    return null;
  }
  setError(error, prefix) {
    const detail = error instanceof Error ? error.message : String(error);
    this.setState({
      phase: "error",
      progress: null,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: `${prefix}: ${detail}`
    });
  }
  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const window of electron.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("updates:state-changed", this.getState());
      }
    }
  }
}
const APP_ID = "com.arknote.app";
const LINUX_WM_CLASS = "ark-note";
if (process.platform === "win32") {
  electron.app.setAppUserModelId(APP_ID);
}
if (process.platform === "linux") {
  electron.app.commandLine.appendSwitch("class", LINUX_WM_CLASS);
}
const appConfig = new AppConfig();
let mainWindow = null;
let tray = null;
let ipcController = null;
let updateService = null;
let isQuitting = false;
let pendingQuitResolver = null;
async function lockVaultForBackground() {
  if (!appConfig.getSecurityConfig().lockOnMinimize) return true;
  if (!await requestRendererFlush("lock")) return false;
  ipcController == null ? void 0 : ipcController.lockVault();
  mainWindow == null ? void 0 : mainWindow.webContents.send("auth:locked");
  return true;
}
function getIconPath(size) {
  const fileName = size ? `${size}x${size}.png` : process.platform === "win32" ? "icon.ico" : "512x512.png";
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "icons", fileName);
  }
  if (fileName === "icon.ico") {
    return path.join(electron.app.getAppPath(), "public", fileName);
  }
  return path.join(electron.app.getAppPath(), "build", "icons", fileName);
}
function loadIcon(size) {
  const iconPath = getIconPath(size);
  const icon = electron.nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error(`Failed to load application icon: ${iconPath}`);
  }
  return icon;
}
async function requestRendererFlush(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true;
  }
  const approved = await new Promise((resolve) => {
    pendingQuitResolver = resolve;
    mainWindow == null ? void 0 : mainWindow.webContents.send("window:quit-requested");
    setTimeout(() => {
      if (pendingQuitResolver) {
        const action = reason === "restart" ? "Restart" : reason === "lock" ? "Background lock" : "Tray quit";
        console.warn(`${action} flush timeout, ${reason === "lock" ? "cancelling lock" : `forcing ${reason}`}`);
        pendingQuitResolver = null;
        resolve(reason !== "lock");
      }
    }, 1e4);
  });
  if (!approved) {
    const action = reason === "restart" ? "Restart" : reason === "lock" ? "Background lock" : "Tray quit";
    console.warn(`${action} cancelled because pending saves could not be flushed`);
  }
  return approved;
}
function createWindow() {
  const bounds = appConfig.getWindowBounds();
  electron.Menu.setApplicationMenu(null);
  const windowIcon = loadIcon();
  mainWindow = new electron.BrowserWindow({
    width: (bounds == null ? void 0 : bounds.width) || 1400,
    height: (bounds == null ? void 0 : bounds.height) || 900,
    x: bounds == null ? void 0 : bounds.x,
    y: bounds == null ? void 0 : bounds.y,
    minWidth: 900,
    minHeight: 600,
    title: "arkNote",
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    // Frameless + no shadow for pure custom window
    frame: false,
    titleBarStyle: "default",
    hasShadow: false,
    backgroundColor: "#00000000",
    transparent: false,
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void electron.shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.on("close", (e) => {
    if (mainWindow) {
      const bounds2 = mainWindow.getBounds();
      appConfig.setWindowBounds(bounds2);
    }
    if (isQuitting) return;
    const closeAction = appConfig.getCloseAction();
    if (closeAction === "minimize") {
      e.preventDefault();
      void lockVaultForBackground().then((locked) => {
        if (locked) mainWindow == null ? void 0 : mainWindow.hide();
      });
      return;
    }
    if (closeAction === "quit") {
      return;
    }
    e.preventDefault();
    mainWindow == null ? void 0 : mainWindow.webContents.send("window:close-requested");
    setTimeout(() => {
      if (mainWindow && !isQuitting) {
        console.warn("Close dialog timeout, forcing quit");
        isQuitting = true;
        electron.app.quit();
      }
    }, 1e4);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.on("minimize", () => {
    void lockVaultForBackground().then((locked) => {
      if (!locked) {
        mainWindow == null ? void 0 : mainWindow.restore();
        mainWindow == null ? void 0 : mainWindow.show();
      }
    });
  });
  mainWindow.on("maximize", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("window:maximized-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("window:maximized-changed", false);
  });
}
async function requestQuitFromRenderer() {
  if (!await requestRendererFlush("quit")) {
    return;
  }
  isQuitting = true;
  electron.app.quit();
}
async function requestRestartFromRenderer() {
  if (!await requestRendererFlush("restart")) {
    return;
  }
  isQuitting = true;
  electron.app.relaunch();
  electron.app.exit(0);
}
function createTray() {
  const iconSize = process.platform === "linux" ? 24 : 16;
  const trayIcon = loadIcon(iconSize);
  tray = new electron.Tray(trayIcon);
  tray.setToolTip("arkNote");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: translate(appConfig.getLanguage(), "显示窗口"),
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: translate(appConfig.getLanguage(), "退出"),
      click: () => {
        void requestQuitFromRenderer();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
function registerImageProtocol() {
  electron.protocol.registerBufferProtocol("arknote", async (_request, callback) => {
    try {
      callback({ statusCode: 404 });
    } catch {
      callback({ statusCode: 500 });
    }
  });
}
function registerWindowIpc() {
  electron.ipcMain.handle("window:minimize", () => {
    mainWindow == null ? void 0 : mainWindow.minimize();
  });
  electron.ipcMain.handle("window:maximize", () => {
    if (mainWindow == null ? void 0 : mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow == null ? void 0 : mainWindow.maximize();
    }
  });
  electron.ipcMain.handle("window:isMaximized", () => {
    return (mainWindow == null ? void 0 : mainWindow.isMaximized()) ?? false;
  });
  electron.ipcMain.handle("window:close-action", async (_event, action, remember) => {
    if (remember) {
      appConfig.setCloseAction(action);
    }
    if (action === "minimize") {
      if (await lockVaultForBackground()) {
        mainWindow == null ? void 0 : mainWindow.hide();
      }
    } else {
      isQuitting = true;
      mainWindow == null ? void 0 : mainWindow.close();
    }
  });
  electron.ipcMain.handle("window:get-close-action", () => {
    return appConfig.getCloseAction();
  });
  electron.ipcMain.handle("window:quit-response", (_event, response) => {
    if (pendingQuitResolver) {
      const resolver = pendingQuitResolver;
      pendingQuitResolver = null;
      resolver(response.ok);
    }
  });
  electron.ipcMain.handle("window:set-close-action", (_event, action) => {
    appConfig.setCloseAction(action);
  });
  electron.ipcMain.handle("window:openExternal", async (_event, url) => {
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      await electron.shell.openExternal(url);
    }
  });
  electron.ipcMain.on("config:language-changed", () => {
    tray == null ? void 0 : tray.destroy();
    tray = null;
    createTray();
  });
}
electron.app.whenReady().then(() => {
  const dataDir = appConfig.getDataDir();
  ipcController = registerIpcHandlers(dataDir, appConfig, requestRestartFromRenderer);
  registerWindowIpc();
  updateService = new UpdateService(async () => {
    if (!await requestRendererFlush("restart")) return false;
    isQuitting = true;
    return true;
  });
  updateService.registerIpcHandlers();
  registerImageProtocol();
  createTray();
  createWindow();
  updateService.start();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow == null ? void 0 : mainWindow.show();
    }
  });
});
electron.app.on("window-all-closed", () => {
  ipcController == null ? void 0 : ipcController.cleanup();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  isQuitting = true;
  updateService == null ? void 0 : updateService.cleanup();
  ipcController == null ? void 0 : ipcController.cleanup();
});
