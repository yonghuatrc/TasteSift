# Multi-platform recipe import

Dennis requested YouTube, 小红书, TikTok and Instagram imports on 18 November. This extends the already approved multi-source recipe design and Mac-only processing architecture; no new hosting, billing or sharing decision is needed.

Use the existing Mac helper, installed yt-dlp, neighboring subtitle parser/faster-whisper script and local model. One shared video reader is preferable to four copied downloaders. Paid extraction APIs or a remote Mac bridge would change the chosen architecture and are outside this request.

Recognize public single-video/post URLs, including YouTube Shorts and supported share links. Resolve short links only within their originating approved platform, retaining meaningful query tokens. Reject profiles, playlists, credentials, arbitrary hosts and unexpected ports before invoking tools. Disable yt-dlp's generic extractor and user config. Bound subprocess time/output, download size and video duration (30 minutes); clean temporary files on success/failure.

Read metadata/post text once. Reuse an explicit structured recipe when present; otherwise prefer source captions and fall back to local speech recognition. The local model organizes only source evidence, leaves unknown facts blank and produces an unsaved preview. Unsupported/private/blocked sources and incomplete evidence produce actionable bilingual errors, never a fabricated recipe. Existing Facebook imports, recipe-page imports, categories, translations and preview-before-save stay intact.

Continue to import on the Mac running the helper. Phones can read saved results; this change does not expose the Mac to the internet. Validate all platform routes with controlled fixtures, test real public links where accessible, record platform blocks separately, and publish the same private Site.
