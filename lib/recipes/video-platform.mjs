export function videoPlatform(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;
  if (["facebook.com", "m.facebook.com", "web.facebook.com"].includes(host) &&
      (/^\/(?:reel\/[^/]+|share\/[rv]\/[^/]+|[^/]+\/videos\/[^/]+)\/?$/.test(path) || /^\/(?:watch\/?|video\.php)$/.test(path) && /^\d+$/.test(url.searchParams.get("v") || ""))) return "Facebook";
  if (host === "fb.watch" && /^\/[^/]+\/?$/.test(path)) return "Facebook";
  if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host) &&
      (/^\/(?:shorts|live|embed)\/[\w-]{11}\/?$/.test(path) || path === "/watch" && /^[\w-]{11}$/.test(url.searchParams.get("v") || ""))) return "YouTube";
  if (host === "youtu.be" && /^\/[\w-]{11}\/?$/.test(path)) return "YouTube";
  if (host === "tiktok.com" && /^\/(?:@[^/]+\/video\/\d+|t\/[\w-]+)\/?$/.test(path) || ["vm.tiktok.com", "vt.tiktok.com"].includes(host) && /^\/[^/]+\/?$/.test(path)) return "TikTok";
  if (host === "instagram.com" && /^\/(?:p|reel|reels|tv)\/[\w-]+\/?$/.test(path)) return "Instagram";
  if (host === "xiaohongshu.com" && /^\/(?:explore|discovery\/item)\/[a-f\d]+\/?$/i.test(path) || host === "xhslink.com" && /^\/(?:[^/]+\/)?[^/]+\/?$/.test(path)) return "小红书";
  return null;
}

export function importRoute(value) {
  if (videoPlatform(value)) return "video";
  let host;
  try { host = new URL(value).hostname.toLowerCase(); } catch { return "page"; }
  return ["facebook.com", "fb.watch", "youtube.com", "youtu.be", "tiktok.com", "instagram.com", "xiaohongshu.com", "xhslink.com"].some((platform) => host === platform || host.endsWith(`.${platform}`)) ? "unsupported" : "page";
}
