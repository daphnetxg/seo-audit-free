import fetch from "node-fetch";
import { load } from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function normUrl(input) {
  let url = (input || "").trim();
  if (!url) throw new Error("URL is empty");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function pickText($, selector) {
  const t = $(selector).first().text();
  return (t || "").trim();
}

function exists($, selector) {
  return $(selector).length > 0;
}

export async function auditHomepage(inputUrl) {
  const url = normUrl(inputUrl);

  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,*/*" },
  });
  const fetchMs = Date.now() - t0;

  const status = res.status;
  const finalUrl = res.url || url;

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const xRobots = res.headers.get("x-robots-tag") || "";
  const html = await res.text();

  const isHtml = contentType.includes("text/html") || html.includes("<html");
  const $ = load(html);

  const title = pickText($, "title");
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const h1s = $("h1")
    .map((_, el) => ($(el).text() || "").trim())
    .get()
    .filter(Boolean);

  const hasSchemaLd = exists($, 'script[type="application/ld+json"]');
  const hasOG = exists($, 'meta[property^="og:"]');
  const robotsMeta = $('meta[name="robots"]').attr("content") || "";

  const signals = [];
  if (!isHtml) signals.push({ level: "high", hit: "Response is not HTML" });
  if (!title) signals.push({ level: "high", hit: "Missing <title>" });
  if (!metaDesc.trim()) signals.push({ level: "med", hit: "Missing meta description" });
  if (h1s.length === 0) signals.push({ level: "med", hit: "Missing H1" });
  if (h1s.length > 1) signals.push({ level: "low", hit: "Multiple H1s (check layout)" });
  if (!canonical) signals.push({ level: "low", hit: "Missing canonical" });
  if (!hasSchemaLd) signals.push({ level: "low", hit: "No JSON-LD schema found" });

  const indexHint =
    /noindex/i.test(robotsMeta) || /noindex/i.test(xRobots)
      ? "Possible NOINDEX signal found (check carefully)."
      : "No explicit NOINDEX signal detected on homepage headers/meta.";

  return {
    audited_at: new Date().toISOString(),
    site: {
      input_url: url,
      final_url: finalUrl,
      status,
      content_type: contentType || "—",
      fetch_ms: fetchMs,
      x_robots: xRobots || "—",
      robots_meta: robotsMeta || "—",
    },
    homepage: {
      title: title || "—",
      title_len: title ? title.length : 0,
      meta_desc: metaDesc.trim() || "—",
      meta_desc_len: metaDesc.trim() ? metaDesc.trim().length : 0,
      canonical: canonical || "—",
      h1_count: h1s.length,
      h1_preview: h1s.slice(0, 2),
      has_og: hasOG,
      has_schema_ld: hasSchemaLd,
      index_hint: indexHint,
    },
    signals,
  };
}
