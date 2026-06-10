# 招聘助手浏览器扩展

一个非官方的 Chrome Manifest V3 扩展，用于在 BOSS 直聘网页中辅助招聘沟通流程。扩展运行在本地浏览器内，支持候选人列表处理、简历评级、话术模板、运行记录和诊断日志等能力。

> 本项目不是 BOSS 直聘官方产品，也未与 BOSS 直聘存在任何授权、赞助或关联。使用者需要自行确认自己的使用方式符合目标网站服务条款、招聘合规要求和当地法律法规。

## 功能

- 在 Chrome 侧边栏中查看招聘账号、运行状态、列表级进度和今日记录。
- 支持候选人筛选、智能跟进、批量处理和处理日志下载。
- 支持自定义 AI 进行简历评级和话术生成。
- 支持招聘设置、话术模板、学校/公司筛选项和运行时长配置。
- 支持明亮/深色主题，以及隐藏的页面请求诊断日志。

## 安装

1. 克隆仓库：

   ```bash
   git clone https://github.com/LIBai11/boss-hr-ai-assistant.git
   cd boss-hr-ai-assistant
   ```

2. 打开 Chrome 的扩展管理页：

   ```text
   chrome://extensions
   ```

3. 开启“开发者模式”，点击“加载已解压的扩展程序”，选择本仓库根目录。

4. 打开 BOSS 直聘网页后，点击扩展图标或打开 Chrome 侧边栏使用。

## 开发与验证

本项目没有构建步骤，源码直接作为 MV3 扩展加载。需要 Node.js 18 或更高版本来运行测试。

```bash
npm test
npm run check:syntax
npm run verify
```

## 自定义 AI

扩展不内置 AI 服务。简历评级和话术生成只会调用用户在设置里填写的自定义 AI API。

需要配置：

- Base URL：自定义 AI 服务地址，必须使用 HTTPS。
- API Key：对应服务的密钥。
- Model：模型名称。
- 协议：默认自动识别，也可以在高级设置中指定 OpenAI 兼容、Anthropic 或 Gemini。

自定义 AI 可能会接收简历文本、候选人信息摘要、招聘话术上下文和用户填写的 Prompt。请只配置你信任的服务，并确认你有权把相关数据发送给该服务。

## 权限说明

`manifest.json` 中声明的权限用于以下场景：

- `tabs`、`activeTab`、`windows`：定位和操作当前 BOSS 直聘页面。
- `scripting`：在页面中执行必要的内容脚本，用于读取列表、简历和沟通状态。
- `alarms`：支持运行过程中的定时检查。
- `storage`：保存本地设置、运行状态、统计信息和自定义 AI 配置。
- `webNavigation`：感知页面跳转和刷新。
- `webRequest`：仅用于用户开启诊断时记录 BOSS 直聘页面请求状态，方便排查登录、跳转和接口异常。
- `downloads`：在用户开启后下载处理日志。
- `sidePanel`：提供 Chrome 侧边栏界面。
- `host_permissions`：限定访问 BOSS 直聘相关页面。
- `optional_host_permissions`：用于按需请求自定义 AI API 域名权限。默认不会访问所有 HTTPS 网站。

## 隐私说明

扩展会在本机浏览器中读取与招聘流程相关的页面内容，例如候选人列表、简历文本、沟通状态和处理记录。扩展会把设置、统计、运行记录和自定义 AI 配置保存在 `chrome.storage.local`。

当配置并使用自定义 AI 时，扩展会把简历评级和话术生成所需的文本发送到用户填写的 AI API。项目不提供、代理或内置任何第三方 AI 服务。

诊断日志可能包含请求 URL、状态码、响应头和经过脱敏的请求片段。请不要在 issue 中公开包含个人信息、Cookie、Token、API Key、简历原文或聊天内容的日志。

更多内容见 [PRIVACY.md](PRIVACY.md)。

## 安全

请通过 GitHub Issues 报告普通问题。涉及密钥泄露、隐私风险、权限误用或安全漏洞的问题，请按 [SECURITY.md](SECURITY.md) 中的方式处理。

## 许可证

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
