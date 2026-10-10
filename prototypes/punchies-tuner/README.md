# Punchies Balance Workshop

Development URL: `/game-prototypes/prototypes/punchies-tuner/`. Vite discovers its `index.html`, so the regular Pages build includes it without changing game UI or the itch target.

1. Open the page in Brave and click **Open tune.json**.
2. Select `prototypes/punchies/tune.json` in your local checkout. The game imports this JSON file; it is not an executable JavaScript file.
3. Pick a fighter and stat category. The editable **Tune value** is the stored multiplier or offset. **In game** and **Base** apply the actual game formulas. Positive/negative denotes a numerical difference, not better/worse.
4. **Save to opened file** asks the browser for write access. The save rereads after permission is granted, merges only the numeric fields edited in this session, and aborts on a same-field conflict. Unrelated changes from Claude and unknown future fields are retained. This is a conflict check, not a lock against external processes writing during the final write.
5. Commit the changed file through your usual Git workflow or use the game's tune sync after it is committed. The published Pages page does not commit to GitHub. **Download JSON** exports a replacement copy on browsers without direct file access.

**Base** exposes the raw shared health/stamina/stun/movement/body/hit/fatigue/stars values and every shared punch/block/dodge property. Each fighter applies its existing multipliers and frame offsets to these numbers. Base tables contain Property and Raw value, without percentage comparisons. Ratios remain stored decimals (for example 0.5), and durations/frame counts remain their raw game units. Base replaces the former Shared rules entry; it does not add a playable fighter. Block/dodge remain shared for all fighters. Uppercut damage is Cross base damage × uppercut factor × character uppercut multiplier. Reach/hit radius include actual fighter size. Fighter comparisons still use Base.

**Base history** appears beneath its stats and in the dedicated History tab. The first changed Base save records the previous raw values as v0, then appends v1 with a timestamp and old/new values for each changed path. Subsequent changed Base saves append v2, v3, etc. Fighter-only saves and no-op saves do not increment it. Revisions are stored in `tune.json` under `balanceWorkshop.baseHistory`, alongside the tuning values. The game excludes this metadata from simulation/debug tuning even after rebuilding. No history field or tuned number is added to the real repository tune during implementation.

Local file saves and GitHub saves generate revisions from the latest file after conflict checking; failed saves do not persist history. The client cannot rewrite previous GitHub history through Save. Downloads include the prospective Base revision, but do not mark the draft saved; open the exported file to see its recorded history. Restore saved draft restores whatever history that draft contained. Git commits provide the separate repository audit trail. Revisions record saves through this workshop; direct external edits are not retroactively logged. Each logged change uses its actual latest saved raw value as the previous value.

Files are parsed as JSON, never evaluated. The page requires no GitHub credential or remote service. Opened file handles are not persisted; draft JSON is stored only in localStorage, which is shared with other pages on the same origin. Only use the tool with game tuning files, not secrets. Other pages and scripts hosted on this origin must also remain trusted. HTTPS and a user gesture are required for native file access.

Tests: `node scripts/test-punchies-tuner.mjs` and `node scripts/test-punchies-tuner-file.mjs`. Native file picker permission prompts still need a manual Brave check; the file transaction logic is tested with mock handles.

## Local GitHub mode

Requires Node.js 20+ and `npm ci` once in the repository root. Use the existing authenticated GitHub CLI account with write access to `zitian-FF/game-prototypes`. On this PC the launcher finds `C:/Users/Zitian/Documents/Codex/playdate-bootstrap/gh/bin/gh.exe`; elsewhere put `gh` on PATH. Check `gh auth status` in your terminal if loading fails. No token is requested by the workshop.

1. Double-click **Start GitHub Workshop.cmd** in this folder (or run `npm run tuner:github` at the repo root). It builds just the workshop and starts the companion. Leave its terminal open.
2. Open **http://127.0.0.1:5187/** in Brave. Use this exact loopback address, rather than localhost or the Pages URL.
3. Click **Load latest**. It reads the repository's actual default branch through GitHub's Contents API, regardless of your local checkout branch. The source strip shows the branch and file SHA. Loading replaces current edits only after a confirmation when the draft is dirty.
4. Edit values and review the edits. Click **Save to GitHub** to authorise a direct tune commit to the displayed default branch. There is no automatic save. It rereads GitHub, selectively merges edited numeric fields with the retained baseline, and submits the latest file SHA as a compare-and-swap guard. Unrelated edits and unknown fields survive. Same-field conflicts or changes during the write reject the save; your draft stays available to download. Already-applied edits create no extra commit.
5. The result links to the saved commit. Click **Check build status** for workflows attached to that exact commit; no runs yet is not deployment confirmation. Refresh this status manually as builds progress.
6. Ctrl+C stops the companion. Restarting or reloading loses the in-memory GitHub save session: Load latest again before saving. Browser draft recovery contains JSON only; download a draft before loading if you need to retain it. The companion does not edit or sync your local checkout.

A Save is a real commit, with normal branch permissions and protection rules. In the current repository a push to main triggers Pages and the Current WIP itch workflow; some other workflow path filters may also match. Builds can fail or cancel earlier queued runs. A successful commit is not proof that a deployed game has updated. No force overwrite, branch-protection bypass, force push, or automatic implementation PR merge is used.

## Companion security and limits

The Node server binds only `127.0.0.1:5187`, serves only its dedicated `.local/punchies-tuner` build, and exposes fixed operations for one repository/file. API requests must be POST JSON with the exact local Origin, Host and custom header; cross-site requests are rejected and CORS is not enabled. A random session capability connects saves to a server-retained baseline. Responses disable caching and framing. `gh` is invoked with fixed argument arrays, never a shell or browser-supplied commands, paths, repository or branch. Its OS-held credentials are never returned to the browser, localStorage, logs or public builds. Session IDs are not persisted and are not GitHub credentials.

Use only on a trusted PC. Other local programs and browser extensions can act with your local user permissions; loopback checks are not an isolation boundary against a compromised computer. Do not port-forward, proxy, host, or expose this companion publicly. The Pages build contains no companion server or writable GitHub credentials and shows no GitHub controls. The local UI sends tune JSON to the companion only on Save; the companion sends the merged tune to GitHub. GitHub requests time out after 30 seconds. If a response is lost after GitHub accepted a commit, check the commit/file remotely before retrying; already-applied values are treated as a no-op.

Verification: `npm run test:tuner:github` exercises the full HTTP protocol with a mock GitHub API (including non-main default branch, selective merge, conflicts, SHA races, failed writes, no-op saves, build status and Origin/Host/header guards). `node scripts/test-punchies-github.mjs --serve` exposes the same mock for safe Brave browser checks after the local build has been generated. This mock never calls GitHub. Also run the two existing tuner tests, `npm run typecheck`, and `npm run build`.

## Perceived stats and archetypes

The coloured Health, Endurance, Speed, Power and Reach preview uses the same formulas as the game character selection screen. Base is the 80% benchmark for every bar; other characters scale against Base and bars cap at 100%. Numerical controls update the preview immediately. Base controls continue to show raw values.

The Character archetype textbox edits the fixed localisation key shown beside it (`char.base.nick` or the fighter's existing `char.<id>.nick`). Saved text lives in `balanceWorkshop.archetypes`, survives file/download/GitHub saves, and becomes the game's English fallback after tune sync or rebuild. The translation-sheet export includes these English overrides; existing translations remain unchanged and need review after wording changes. Text-only saves do not create a numeric Base revision. Same-key concurrent text edits are rejected; unrelated changes are preserved.

Run `npm run test:tuner:preview` for formula parity, the 80% benchmark, bar capping, text validation, merge conflicts, snapshot/restore and translation export checks.

## Tune schema sync (2026-10-10)

Defense exposes shared collision radii, fighter scale and all seven tuned body proportions (0.6 to 1.5, step 0.01). Fighter rows show scaled effective radii and signed Base comparisons; Base shows raw values and logs geometry changes. Reach and perceived bars react immediately to draft proportions. Defaults follow the owner-approved tune on main, including the 1.25 fighter scale and updated punch timing, reach and hit radii.

All fighter properties compare with the current neutral Base: unit multipliers, zero frame offsets and body proportion 1. The Difference from Base column shows the signed absolute change and percentage change. Shared block/dodge rules have zero difference. Base tables keep raw values.

Body proportions are edited only on the individual fighter Defense tabs, against Base = 1. Base Defense retains shared collision radii and the raw fighter scale. Individual proportions do not create new Base history revisions; older logs remain readable.
