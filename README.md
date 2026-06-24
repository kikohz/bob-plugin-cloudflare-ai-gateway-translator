# Cloudflare AI Gateway 翻译 · Bob 插件

通过 [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) 的 OpenAI 兼容统一端点（`/compat/chat/completions`），用一套配置调用 OpenAI、Anthropic、Google、Workers AI 等多家大模型，在 [Bob](https://bobtranslate.com/) 中实现**翻译 + 润色 + 语法纠错**，支持流式输出。

参考自 [bob-plugin-openai-translator](https://github.com/openai-translator/bob-plugin-openai-translator)。

## 功能

- **翻译**：源语言与目标语言不同时，进行高质量机器翻译。
- **润色**：把目标语言设置为与源语言一致时，自动改写为更流畅地道的表达（同语言模式选 `润色`）。
- **语法纠错**：同语言模式选 `语法纠错`，只纠正语法/拼写/标点。
- **流式输出**：逐字显示结果，可在设置中关闭。
- **多模型**：只改 `模型` 一项即可切换厂商，无需改其它配置。

## 安装

1. 安装 [Bob](https://bobtranslate.com/guide/#%E5%AE%89%E8%A3%85)（版本 ≥ 1.8.0）。
2. 双击 `cloudflare-ai-gateway-translator.bobplugin` 安装。
3. 打开 Bob 偏好设置 → 服务 → 找到「Cloudflare AI Gateway 翻译」，填写配置。

## 配置

| 设置项 | 是否必填 | 说明 |
| --- | --- | --- |
| Account ID | ✅ | Cloudflare 账户 ID。 |
| Gateway 名称 | - | AI Gateway 名称，默认 `default`（首次请求自动创建）。 |
| CF AIG Token | BYOK 时必填 | Cloudflare AI Gateway 的鉴权 Token，作为 `cf-aig-authorization` 头发送。 |
| Provider API Key | 非 BYOK 时必填 | 底层模型厂商的 API Key，作为 `Authorization` 头发送。已用 BYOK 存储密钥时留空。 |
| 模型 | - | Workers AI 模型直接填 `@cf/...`（自动补 `workers-ai/`），默认 `@cf/qwen/qwen3-30b-a3b-fp8`。其它厂商用 `{provider}/{model}`。 |
| 温度 | - | 采样温度，默认 `0.2`。 |
| 流式输出 | - | 默认开启。 |
| 同语言模式 | - | `润色` 或 `语法纠错`，默认润色。 |
| 自定义系统/用户提示词 | - | 可覆盖内置提示词，支持变量 `$text`、`$sourceLang`、`$targetLang`。 |

> CF AIG Token 与 Provider API Key 至少填一个：
> - **已在 Cloudflare 后台存储了厂商密钥（BYOK）**：只填 CF AIG Token。
> - **未存储厂商密钥**：填 Provider API Key（若 Gateway 同时开启了鉴权，则两者都填）。

### 如何获取 Account ID 与 Gateway

登录 [Cloudflare 控制台](https://dash.cloudflare.com/) → AI → AI Gateway。Account ID 可在端点 URL 中看到：

```
https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_NAME>/compat/chat/completions
```

### 常用模型示例

| provider | model 填写示例 |
| --- | --- |
| Workers AI | `@cf/qwen/qwen3-30b-a3b-fp8`、`@cf/meta/llama-3.1-8b-instruct-fp8-fast`（自动补 `workers-ai/`） |
| Google | `google/gemini-2.5-flash`、`google/gemini-2.5-pro` |
| OpenAI | `openai/gpt-4o-mini` |
| Anthropic | `anthropic/claude-3-5-haiku` |
| xAI | `grok/grok-4` |
| DeepSeek | `deepseek/deepseek-chat` |

> 💡 **Workers AI 模型直接填 `@cf/...` 即可**，插件会自动加 `workers-ai/` 前缀。其它厂商必须带 provider 前缀（如 `openai/`、`google/`），否则会报 `Invalid provider (HTTP 400)`。
>
> 💡 **Qwen3、DeepSeek-R1 等推理模型**：插件会自动加 `/no_think` 关闭思考，并过滤掉残留的 `<think>...</think>` 内容，保证译文干净。

> ⚠️ **provider 前缀以 `/compat` 端点为准**：Google 用 `google`（不是 `google-ai-studio`），xAI 用 `grok`（不是 `xai`）。Cloudflare 文档参数说明里的 `google-ai-studio` 是给「provider 原生端点」用的，填到统一端点会报 `Invalid provider (HTTP 400)`。支持的厂商以 [Cloudflare 文档示例](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/#examples) 为准。

## 工作原理

插件向以下端点发送 OpenAI 兼容的 Chat Completions 请求：

```
POST https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/compat/chat/completions
```

请求头携带 `cf-aig-authorization`（CF AIG Token）和/或 `Authorization`（Provider Key），请求体使用标准 `messages` 结构，开启 `stream` 时按 SSE 解析增量内容并回调给 Bob。

## 开发与打包

插件为纯 JavaScript（运行在 Bob 的 JavaScriptCore 环境，非 Node/浏览器）。打包：将 `info.json`、`main.js` 等文件压缩为 zip，并将后缀改为 `.bobplugin`。

```bash
cd cloudflare-ai-gateway-translator
zip -r ../cloudflare-ai-gateway-translator.bobplugin info.json main.js README.md appcast.json
```

## 许可证

CC BY-NC-SA 4.0
