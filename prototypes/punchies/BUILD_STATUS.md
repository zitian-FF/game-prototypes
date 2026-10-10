## Current milestone
Settings language selection implemented and validated.
## What was implemented
Language button beside Input Setup in shared main-menu and in-game Settings. Picker highlights the current language, saves choices through the existing portal store, and Back returns to Settings. A single available language is centered.
## Key technical decisions
Reuse the build-time Google Sheet locale pipeline and English fallback. Offer only populated languages in production. Language selection in GameMenu never restarts the active fight; existing gameplay labels refresh on their next scene creation.
## Open questions
None for this UI change.
## Known issues
Non-English locale files remain empty pending the private Sheet refresh and CSV import; English is currently the only production choice.
## Next proposed step
Complete the translation Sheet/import handoff and review Japanese, Korean, Chinese, Spanish and Arabic layouts before making those languages available.
