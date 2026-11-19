# MVP 1.4 phone import acceptance

- Baseline 124 tests. Before the independent review, 137/137 and TypeScript passed; the final review fix suite is recorded below.
- Seven SQLite queue tests cover idempotence, private reads, viewer/editor restrictions, one global live claim, progress/result persistence, expired/stale tokens, source mismatch and no recipe inserts.
- Remote-client tests cover same-origin-only submission/polling, explicit idempotency keys after connection loss, ready-result resume, visible failures, progress and cancellation.
- Local HTTP role integration rejects viewer writes and worker access, hides the owner-only page, rejects unrelated Origins, and restores the local mock role before browser processing starts.
- Local two-page real Facebook test: submission showed Waiting for your Mac; refresh preserved the same job UUID; starting a separate Mac page generated and returned the potato preview; a second refresh reused the ready preview. The Mac page reported one completed job, and the recipe shelf remained at four saved records. No Confirm and save action was performed.
- A real YouTube queued test also returned its 干蒸排骨 preview through the separate submitting page, while the Mac page reported two completed tasks. No recipe was saved. Final hosted verification uses separate submitting and Mac-processing browser pages, then leaves the actual Mac page running.

One additive D1 migration creates `video_import_jobs`; existing recipes and translation rows are unchanged. The Site stays owner-private. No tunnel, inbound public Mac service, new secret or paid model was added. Mac, helper and owner processing page must remain running. Ready results are source-language drafts; existing first-time bilingual preparation is a separate Mac workflow.

## Independent review fixes

Three Important findings were reproduced before fixing: active jobs must outlive their queue-wait deadline while leased, retries after a failed job must reset status before a potentially lost POST response, and Stop must cancel helper work rather than only releasing the cloud claim. Regression tests now cover all three, including real subprocess exit and HTTP model cancellation before the next video runs. The ready-progress observation was regraded as an availability invariant: the API rejects a ready progress event, and only stored completion exposes the ready stage.
