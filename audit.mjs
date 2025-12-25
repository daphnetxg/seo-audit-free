import fetch from "node-fetch";
import { load } from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";

function safeUrl(input) {
  let u = (input || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const url = new URL(u);
    // basic normalization
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function ms(n) {
  if (typeof n !== "number") return "";
  return `${Math.round(n)}ms`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function textLen($, selector) {
  const t = $(selector).text().replace(/\s+/g, " ").trim();
  return t.length;
}

function firstTextSample($) {
  // take a short sample for "signal density" explanation
  const main = $("main").text() || "";
  const body = $("body").text() || "";
  const t = (main || body).replace(/\s+/g, " ").trim();
  return t.slice(0, 180);
}

function buildCheck({ key, level, title, meaning, fixHint }) {
  return { key, level, title, meaning, fixHint };
}

function levelScore(level) {
  if (level === "high") return 4;
  if (level === "mid") return 2;
  if (level === "low") return 1;
  return 0;
}

function verdictFromScore(score) {
  // score: 0..?
  if (score >= 8) {
    return {
      badge: "❌ 高风险信号",
      tone: "high",
      line: "当前检测到“可能直接影响收录/展示”的闸门级问题。",
    };
  }
  if (score >= 4) {
    return {
      badge: "⚠️ 中度风险信号",
      tone: "mid",
      line: "当前存在结构性不确定因素，可能影响 AI 摘要引用与点击率。",
    };
  }
  return {
    badge: "✅ 暂未发现致命问题",
    tone: "ok",
    line: "首页层面未出现明显闸门，但不代表全站安全。",
  };
}

function pickTopChecks(checks, n = 8) {
  const order = { high: 0, mid: 1, low: 2, ok: 3 };
  return [...checks]
    .sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9))
    .slice(0, n);
}

export async function runHomeAudit(inputUrl) {
  const url = safeUrl(inputUrl);
  if (!url) {
    return {
      ok: false,
      error: "URL 格式不正确。示例：https://example.com",
    };
  }

  const start = Date.now();
  let res;
  let html = "";
  let ttfb = null;

  try {
    const t0 = Date.now();
    res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8" },
    });
    ttfb = Date.now() - t0;
    html = await res.text();
  } catch (e) {
    return {
      ok: false,
      error: "无法访问该 URL。可能被拦截、证书异常、或站点拒绝抓取。",
      debug: String(e?.message || e),
    };
  }

  const finalUrl = res?.url || url;
  const status = res?.status ?? 0;
  const headers = {};
  try {
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  } catch {}

  const contentType = headers["content-type"] || "";
  const xRobots = (headers["x-robots-tag"] || "").toLowerCase();

  const $ = load(html || "");

  const title = ($("title").first().text() || "").trim();
  const metaDesc = ($('meta[name="description"]').attr("content") || "").trim();
  const canonical = ($('link[rel="canonical"]').attr("href") || "").trim();
  const robots = ($('meta[name="robots"]').attr("content") || "").toLowerCase().trim();
  const lang = ($("html").attr("lang") || "").trim();

  const ogTitle = ($('meta[property="og:title"]').attr("content") || "").trim();
  const ogDesc = ($('meta[property="og:description"]').attr("content") || "").trim();
  const ogUrl = ($('meta[property="og:url"]').attr("content") || "").trim();

  const schemaBlocks = $('script[type="application/ld+json"]');
  const hasSchema = schemaBlocks.length > 0;

  let hasOrgSchema = false;
  let schemaParseOk = false;
  try {
    schemaBlocks.each((_, el) => {
      const raw = $(el).text().trim();
      if (!raw) return;
      schemaParseOk = true; // at least parse attempt
      // light heuristic: look for Organization/LocalBusiness
      if (/Organization|LocalBusiness/i.test(raw)) hasOrgSchema = true;
    });
  } catch {
    // ignore
  }

  // JS shell heuristics
  const scriptCount = $("script").length;
  const textBodyLen = textLen($, "body");
  const textMainLen = textLen($, "main");
  const hasMain = $("main").length > 0;
  const h1Count = $("h1").length;
  const firstH1 = ($("h1").first().text() || "").replace(/\s+/g, " ").trim();

  // redirect signal
  const inputHost = new URL(url).host;
  const finalHost = new URL(finalUrl).host;
  const hostChanged = inputHost !== finalHost;

  // mixed language / hreflang hint
  const hreflangCount = $('link[rel="alternate"][hreflang]').length;

  const checks = [];

  // 1) Indexability gate: meta robots / x-robots-tag / status codes
  if (status >= 400 || status === 0) {
    checks.push(
      buildCheck({
        key: "status",
        level: "high",
        title: `首页响应异常（HTTP ${status || "未知"}）`,
        meaning:
          "搜索引擎可能无法稳定抓取首页。你的站点会出现“收录波动/排名不稳定/直接不展示”。",
        fixHint:
          "先确保首页返回 200；检查 WAF/防火墙、服务器错误、CDN 回源与缓存策略。",
      })
    );
  } else if (status >= 300 && status < 400) {
    checks.push(
      buildCheck({
        key: "redirect",
        level: "mid",
        title: `首页存在重定向（HTTP ${status}）`,
        meaning:
          "重定向不是错，但如果链路复杂或多次跳转，会拉低抓取效率与首屏体验（影响 SEO 与转化）。",
        fixHint:
          "确保只有 1 次跳转（例如 http→https 或 非www→www）；避免重定向链。",
      })
    );
  }

  if (robots.includes("noindex") || xRobots.includes("noindex")) {
    checks.push(
      buildCheck({
        key: "noindex",
        level: "high",
        title: "检测到 NOINDEX（可收录闸门被关闭）",
        meaning:
          "这类信号会直接导致首页不被收录或被移出索引。你做再多内容，系统也可能“看不见”。",
        fixHint:
          "检查 meta robots / X-Robots-Tag 配置、插件设置、环境变量（staging/production）。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "indexability_ok",
        level: "ok",
        title: "未检测到 NOINDEX 闸门",
        meaning: "首页层面的可收录闸门未被明显关闭。",
        fixHint: "（提示）这不代表内页没有 noindex / canonical 错配。",
      })
    );
  }

  // 2) Canonical clarity
  if (!canonical) {
    checks.push(
      buildCheck({
        key: "canonical_missing",
        level: "mid",
        title: "未检测到 Canonical（规范化地址信号不足）",
        meaning:
          "当你的 URL 版本（带/不带 www、尾斜杠、参数）并存时，权重可能被分散，甚至造成“收录重复”。",
        fixHint:
          "为首页与核心页面设置 canonical；统一 www / 非www 与尾斜杠策略。",
      })
    );
  } else {
    try {
      const c = new URL(canonical, finalUrl).toString();
      const normalizedFinal = new URL(finalUrl).toString();
      if (c !== normalizedFinal) {
        checks.push(
          buildCheck({
            key: "canonical_mismatch",
            level: "mid",
            title: "Canonical 指向与当前页面不一致（可能存在权重错配）",
            meaning:
              "搜索引擎可能把你正在看的这个首页当作“非主版本”，导致排名与展示权重跑偏。",
            fixHint:
              "确保 canonical 指向你希望被收录的主版本（https、主域、统一路径）。",
          })
        );
      } else {
        checks.push(
          buildCheck({
            key: "canonical_ok",
            level: "ok",
            title: "Canonical 信号存在且一致",
            meaning: "首页主版本信号更清晰，降低重复收录概率。",
            fixHint: "继续在关键内页保持一致策略。",
          })
        );
      }
    } catch {
      checks.push(
        buildCheck({
          key: "canonical_invalid",
          level: "mid",
          title: "Canonical 格式异常",
          meaning:
            "canonical 解析失败会让规范化策略失效，可能造成重复收录或权重分散。",
          fixHint: "检查 canonical 是否为完整可解析 URL。",
        })
      );
    }
  }

  // 3) JS shell risk (content thin)
  if (textBodyLen < 600 && scriptCount > 25) {
    checks.push(
      buildCheck({
        key: "js_shell",
        level: "high",
        title: "首页可能是“壳站风险”（文本信号不足 + 脚本占比高）",
        meaning:
          "在 AI 搜索环境下，系统更依赖可提取的文本与结构信号。壳站会导致“看起来漂亮，但系统读不懂”。",
        fixHint:
          "确保首屏与主体区域有足够可解析文本；关键模块尽量 SSR/静态输出；减少首屏依赖 JS 才生成内容。",
      })
    );
  } else if (textBodyLen < 800) {
    checks.push(
      buildCheck({
        key: "signal_density",
        level: "mid",
        title: "首页“主题信号密度”偏低（可读内容较少）",
        meaning:
          "系统不一定能在首页快速抓到你是谁/卖什么/给谁。结果是：展示弱、点击弱、AI 摘要引用概率下降。",
        fixHint:
          "补强首屏一句话定位 + 主服务/主类目文本；让导航/模块标题更语义化（不是纯口号）。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "signal_density_ok",
        level: "ok",
        title: "首页信号密度尚可（可读文本存在）",
        meaning: "首页具有一定可提取内容信号。",
        fixHint: "建议继续优化“首屏一句话定位”与核心模块标题语义。",
      })
    );
  }

  // 4) Primary topic clarity (Title/H1) - keep but not old-fashioned: focus on "主题一致性"
  const titleLen = title.length;
  if (!title) {
    checks.push(
      buildCheck({
        key: "title_missing",
        level: "mid",
        title: "未检测到明确 Title（主题锚点不足）",
        meaning:
          "Title 是搜索系统判断“你这页是什么”的最高权重文本之一。缺失会显著降低理解与展示质量。",
        fixHint: "为首页设置 20–55 字的清晰定位：品牌 + 核心服务/品类 + 差异点。",
      })
    );
  } else if (titleLen > 70) {
    checks.push(
      buildCheck({
        key: "title_long",
        level: "low",
        title: "Title 可能偏长（展示被截断风险）",
        meaning:
          "标题被截断会降低点击率，也会让系统抓不到重点关键词。",
        fixHint: "把核心品类/服务放前面；删掉冗余修饰词。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "title_ok",
        level: "ok",
        title: "Title 存在且长度合理",
        meaning: "首页主题锚点至少是“存在的”。",
        fixHint: "下一步看“是否与页面首屏定位一致”。",
      })
    );
  }

  if (h1Count === 0) {
    checks.push(
      buildCheck({
        key: "h1_missing",
        level: "mid",
        title: "未检测到 H1（主主题缺少明确入口）",
        meaning:
          "这会让系统更难快速判断你首页的“第一主题”。尤其在 AI 摘要里，提取会更弱。",
        fixHint:
          "给首屏设置一个清晰 H1：你是谁 + 为谁解决什么问题（别写诗）。",
      })
    );
  } else if (h1Count >= 3) {
    checks.push(
      buildCheck({
        key: "h1_many",
        level: "mid",
        title: "H1 数量偏多（主主题可能被稀释）",
        meaning:
          "H1 过多常见于组件化页面，容易让系统误判为多个主题并行，导致权重分散。",
        fixHint:
          "保留 1 个主 H1；其他模块用 H2/H3；确保首屏 H1 是核心定位。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "h1_ok",
        level: "ok",
        title: "H1 结构基本可用",
        meaning: "主主题入口至少存在。",
        fixHint: firstH1 ? `（当前首个 H1：${firstH1.slice(0, 42)}）` : "",
      })
    );
  }

  // 5) Brand/AI citation signals: Schema + OG
  if (!hasSchema) {
    checks.push(
      buildCheck({
        key: "schema_missing",
        level: "mid",
        title: "未检测到结构化数据（AI 引用与身份识别信号弱）",
        meaning:
          "在 AI 搜索环境下，Schema 是“你是谁/你提供什么”的高密度机器可读信号。缺失会降低被引用与被正确归类的概率。",
        fixHint:
          "至少补 Organization/Person + WebSite + Breadcrumb（按站点类型）并保持一致。",
      })
    );
  } else if (!schemaParseOk) {
    checks.push(
      buildCheck({
        key: "schema_parse",
        level: "mid",
        title: "检测到 Schema 但可能存在格式问题",
        meaning:
          "Schema 若不可解析，等同于没有。系统会忽略这些信号。",
        fixHint:
          "用结构化数据测试工具检查 JSON-LD 是否可解析；确保是有效 JSON。",
      })
    );
  } else if (!hasOrgSchema) {
    checks.push(
      buildCheck({
        key: "org_schema",
        level: "low",
        title: "Schema 存在，但缺少 Organization/身份类信号",
        meaning:
          "系统更难把站点与品牌身份绑定，影响信任与引用。",
        fixHint:
          "补 Organization/Person，并在 About/首页/页脚一致露出品牌身份信息。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "schema_ok",
        level: "ok",
        title: "结构化数据存在（具备 AI 语义信号基础）",
        meaning: "机器可读信号至少不是空白。",
        fixHint: "下一步应检查内页一致性与实体关联（sameAs 等）。",
      })
    );
  }

  if (!ogTitle || !ogDesc) {
    checks.push(
      buildCheck({
        key: "og_missing",
        level: "low",
        title: "缺少完整 OG 展示信号（分享/预览一致性弱）",
        meaning:
          "这不一定影响排名，但会影响传播链路与用户信任；也会降低系统对页面摘要的稳定提取。",
        fixHint:
          "补齐 og:title / og:description / og:url / og:image，使其与页面定位一致。",
      })
    );
  } else {
    checks.push(
      buildCheck({
        key: "og_ok",
        level: "ok",
        title: "OG 信号存在（预览摘要更稳定）",
        meaning: "页面摘要在分享/预览场景更可控。",
        fixHint: ogUrl ? "" : "可补充 og:url 指向主版本。",
      })
    );
  }

  // 6) Host consistency
  if (hostChanged) {
    checks.push(
      buildCheck({
        key: "host_changed",
        level: "low",
        title: "访问域名发生变化（www/非www 或子域切换）",
        meaning:
          "这通常是正常规范化，但如果全站存在多版本并行，可能造成权重分散与重复收录。",
        fixHint:
          "确保全站统一主域；站内链接全部指向主版本；配合 canonical。",
      })
    );
  }

  // 7) Language hints
  if (!lang) {
    checks.push(
      buildCheck({
        key: "lang_missing",
        level: "low",
        title: "未声明页面语言（lang）",
        meaning:
          "语言信号弱会影响多语言/地区理解与摘要稳定性（尤其中文站点）。",
        fixHint: "在 <html lang='zh-Hans'> / 'zh-Hant' 等声明站点语言。",
      })
    );
  } else if (hreflangCount > 0) {
    checks.push(
      buildCheck({
        key: "hreflang",
        level: "ok",
        title: "检测到 hreflang 语言版本信号",
        meaning: "多语言/地区版本的基础信号存在。",
        fixHint: "建议检查是否覆盖核心页面且无冲突指向。",
      })
    );
  }

  // Score
  const score = checks.reduce((acc, c) => acc + levelScore(c.level), 0);
  const verdict = verdictFromScore(score);

  const elapsed = Date.now() - start;

  return {
    ok: true,
    inputUrl: url,
    finalUrl,
    status,
    ttfb,
    elapsed,
    contentType,
    snapshot: {
      title,
      canonical,
      robots,
      xRobots,
      lang,
      h1Count,
      firstH1,
      textBodyLen,
      textMainLen,
      hasMain,
      scriptCount,
      hasSchema,
      hasOrgSchema,
      ogTitle,
      ogDesc,
      ogUrl,
      sample: firstTextSample($),
    },
    verdict,
    score,
    checks,
    topChecks: pickTopChecks(checks, 9),
  };
}
