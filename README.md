# 鹈鹕实验室 · Pelican Model Lab

粘贴模型回答，提取并渲染 SVG / HTML，保存完整原文，方便回看和并排观察。**不评分，也不自动判定模型能力。**

## 已实现

- 实验台：默认提示词 `Generate an SVG of a pelican riding a bicycle`，记录模型名称、提示词与完整回答。
- 自动提取 Markdown 代码块、独立 SVG、完整 HTML 和常见 HTML 片段；不包含图形的回答也能作为文本记录保存。
- SVG / HTML 隔离预览、提取代码下载、原始回答复制和下载。
- Cloudflare D1 保存记录，按 ChatGPT 登录用户隔离；刷新页面或更换浏览器后可读取同一账号的数据。
- 搜索、格式筛选、2–3 条记录并排查看、单条详情和删除确认。
- JSON 备份导入 / 导出；按记录 ID 去重，导入不会覆盖已有记录。
- 当前标签页的未保存草稿暂存于 sessionStorage。正式记录保存在数据库，不依赖浏览器存储。
- 中文界面、桌面 / 手机布局和项目图标。

示例鹈鹕由手工编写，用于试用渲染器，**不是模型生成结果**，不会自动加入测试记录。

## 本地开发

需要 Git 和 Node.js（建议 24，最低 22.13）。

```sh
git clone https://github.com/zhaifeicom-ui/pelican-model-lab.git
cd pelican-model-lab
npm ci
npm run build
```

首次启动前应用本地数据库迁移（新电脑上运行一次）：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tricky_baron_strucker.sql
npm run dev
```

打开终端打印的地址，默认 `http://127.0.0.1:5173/`。点击“登录保存记录”，本地预览将模拟测试用户 Seedy。模拟登录仅用于回环开发地址，不包含在生产构建中。

已有数据库只需要运行新增迁移，不要重复执行建表迁移。迁移和数据库说明见 [STARTER.md](STARTER.md)。本地数据库位于忽略的 `.wrangler/state` 中，与线上数据库独立。

## 验证

```sh
npm test
npx tsc --noEmit
npm run build
```

开发服务器启动后可运行实际接口检查：

```sh
npm run test:api
```

接口检查只针对 `127.0.0.1:5173`，验证登录要求、跨来源拒绝、格式校验、保存 / 读取、重复导入和删除。检查结束会清理它创建的测试记录。

## 预览和保存边界

- 预览使用没有任何额外权限的 sandbox iframe，并限制脚本、外部资源、表单和嵌入页面。依赖 JavaScript、CDN 或外部图片的结果可能无法完整展示；原始回答始终保留，不会因为预览处理而修改。
- 每个账号最多 200 条记录；模型名称最多 100 字符，提示词最多 10,000 字符，单次回答最多 250,000 字符；每个账号的模型名称、提示词和回答总内容最多 10 MB，导入文件最多 64 MB。导入会分批保存，失败后可以再次导入，已有记录不会重复。
- 代码提取使用第一个可识别的 SVG / HTML 结果，不执行模型回答中的命令。
- 本版本采用手动粘贴结果，不直接调用模型 API，不需要模型 API Key。
- 数据库异常会提示重试，并保留当前输入。备份导出包含原始回答，分享前请检查其中的内容。

## 项目结构

- `app/`：页面、样式、元信息与实验记录 API。
- `components/model-lab.tsx`：实验台、记录列表和比较交互。
- `components/output-preview.tsx`：隔离预览。
- `lib/experiments.ts`：记录校验、备份校验、代码提取和预览文档生成。
- `db/`、`drizzle/`：数据库结构与迁移。
- `tests/`：提取 / 备份测试与本地接口验证。
- `build/`、`scripts/`：开发与 Cloudflare Worker 构建支持。
- `.openai/hosting.json`：已有 Sites 项目标识和逻辑 DB 绑定，不包含凭据。

生产发布会应用提交的 D1 迁移，并使用平台提供的登录身份。项目保留原有 Sites 项目与访问范围，不建立新的项目，也不自动将访问范围改为公开。

依赖、生成文件、本地数据库状态和环境变量均由 `.gitignore` 排除。不要提交 API Key、凭据或真实测试中的敏感内容。

鹈鹕测试参考：[Simon Willison 的原始文章](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/)。

