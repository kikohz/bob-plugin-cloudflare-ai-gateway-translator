//#region Constants

var HTTP_ERROR_CODES = {
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "429": "Too Many Requests",
  "500": "Internal Server Error",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout"
};

// Bob 语言代码 -> 用于提示词的语言名称
var LANGUAGE_NAMES = {
  "auto": "auto",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "yue": "Cantonese",
  "wyw": "Classical Chinese",
  "en": "English",
  "ja": "Japanese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
  "it": "Italian",
  "ru": "Russian",
  "pt": "Portuguese",
  "nl": "Dutch",
  "pl": "Polish",
  "ar": "Arabic",
  "af": "Afrikaans",
  "am": "Amharic",
  "az": "Azerbaijani",
  "be": "Belarusian",
  "bg": "Bulgarian",
  "bn": "Bengali",
  "bs": "Bosnian",
  "ca": "Catalan",
  "ceb": "Cebuano",
  "co": "Corsican",
  "cs": "Czech",
  "cy": "Welsh",
  "da": "Danish",
  "el": "Greek",
  "eo": "Esperanto",
  "et": "Estonian",
  "eu": "Basque",
  "fa": "Persian",
  "fi": "Finnish",
  "fj": "Fijian",
  "fy": "Frisian",
  "ga": "Irish",
  "gd": "Scottish Gaelic",
  "gl": "Galician",
  "gu": "Gujarati",
  "ha": "Hausa",
  "haw": "Hawaiian",
  "he": "Hebrew",
  "hi": "Hindi",
  "hmn": "Hmong",
  "hr": "Croatian",
  "ht": "Haitian Creole",
  "hu": "Hungarian",
  "hy": "Armenian",
  "id": "Indonesian",
  "ig": "Igbo",
  "is": "Icelandic",
  "jw": "Javanese",
  "ka": "Georgian",
  "kk": "Kazakh",
  "km": "Khmer",
  "kn": "Kannada",
  "ku": "Kurdish",
  "ky": "Kyrgyz",
  "la": "Latin",
  "lb": "Luxembourgish",
  "lo": "Lao",
  "lt": "Lithuanian",
  "lv": "Latvian",
  "mg": "Malagasy",
  "mi": "Maori",
  "mk": "Macedonian",
  "ml": "Malayalam",
  "mn": "Mongolian",
  "mr": "Marathi",
  "ms": "Malay",
  "mt": "Maltese",
  "my": "Burmese",
  "ne": "Nepali",
  "no": "Norwegian",
  "ny": "Chichewa",
  "or": "Odia",
  "pa": "Punjabi",
  "ps": "Pashto",
  "ro": "Romanian",
  "sd": "Sindhi",
  "si": "Sinhala",
  "sk": "Slovak",
  "sl": "Slovenian",
  "sm": "Samoan",
  "sn": "Shona",
  "so": "Somali",
  "sq": "Albanian",
  "sr-Cyrl": "Serbian (Cyrillic)",
  "sr-Latn": "Serbian (Latin)",
  "st": "Sesotho",
  "su": "Sundanese",
  "sv": "Swedish",
  "sw": "Swahili",
  "ta": "Tamil",
  "te": "Telugu",
  "tg": "Tajik",
  "th": "Thai",
  "tl": "Filipino",
  "tr": "Turkish",
  "uk": "Ukrainian",
  "ur": "Urdu",
  "uz": "Uzbek",
  "vi": "Vietnamese",
  "xh": "Xhosa",
  "yi": "Yiddish",
  "yo": "Yoruba",
  "zu": "Zulu"
};

//#endregion

//#region Required: supportLanguages

function supportLanguages() {
  return Object.keys(LANGUAGE_NAMES).filter(function (k) {
    return k !== "auto";
  });
}

//#endregion

//#region Helpers

function langName(code) {
  return LANGUAGE_NAMES[code] || code;
}

function ensureHttpsRemoved(value) {
  return ("" + value).replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function buildUrl(accountId, gatewayId) {
  var account = ("" + accountId).trim();
  var gateway = ("" + (gatewayId || "default")).trim() || "default";
  return (
    "https://gateway.ai.cloudflare.com/v1/" +
    account +
    "/" +
    gateway +
    "/compat/chat/completions"
  );
}

function buildHeader(apiKey, providerApiKey) {
  var header = { "Content-Type": "application/json" };
  if (apiKey && ("" + apiKey).trim()) {
    header["cf-aig-authorization"] = "Bearer " + ("" + apiKey).trim();
  }
  if (providerApiKey && ("" + providerApiKey).trim()) {
    header["Authorization"] = "Bearer " + ("" + providerApiKey).trim();
  }
  return header;
}

function replaceVars(template, vars) {
  return ("" + template)
    .replace(/\$text/g, vars.text)
    .replace(/\$sourceLang/g, vars.sourceLang)
    .replace(/\$targetLang/g, vars.targetLang);
}

var DEFAULT_MODEL = "workers-ai/@cf/qwen/qwen3-30b-a3b-fp8";

// 规范化模型名：以 @ 开头（@cf/ 或 @hf/）的是 Workers AI 模型，
// 自动补上 workers-ai/ 前缀；其它厂商（openai/、google/ 等）原样返回。
function normalizeModel(model) {
  var m = ("" + (model || "")).trim();
  if (!m) {
    return DEFAULT_MODEL;
  }
  if (m.charAt(0) === "@") {
    return "workers-ai/" + m;
  }
  return m;
}

// 是否为 Qwen3 这类带「思考」开关的模型
function isThinkingModel(normalizedModel) {
  return /qwen3/i.test(normalizedModel);
}

// 去除推理模型可能输出的 <think>...</think> 思考内容
function stripThink(text) {
  var t = "" + text;
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  var idx = t.indexOf("<think>");
  if (idx !== -1) {
    // 思考块尚未闭合，隐藏其后的全部内容
    t = t.slice(0, idx);
  }
  return t.replace(/^\s+/, "");
}

// 根据源/目标语言生成系统与用户提示词。
// 同语言 -> 润色或语法纠错；不同语言 -> 翻译。
function generatePrompts(query) {
  var option = $option || {};
  var sourceCode = query.detectFrom || query.from;
  var targetCode = query.detectTo || query.to;
  var sourceLang = langName(sourceCode);
  var targetLang = langName(targetCode);
  var text = query.text;

  var vars = { text: text, sourceLang: sourceLang, targetLang: targetLang };

  var system;
  var user;

  // 用户自定义提示词优先
  if (option.customSystemPrompt && option.customSystemPrompt.trim()) {
    system = replaceVars(option.customSystemPrompt, vars);
    user =
      option.customUserPrompt && option.customUserPrompt.trim()
        ? replaceVars(option.customUserPrompt, vars)
        : text;
  } else if (sourceCode === targetCode) {
    // 同语言模式
    var mode = option.polishMode || "polish";
    if (mode === "grammar") {
      system =
        "You are an expert grammar corrector. You correct grammar, spelling, and punctuation mistakes in the given text written in " +
        sourceLang +
        ". You only output the corrected text without any explanation, quotation marks, or additional commentary. Preserve the original meaning and tone. If the text is already correct, return it unchanged.";
      user =
        "Correct the grammar of the following text:\n\n" + text;
    } else {
      system =
        "You are an expert text polisher. You improve the fluency, clarity, and style of the given text written in " +
        sourceLang +
        " while preserving its original meaning. You only output the polished text without any explanation, quotation marks, or additional commentary.";
      user = "Polish the following text:\n\n" + text;
    }
  } else {
    // 翻译模式
    system =
      "You are a professional, authentic machine translation engine. You translate the text the user gives you from " +
      sourceLang +
      " into " +
      targetLang +
      ". You only output the translation result without any explanation, without quotation marks, and without repeating the original text. Keep the original formatting, line breaks, and any code or markup intact. Translate naturally and accurately.";
    user =
      "Translate the following text into " +
      targetLang +
      ":\n\n" +
      text;
  }

  // Qwen3 等模型默认会先「思考」再回答，翻译场景用 /no_think 关掉
  if (isThinkingModel(normalizeModel(option.model))) {
    system += " /no_think";
  }

  return { system: system, user: user };
}

function buildBody(query, isStream) {
  var option = $option || {};
  var prompts = generatePrompts(query);
  var temperature = parseFloat(option.temperature);
  if (isNaN(temperature)) {
    temperature = 0.2;
  }
  return {
    model: normalizeModel(option.model),
    temperature: temperature,
    stream: !!isStream,
    messages: [
      { role: "system", content: prompts.system },
      { role: "user", content: prompts.user }
    ]
  };
}

function buildError(reason, message, type, addition) {
  return {
    type: type || "api",
    message: "Cloudflare AI Gateway: " + message,
    addition: addition,
    troubleshootingLink:
      "https://developers.cloudflare.com/ai-gateway/usage/chat-completion/"
  };
}

// 检查配置完整性，返回 service error 或 null
function validateOptions() {
  var option = $option || {};
  if (!option.accountId || !("" + option.accountId).trim()) {
    return buildError(
      "param",
      "请在插件设置中填写 Cloudflare Account ID。",
      "secretKey"
    );
  }
  if (
    (!option.apiKey || !("" + option.apiKey).trim()) &&
    (!option.providerApiKey || !("" + option.providerApiKey).trim())
  ) {
    return buildError(
      "secretKey",
      "请填写 CF AIG Token，或（非 BYOK 时）填写 Provider API Key。",
      "secretKey"
    );
  }
  return null;
}

// 解析 OpenAI 兼容的错误响应
function parseApiError(resp) {
  var data = resp && resp.data;
  var statusCode =
    resp && resp.response && resp.response.statusCode
      ? resp.response.statusCode
      : 0;
  var message = HTTP_ERROR_CODES["" + statusCode] || "请求失败";
  if (data) {
    if (typeof data === "string") {
      message = data;
    } else if (data.error && data.error.message) {
      message = data.error.message;
    } else if (data.message) {
      message = data.message;
    } else if (data.errors && data.errors.length && data.errors[0].message) {
      message = data.errors[0].message;
    }
  }
  var type = "api";
  if (statusCode === 401 || statusCode === 403) {
    type = "secretKey";
  } else if (statusCode === 429) {
    type = "api";
  }
  return buildError(
    type,
    message + (statusCode ? " (HTTP " + statusCode + ")" : ""),
    type,
    typeof data === "object" ? JSON.stringify(data) : data
  );
}

//#endregion

//#region Streaming

// 解析流式 SSE 数据并回调
function handleStream(streamData, ctx) {
  ctx.buffer += streamData.text || "";
  // 按行处理 SSE：每条以 \n\n 分隔，行以 "data: " 开头
  while (true) {
    var lineEnd = ctx.buffer.indexOf("\n");
    if (lineEnd === -1) {
      break;
    }
    var line = ctx.buffer.slice(0, lineEnd).trim();
    ctx.buffer = ctx.buffer.slice(lineEnd + 1);

    if (line === "" || line.indexOf("data:") !== 0) {
      continue;
    }
    var payload = line.slice(5).trim();
    if (payload === "[DONE]") {
      ctx.done = true;
      continue;
    }
    var json;
    try {
      json = JSON.parse(payload);
    } catch (e) {
      continue;
    }
    try {
      var choice = json.choices && json.choices[0];
      if (!choice) {
        continue;
      }
      var delta = choice.delta || {};
      var piece = delta.content;
      if (piece) {
        ctx.result += piece;
        if (ctx.onStream) {
          var shown = stripThink(ctx.result);
          if (shown) {
            ctx.onStream({
              result: {
                from: ctx.from,
                to: ctx.to,
                toParagraphs: shown.split("\n")
              }
            });
          }
        }
      }
    } catch (e2) {
      // 忽略单条解析错误
    }
  }
}

//#endregion

//#region Required: translate

function translate(query) {
  var optionError = validateOptions();
  if (optionError) {
    query.onCompletion({ error: optionError });
    return;
  }

  var option = $option || {};
  var isStream = (option.stream || "enable") !== "disable";
  var url = buildUrl(option.accountId, option.gatewayId);
  var header = buildHeader(option.apiKey, option.providerApiKey);
  var body = buildBody(query, isStream);

  var from = query.detectFrom || query.from;
  var to = query.detectTo || query.to;

  if (!isStream) {
    // 非流式
    (async function () {
      try {
        var resp = await $http.request({
          method: "POST",
          url: url,
          header: header,
          body: body,
          cancelSignal: query.cancelSignal
        });
        var statusCode =
          resp.response && resp.response.statusCode
            ? resp.response.statusCode
            : 0;
        if (statusCode < 200 || statusCode >= 300) {
          query.onCompletion({ error: parseApiError(resp) });
          return;
        }
        var data = resp.data;
        if (data && data.error) {
          query.onCompletion({ error: parseApiError(resp) });
          return;
        }
        var content = "";
        try {
          content =
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content
              ? data.choices[0].message.content
              : "";
        } catch (e) {
          content = "";
        }
        content = stripThink(("" + content).trim()).trim();
        if (!content) {
          query.onCompletion({
            error: buildError("api", "模型未返回任何内容。", "api")
          });
          return;
        }
        query.onCompletion({
          result: {
            from: from,
            to: to,
            toParagraphs: content.split("\n")
          }
        });
      } catch (err) {
        query.onCompletion({
          error: buildError(
            "network",
            (err && (err.message || err.localizedDescription)) ||
              "网络请求失败",
            "network"
          )
        });
      }
    })();
    return;
  }

  // 流式
  var ctx = {
    buffer: "",
    result: "",
    done: false,
    from: from,
    to: to,
    onStream: query.onStream
  };

  $http.streamRequest({
    method: "POST",
    url: url,
    header: header,
    body: body,
    cancelSignal: query.cancelSignal,
    streamHandler: function (streamData) {
      try {
        handleStream(streamData, ctx);
      } catch (e) {
        // 单次回调出错不致命
      }
    },
    handler: function (resp) {
      var statusCode =
        resp.response && resp.response.statusCode
          ? resp.response.statusCode
          : 0;
      if (resp.error) {
        // 流式请求出现网络错误
        var partial = stripThink(("" + ctx.result).trim()).trim();
        if (partial) {
          // 已有部分结果，直接给出
          query.onCompletion({
            result: {
              from: ctx.from,
              to: ctx.to,
              toParagraphs: partial.split("\n")
            }
          });
          return;
        }
        query.onCompletion({
          error: buildError(
            "network",
            (resp.error.message || resp.error.debugMessage) ||
              "网络请求失败",
            "network"
          )
        });
        return;
      }
      if (statusCode && (statusCode < 200 || statusCode >= 300)) {
        query.onCompletion({ error: parseApiError(resp) });
        return;
      }
      var finalText = stripThink(("" + ctx.result).trim()).trim();
      if (!finalText) {
        query.onCompletion({
          error: buildError(
            "api",
            "模型未返回任何内容，请检查模型名称、密钥或配额。",
            "api"
          )
        });
        return;
      }
      query.onCompletion({
        result: {
          from: ctx.from,
          to: ctx.to,
          toParagraphs: finalText.split("\n")
        }
      });
    }
  });
}

//#endregion

//#region Optional: timeout & validate

function pluginTimeoutInterval() {
  return 120;
}

function pluginValidate(completion) {
  var optionError = validateOptions();
  if (optionError) {
    completion({ result: false, error: optionError });
    return;
  }
  var option = $option || {};
  var url = buildUrl(option.accountId, option.gatewayId);
  var header = buildHeader(option.apiKey, option.providerApiKey);
  var body = {
    model: normalizeModel(option.model),
    stream: false,
    messages: [{ role: "user", content: "Say OK. /no_think" }]
  };

  (async function () {
    try {
      var resp = await $http.request({
        method: "POST",
        url: url,
        header: header,
        body: body
      });
      var statusCode =
        resp.response && resp.response.statusCode
          ? resp.response.statusCode
          : 0;
      if (statusCode >= 200 && statusCode < 300 && !(resp.data && resp.data.error)) {
        completion({ result: true });
      } else {
        completion({ result: false, error: parseApiError(resp) });
      }
    } catch (err) {
      completion({
        result: false,
        error: buildError(
          "network",
          (err && (err.message || err.localizedDescription)) ||
            "网络请求失败",
          "network"
        )
      });
    }
  })();
}

//#endregion
