# 鹈鹕实验室 · Pelican Model Lab

用于展示每次模型测试的输出：粘贴回答，渲染 SVG 或 HTML，保存原始内容，方便比较。

**不做评分或自动判定模型能力。**

## 当前进度

已初始化项目骨架并安装依赖。渲染页面、测试记录等产品功能尚未实现；网站尚未部署。

## 换电脑继续开发

安装 Git 和 Node.js（建议 Node.js 24，最低 22.13），然后运行：

```sh
git clone https://github.com/zhaifeicom-ui/pelican-model-lab.git
cd pelican-model-lab
npm ci
npm run dev
```

打开终端打印的本地地址，默认端口为 5173。

```sh
npm run build
```

## 后续实现方向

- 默认提示词：`Generate an SVG of a pelican riding a bicycle`
- 粘贴模型输出，提取并渲染 SVG / HTML。
- 每次测试记录模型名称、提示词、原始输出和时间。
- 在页面中展示各次结果，不评分。

鹈鹕测试参考：[Simon Willison 的原始文章](https://simonwillison.net/2024/Oct/25/pelicans-on-a-bicycle/)。

## 项目结构

- `app/`：页面与界面样式。
- `db/`、`drizzle/`：数据库和迁移骨架，目前未启用。
- `build/`、`scripts/`：开发与 Cloudflare Worker 构建支持。
- `.openai/hosting.json`：已登记的 Sites 项目标识，不包含凭据。

运行生成的文件、依赖、数据库本地状态和环境变量均由 `.gitignore` 排除。不要提交 API Key 或测试中的敏感内容。

框架和托管的详细说明见 [STARTER.md](STARTER.md)。

