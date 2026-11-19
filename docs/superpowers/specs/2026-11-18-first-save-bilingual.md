# Automatic bilingual content at first save

Dennis clarified that newly imported English recipes must also prepare Chinese, and Chinese recipes must prepare English, during generation/first save. Both homepage and detail should switch stored content immediately after preparation. Language switching must not start model calls.

Reuse the existing local translation model, validated bilingual content and cache/source-hash guards. The owner Mac processor will prepare both languages before completing a video preview. Its private ready-job data carries the prepared versions; the save action retrieves that data server-side and uses it only when the final saved body still matches. Recipe plus ready cache are inserted atomically. If the user edits the body or adds a recipe manually, save atomically queues first translation instead, with visible progress and automatic updates.

Use the existing recipe_translations pending state as the saved-translation queue; no new schema is needed. A shared owner claim endpoint selects video jobs or saved translation jobs. Cross-table atomic guards preserve one active Mac task, leases, stale-result protection and existing client compatibility. Existing video-only claim clients keep their endpoint. Phones enqueue/read only same-origin requests. The Mac page owns all loopback/model calls and cancellation.

Keep originals unchanged, validate field presence/counts, preserve ready caches for metadata-only edits, and never retry a failed model merely because language changed. Backfill the currently missing saved versions after publication. No cloud model, paid service, new sharing, service credential or canonical production QA recipe is introduced.

Acceptance: prepared video preview switches languages; first save stores source and both display versions together; edited/manual saves queue once and update homepage/detail automatically; cached toggles/reloads perform no model work; cross-user/role/source/lease guards hold; existing missing saved recipes become bilingual without rewriting originals.
