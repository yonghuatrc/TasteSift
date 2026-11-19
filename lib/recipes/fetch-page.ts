const MAX_BYTES = 2_000_000;

export function validatePublicUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("请输入完整的公开网页链接。"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    !host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host)
  ) throw new Error("只支持公开的 HTTP 或 HTTPS 网页链接。");
  url.hash = "";
  return url;
}

function publicAddress(address: string): boolean {
  if (address.includes(":")) {
    const prefix = parseInt(address.split(":")[0], 16);
    return prefix >= 0x2000 && prefix <= 0x3fff && !/^2001:(db8|0):/i.test(address);
  }
  const [a, b, c] = address.split(".").map(Number);
  return Number.isInteger(a) && a > 0 && a < 224 && a !== 10 && a !== 127 &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) &&
    !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) && !(a === 203 && b === 0 && c === 113);
}

async function checkPublicDns(url: URL, signal: AbortSignal) {
  // Public DNS preflight plus Workers' public-network fetch boundary. No cookies
  // or authentication headers from the incoming request are sent to a source.
  const answers = await Promise.all(["A", "AAAA"].map(async (type) => {
    const dns = new URL("https://cloudflare-dns.com/dns-query");
    dns.searchParams.set("name", url.hostname);
    dns.searchParams.set("type", type);
    const response = await fetch(dns, { headers: { accept: "application/dns-json" }, signal });
    if (!response.ok) throw new Error("暂时无法读取这个网页，请稍后再试。");
    const result = await response.json() as { Answer?: { type: number; data: string }[] };
    return (result.Answer ?? []).filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some((address) => !publicAddress(address))) {
    throw new Error("只支持可从互联网访问的公开网页。");
  }
}

export async function fetchRecipePage(
  source: string,
  fetcher: typeof fetch = fetch,
  checkDns: (url: URL, signal: AbortSignal) => Promise<void> = checkPublicDns,
): Promise<{ html: string; finalUrl: string }> {
  let url = validatePublicUrl(source);
  const signal = AbortSignal.timeout(20_000);
  for (let redirects = 0; redirects <= 4; redirects++) {
    await checkDns(url, signal);
    const response = await fetcher(url.href, {
      redirect: "manual", signal,
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "TasteSift/0.1 Recipe Importer" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) break;
      url = validatePublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      throw new Error("暂时无法读取这个页面，可能需要登录或被平台限制。请把链接发给 ChatGPT，或换一个公开食谱网页。");
    }
    const reader = response.body?.getReader();
    if (!reader) break;
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error("这个页面太大，暂时无法导入。");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return { html: new TextDecoder().decode(body), finalUrl: url.href };
  }
  throw new Error("这个链接跳转次数过多，暂时无法读取。");
}
