# Video recipe source coverage

The reported YouTube soup import returned one simmer sentence because caption retrieval required a playable media format. Audio retrieval also failed, and the organizer silently used the incomplete description. Caption downloads now tolerate missing playable formats. A description-only fallback requires explicit ingredient and method sections and identifies the unavailable audio in its notes; an ingredients-only description cannot stand in for the video method.

For spoken videos, retain all available subtitle/transcript text and group nearby fragments into bounded context units. Keep speech separate from description evidence. The organizer considers preparation, cooking and finishing, produces readable instructions with verbatim supporting excerpts, and restores source chronology, including preparation interleaved with cooking. Repeated actions at distinct source positions remain distinct.

Each displayed instruction must have a valid quote/source reference. Compare complete quantity expressions against the quoted excerpt, including fractions, ranges and units, rather than borrowing a number from elsewhere in the surrounding context. Reject nearby explicitly superseded estimates. Validate the displayed steps against the existing empty/placeholder invariants. One bounded model repair can correct validation failures; after that, fail visibly instead of returning an unverified result.

Recover a misnumbered citation only when its quoted text uniquely matches the original evidence. Explicit omission markers are accepted only when every quoted part appears in order within at most two adjacent context units. Partial fraction, range or compound-number matches cannot establish a quantity. Ambiguous, distant or invented quotations remain failures.

The local organizer enables reasoning for narrative extraction. Translation and frame collection retain their existing model settings. No provider, paid service, data schema, sharing or saved recipe source is changed. Semantic instruction rewriting is still model-generated and requires the user's preview confirmation; quote and quantity checks are safeguards, not proof of every paraphrased fact or every uncaptioned visual action.

The reported soup video is 18 minutes 14 seconds long. Its available Chinese caption track contains 446 segments, spanning approximately 12 seconds through 18 minutes 7 seconds. Local validation produced 12 readable instructions, including radish cutting, washing, blanching with the later 6–7 minute correction, pot assembly, water level, slow simmering, and final salt adjustment.

Independent review found quantity denominator/unit acceptance, cross-action duration borrowing, displayed placeholders and phase-based reordering. Regression tests reproduced each finding before its fix. Additional tests preserve repeated actions and reject unsupported compound-number conversions. No review findings were deferred.
