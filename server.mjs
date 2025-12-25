import express from "express";
import { nanoid } from "nanoid";
import { runHomeAudit } from "./audit.mjs";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 8787;

// ✅ 你的 RM200 购买链接
const UPGRADE_URL = "https://buy.stripe.com/6oU6oHdnKc5D8wP2ER5os0i";

function esc(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function badgeClass(tone) {
  if (tone === "high") return "dxg-badge dxg-badge-high";
  if (tone === "mid") return "dxg-badge dxg-badge-mid";
  return "dxg-badge dxg-badge-ok";
}

function levelDot(level) {
  if (level === "high") return `<span class="dxg-dot dxg-dot-high"></span>`;
  if (level === "mid") return `<span class="dxg-dot dxg-dot-mid"></span>`;
  if (level === "low") return `<span class="dxg-dot dxg-dot-low"></span>`;
  if (level === "ok") return `<span class="dxg-dot dxg-dot-ok"></span>`;
  return `<span class="dxg-dot"></span>`;
}

function titleForLevel(level) {
  if (level === "high") return "高风险";
  if (level === "mid") return "中度风险";
  if (level === "low") return "轻度风险";
  if (level === "ok") return "正常";
  return "提示";
}

function renderHome() {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>免费网站 SEO 审计工具（2 分钟快速检测）</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root{
      --ink:#0f172a;
      --muted:#64748b;
      --line:#e5e7eb;
      --bg:#ffffff;
      --soft:#faf8f5;
      --ok:#16a34a;
      --mid:#f59e0b;
      --high:#ef4444;
      --rose1:#ff4fd8;
      --rose2:#ff2a7a;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      background:var(--bg);
      color:var(--ink);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;
      font-size:18px;
      line-height:1.85;
    }
    .dxg-wrap{max-width:1040px;margin:0 auto;padding:64px 18px 80px}
    .dxg-top{
      border:1px solid var(--line);
      border-radius:24px;
      padding:28px;
      background:linear-gradient(180deg,#fff, #fff 70%, rgba(250,248,245,.9));
      box-shadow:0 18px 60px rgba(0,0,0,.06);
    }
    .dxg-eyebrow{
      font-size:14px;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:var(--muted);
    }
    h1{
      margin:14px 0 10px;
      font-size:44px;
      line-height:1.15;
      letter-spacing:.2px;
    }
    .dxg-sub{margin:0;color:#334155;font-size:20px;max-width:780px}
    .dxg-form{
      margin-top:22px;
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:center;
    }
    .dxg-input{
      flex:1 1 420px;
      border:1px solid var(--line);
      border-radius:16px;
      padding:16px 16px;
      font-size:18px;
      outline:none;
      background:#fff;
    }
    .dxg-input:focus{border-color:#cbd5e1; box-shadow:0 0 0 4px rgba(191,162,90,.15)}
    .dxg-btn{
      border:0;
      border-radius:16px;
      padding:16px 18px;
      font-size:18px;
      font-weight:900;
      cursor:pointer;
      background:#111827;
      color:#fff;
      box-shadow:0 18px 45px rgba(17,24,39,.18);
      transition:transform .2s ease, box-shadow .2s ease, filter .2s ease;
      white-space:nowrap;
    }
    .dxg-btn:hover{transform:translateY(-2px); box-shadow:0 26px 70px rgba(17,24,39,.22); filter:saturate(1.05)}
    .dxg-hint{margin-top:12px;color:var(--muted);font-size:15px}
    .dxg-grid{
      display:grid;
      grid-template-columns:repeat(12,1fr);
      gap:18px;
      margin-top:22px;
    }
    .dxg-card{
      grid-column:span 4;
      border:1px solid var(--line);
      border-radius:20px;
      padding:18px 18px;
      background:#fff;
    }
    .dxg-card strong{display:block;font-size:18px;margin-bottom:6px}
    .dxg-card p{margin:0;color:#334155;font-size:16px}
    @media (max-width:900px){ .dxg-card{grid-column:span 12} h1{font-size:38px} }
  .audit-scope{margin-top:14px;padding:14px 16px;border-radius:12px;background:#fafafa;border:1px solid #eee;font-size:14px;line-height:1.6;color:#374151;} .audit-scope strong{color:#111827;font-weight:600;}.result-hook{margin:6px 0 18px;font-size:16px;font-weight:600;color:#111827;}</style>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
</head>
<body>
<header class="dxg-header"><div class="dxg-logo" style="font-family:'Playfair Display', serif; font-weight:700; letter-spacing:0; font-size:22px; color:#111;">DAPHNETXG</div></header>
  <div class="dxg-wrap">
    <div class="dxg-top">
      <div class="dxg-eyebrow">免费工具 · 无需注册 · 约 2 分钟</div>
      <h1>免费网站 SEO 审计工具（首页快照检测）</h1>
      <p class="dxg-sub">
        这不是“看你有没有做 SEO”，而是判断：你的网站是否存在 <strong>被系统忽略 / 被 AI 误读 / 被索引闸门挡住</strong> 的风险信号。
      </p>

      <form class="dxg-form" method="POST" action="/audit">
        <input class="dxg-input" name="url" placeholder="输入你的网址，例如：https://daphnetxg.com" required />
        <button class="dxg-btn" type="submit">开始检测 →</button>
      </form>

      <div class="dxg-hint">提示：仅检测首页，不抓取全站；不会读取私密数据或后台内容。</div>

<div class="audit-scope">⚠️ <strong>重要说明：</strong><br>这是一次<strong>系统级首页快照检测</strong>，用于判断你的网站是否已经出现 <strong>被搜索系统忽略 / 被 AI 误读 / 被索引门槛拦截</strong> 的高风险信号。<br><br>它<strong>不会</strong>做全站抓取，也<strong>不会</strong>给你操作教学；但如果首页已经暴露风险，说明整个站点在搜索系统中的解释权已出现结构性问题。</div>

      <div class="dxg-grid">
        <div class="dxg-card">
          <strong>可收录闸门</strong>
          <p>是否存在 noindex / X-Robots-Tag 等直接阻断收录的信号。</p>
        </div>
        <div class="dxg-card">
          <strong>规范化与权重错配</strong>
          <p>canonical/主版本不清晰会造成重复收录与权重分散。</p>
        </div>
        <div class="dxg-card">
          <strong>AI 可读性</strong>
          <p>首页是否像“壳站”：漂亮但缺少可提取文本与语义信号。</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderReport(data) {
  const id = nanoid(8);

  const topChecksHtml = data.topChecks
    .map(
      (c) => `
      <div class="dxg-check">
        <div class="dxg-check-head">
          ${levelDot(c.level)}
          <div class="dxg-check-title">
            <div class="dxg-check-kicker">${titleForLevel(c.level)}</div>
            <div class="dxg-check-name">${esc(c.title)}</div>
          </div>
        </div>
        <div class="dxg-check-body">
          <div class="dxg-check-meaning"><strong>这意味着：</strong> ${esc(c.meaning)}</div>
          <div class="dxg-check-fix"><strong>建议动作：</strong> ${esc(c.fixHint || "—")}</div>
        </div>
      </div>
    `
    )
    .join("");

  const s = data.snapshot || {};
  const metaLine = [
    `HTTP ${data.status}`,
    s.lang ? `lang=${esc(s.lang)}` : `lang=未声明`,
    `TTFB≈${esc(String(data.ttfb ?? ""))}ms`,
    `文本≈${esc(String(s.textBodyLen ?? 0))}字`,
    `脚本=${esc(String(s.scriptCount ?? 0))}`,
  ].join(" · ");

  const trustLine = `本工具由 DAPHNETXG 提供｜仅基于首页进行快速检测｜不进行全站抓取，不读取私密数据`;

  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SEO 快速检测报告（首页快照）</title>
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root{
      --ink:#0f172a;
      --muted:#64748b;
      --line:#e5e7eb;
      --bg:#ffffff;
      --soft:#faf8f5;
      --ok:#16a34a;
      --mid:#f59e0b;
      --high:#ef4444;
      --rose1:#ff4fd8;
      --rose2:#ff2a7a;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      background:var(--bg);
      color:var(--ink);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;
      font-size:18px;
      line-height:1.9;
    }
    a{color:inherit}
    .dxg-wrap{max-width:1040px;margin:0 auto;padding:54px 18px 84px}
    .dxg-header{
      border:1px solid var(--line);
      border-radius:26px;
      padding:26px 26px;
      background:linear-gradient(180deg,#fff, rgba(250,248,245,.95));
      box-shadow:0 18px 60px rgba(0,0,0,.06);
    }
    .dxg-eyebrow{
      font-size:14px;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:var(--muted);
    }
    h1{margin:14px 0 8px;font-size:44px;line-height:1.15}
    .dxg-sub{margin:0;color:#334155;font-size:20px;max-width:860px}
    .dxg-badge{
      display:inline-flex;
      align-items:center;
      gap:10px;
      padding:10px 14px;
      border-radius:999px;
      font-weight:900;
      margin-top:16px;
      font-size:16px;
      border:1px solid var(--line);
      background:#fff;
    }
    .dxg-badge-ok{color:var(--ok)}
    .dxg-badge-mid{color:var(--mid)}
    .dxg-badge-high{color:var(--high)}
    .dxg-meta{margin-top:12px;color:var(--muted);font-size:15px}
    .dxg-kv{
      margin-top:18px;
      display:grid;
      grid-template-columns:repeat(12,1fr);
      gap:14px;
    }
    .dxg-kv .box{
      grid-column:span 6;
      border:1px solid var(--line);
      border-radius:20px;
      padding:16px 18px;
      background:#fff;
    }
    .dxg-kv .box strong{display:block;font-size:16px;margin-bottom:6px}
    .dxg-kv .box div{color:#334155;font-size:16px}
    @media (max-width:900px){ .dxg-kv .box{grid-column:span 12} h1{font-size:38px} }

    .dxg-section{margin-top:26px}
    .dxg-h2{font-size:28px;margin:0 0 14px}
    .dxg-lead{color:#334155;font-size:18px;margin:0 0 16px}

    .dxg-checks{
      display:grid;
      grid-template-columns:repeat(12,1fr);
      gap:14px;
    }
    .dxg-check{
      grid-column:span 6;
      border:1px solid var(--line);
      border-radius:22px;
      padding:18px 18px;
      background:#fff;
    }
    @media (max-width:900px){ .dxg-check{grid-column:span 12} }
    .dxg-check-head{display:flex;gap:12px;align-items:flex-start}
    .dxg-dot{width:10px;height:10px;border-radius:50%;margin-top:6px;background:#94a3b8}
    .dxg-dot-ok{background:var(--ok)}
    .dxg-dot-mid{background:var(--mid)}
    .dxg-dot-high{background:var(--high)}
    .dxg-dot-low{background:#3b82f6}
    .dxg-check-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
    .dxg-check-name{font-size:20px;font-weight:950;line-height:1.25;margin-top:3px}
    .dxg-check-body{margin-top:12px;color:#334155;font-size:16px}
    .dxg-check-body strong{color:var(--ink)}
    .dxg-check-meaning, .dxg-check-fix{margin-top:8px}

    .dxg-hook{
      margin-top:18px;
      border:1px solid var(--line);
      border-radius:24px;
      padding:20px 20px;
      background:var(--soft);
    }
    .dxg-hook h3{margin:0 0 8px;font-size:20px}
    .dxg-hook p{margin:0;color:#334155;font-size:16px;line-height:1.85}
    .dxg-hook ul{margin:12px 0 0;padding-left:18px;color:#334155;font-size:16px}
    .dxg-hook li{margin:7px 0}

    .dxg-upgrade{
      margin-top:22px;
      border:1px solid var(--line);
      border-radius:26px;
      padding:22px 22px;
      background:#fff;
      box-shadow:0 16px 50px rgba(0,0,0,.05);
    }
    .dxg-upgrade h2{margin:0 0 10px;font-size:26px}
    .dxg-upgrade ul{margin:10px 0 0;padding-left:18px}
    .dxg-upgrade li{margin:8px 0;color:#334155;font-size:16px}
    .dxg-cta{
      display:inline-flex;
      align-items:center;
      gap:10px;
      margin-top:16px;
      padding:14px 18px;
      border-radius:18px;
      text-decoration:none;
      font-weight:950;
      font-size:18px;
      color:#fff;
      background:linear-gradient(135deg,var(--rose1),var(--rose2));
      box-shadow:0 18px 60px rgba(255,42,122,.25);
      transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
    }
    .dxg-cta:hover{
      transform:translateY(-2px);
      box-shadow:0 30px 90px rgba(255,42,122,.32);
      filter:saturate(1.15);
    }
    .dxg-cta small{
      font-weight:800;
      opacity:.9;
      font-size:13px;
    }
    .dxg-note{margin-top:10px;color:var(--muted);font-size:13px}

    .dxg-footer{
      margin-top:26px;
      color:var(--muted);
      font-size:13px;
      border-top:1px solid var(--line);
      padding-top:16px;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:space-between;
    }
    code{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:2px 8px;font-size:14px}
  </style>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
</head>
<body>
<header class="dxg-header"><div class="dxg-logo" style="font-family:'Playfair Display', serif; font-weight:700; letter-spacing:0; font-size:22px; color:#111;">DAPHNETXG</div></header>
  <div class="dxg-wrap">
    <div class="dxg-header">
      <div class="dxg-eyebrow">SEO 快速检测报告 · 首页快照 · ID ${esc(id)}</div>
      <h1>你的网站存在以下 SEO 风险信号（基于首页快照）</h1>
      <p class="dxg-sub">本报告仅基于首页进行 2 分钟快速检测，未进行全站抓取。</p>

      <div class="${badgeClass(data.verdict.tone)}">
        <span>${esc(data.verdict.badge)}</span>
        <span style="color:#64748b;font-weight:800">｜不是好/不好，而是你现在“不确定”。</span>
      </div>

      <div class="dxg-meta">
        <div><strong>检测对象：</strong> <code>${esc(data.finalUrl)}</code></div>
        <div>${esc(metaLine)}</div>
      </div>

      <div class="dxg-kv">
        <div class="box">
          <strong>判词（2 分钟结论）</strong>
          <div>${esc(data.verdict.line)}</div>
        </div>
        <div class="box">
          <strong>你最可能“看走眼”的点</strong>
          <div>首页通常是最稳的页面；真正拖垮 SEO 的常在内页与历史内容。</div>
        </div>
      </div>
    </div>

    <div class="dxg-section">
      <h2 class="dxg-h2">我们在首页检测到的关键信号</h2>
      <p class="dxg-lead">下面每一条都不是“字段缺失”，而是它可能带来的商业后果。</p>

      <div class="dxg-checks">
        ${topChecksHtml}
      </div>

      <div class="dxg-hook">
        <h3>为什么“只看首页”是不够的？</h3>
        <p>
          首页通常是 SEO 表现最好的页面。真正影响排名与询盘的，往往是：
        </p>
        <ul>
          <li>栏目页 / 分类页（是否重复、是否空、是否被 canonical 错配）</li>
          <li>服务详情页（是否被系统读成“模板页/薄页”）</li>
          <li>旧文章 / 历史内容（是否结构崩坏、标题重复、主题漂移）</li>
        </ul>
        <p style="margin-top:10px"><strong>
          这也是为什么很多网站：首页看起来没问题，但整体 SEO 表现很差。
        </strong></p>
      </div>

      <div class="dxg-upgrade">
        <h2>升级后你会多知道什么？</h2>
        <ul>
          <li>🔍 10 个关键页面的真实 SEO 状态（不是首页的假象）</li>
          <li>📊 哪些问题影响最大、最值得先修（避免“全部重做”）</li>
          <li>🧭 你现在该先改哪里（按收益排序，不按清单排序）</li>
          <li>📄 一份可直接交给执行团队的修复清单（PDF）</li>
        </ul>

        <a class="dxg-cta" href="${esc(UPGRADE_URL)}" target="_blank" rel="noopener">
          查看完整 10 页 SEO 审计（RM200）
          <small>多币种自动显示</small>
        </a>

        <div class="dxg-note">
          本服务不包含人工咨询，仅提供结构化诊断报告。价格以 Stripe 页面为准（MYR/CNY/EUR/USD）。
        </div>
      </div>

      <div class="dxg-footer">
        <div>${esc(trustLine)}</div>
        <div>检测耗时：${esc(String(data.elapsed))}ms</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.get("/", (_req, res) => res.send(renderHome()));

app.get("/health", (_req, res) => res.status(200).send("ok"));

app.post("/audit", async (req, res) => {
  const url = req.body?.url;
  const data = await runHomeAudit(url);

  if (!data.ok) {
    const errHtml = `<!doctype html><html lang="zh-Hans"><head>
      <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>检测失败</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;
        padding:48px;background:#fff;color:#0f172a;line-height:1.8;font-size:18px}
        .card{max-width:820px;margin:0 auto;border:1px solid #e5e7eb;border-radius:18px;padding:22px}
        .muted{color:#64748b;font-size:14px}
        a{color:#111827}
      </style><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght&display=swap" rel="stylesheet">
</head><body>
<header class="dxg-header"><div class="dxg-logo" style="font-family:'Playfair Display', serif; font-weight:700; letter-spacing:0; font-size:22px; color:#111;">DAPHNETXG</div></header>
      <div class="card">
        <h1 style="margin:0 0 10px">检测失败</h1>
        <p>${esc(data.error || "未知错误")}</p>
        <p class="muted">你可以检查：URL 是否带 https；站点是否拦截抓取；或稍后重试。</p>
        <p><a href="/">返回重新检测 →</a></p>
      </div></body></html>`;
    return res.status(400).send(errHtml);
  }

  res.send(renderReport(data));
});

app.listen(PORT, () => {
  console.log(`Free audit v2025-12-25a running on port `);
});
