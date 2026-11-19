# Phone video imports through the Mac

Dennis approved building the smallest phone → Mac → phone flow, with the Mac, helper and a TasteSift browser page kept open. Continue inline in this folder without another approval gate.

All supported video links submitted on the homepage enter a private D1 job queue. The phone uses only same-origin HTTPS APIs. An owner-only Mac processing page claims one job at a time, invokes the existing loopback helper and posts the unsaved result back to the Site. Existing ChatGPT browser sign-in authenticates both ends; no new persistent credential, inbound Mac port, tunnel, paid service or cloud model is needed. Ordinary structured recipe-page imports remain unchanged.

Jobs are creator-private, idempotent by UUID, and survive a refresh through a job ID in the URL. Only owner/editor can submit; only owner can claim/report work. Tokens and leases prevent simultaneous work or stale completion. Failed/disconnected work is shown explicitly and is never silently rerun. Waiting jobs expire after 20 minutes; a running worker renews a two-minute lease. Ready drafts remain available and are never auto-saved as recipes. Saving continues through the existing review form.

Show waiting/actual processing stages and actionable failures in Chinese/English. The Mac page has explicit Start/Stop controls and stays open for phone imports. Phone job polling must never contact localhost. Reuse current URL validation, recipe validation, category catalog, progress stages, local extraction and authorization. Non-goals: family features, native background service, browserless workers, auto-saving, new extraction providers or transcription-quality changes.

Acceptance: enqueue from one authenticated browser; process from a separate Mac page; observe and refresh the same completed preview in the submitting browser, with no recipe save. Verify viewer/cross-user/CSRF rejection, exactly one active claim, expired/stale tokens, wrong-source rejection and failure persistence. Publish the existing private Site, start its Mac page and leave it ready for Dennis's phone test.
