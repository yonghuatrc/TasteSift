# TasteSift MVP 1 — URL to recipe

The user narrowed priority to the core recipe workflow on 16 November: provide a URL, see the extracted recipe, and save it after review. Family management is deferred from the main navigation; existing authorization stays in place.

The first direct website importer reads public HTML pages containing schema.org Recipe JSON-LD. It preserves ingredients, ordered steps, source attribution, image and known metadata. Missing facts stay blank. It performs no paid AI calls and does not claim automatic video understanding. Social videos or pages without a complete embedded recipe return a clear unsupported-content message, with ChatGPT extraction or manual entry as the fallback.

Homepage: a prominent URL field, a clearly labelled public sample to try, then the saved recipe library. Successful extraction displays an unsaved recipe preview; the user can edit the populated form or confirm save. Failed reads preserve the URL. Importing alone must never create a recipe record.

Verification: parser tests cover graphs, nested instructions, entities, metadata and incomplete content; fetch tests cover public URL validation, redirects, size/time limits and blocked content. Browser acceptance covers import, review/edit/save, failed reads, validation preservation and mobile layout. Publish the existing private Site only after the core flow works.
