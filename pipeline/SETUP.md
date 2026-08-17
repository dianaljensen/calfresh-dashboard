# Setup steps (one-time)

These have to happen in your own Google account — I can't click through OAuth consent or
sharing-permission changes on your behalf. Should take about 20 minutes end to end,
plus however long the historical backfill takes to finish in the background.

## 1. Open the Sheet and its script editor

Open **CalFresh Data - Consolidated** (in your `CalFresh Data Dashboard Reboot` folder),
then **Extensions > Apps Script**.

## 2. Add the script files

Delete the default empty `Code.gs` the editor gives you, then create each of these
files (File icon > New > Script file) and paste in the matching content from this folder:

- `Config.gs`
- `Utils.gs`
- `Labels.gs`
- `SourceDiscovery.gs`
- `IngestMaster.gs`
- `IngestCF.gs`
- `Retention.gs`
- `Main.gs`

File names inside the Apps Script editor don't need to match exactly, but keeping them
the same makes this much easier to maintain later.

## 3. Enable two advanced services: Drive API and Sheets API

In the Apps Script editor, look at the far-left vertical strip of icons (Editor,
Triggers, Executions, Project Settings). Click into the **Editor** view if you're not
already there — inside it, the left-hand panel has two sections stacked on top of each
other: **Files** (where `Config.gs`, `Main.gs`, etc. live) and, below that, **Services**.

Next to the word "Services" there's a small **+** button (separate from the `+` you used
to add script files above — easy to mix up). Click that **+**, and a dialog pops up
listing Google APIs (Admin SDK, BigQuery, Calendar, Docs, Drive API, Gmail, Sheets API,
...). You need to add **both** of these, one at a time (click one, click Add, then click
the `+` again for the second one):

- **Drive API** — lets the script convert a downloaded `.xlsx` into a native Google
  Sheet. Without it, `Drive.Files.create` in `Utils.gs` fails with "Drive is not defined."
- **Sheets API** — lets the script read data back out of that converted Sheet using a
  read-only call, instead of opening it as a full spreadsheet. This is part of keeping
  the permissions this script asks for narrow (see step 4) — without it, `Sheets.Spreadsheets.Values.get`
  in `Utils.gs` fails the same way.

Once added, you should see two new lines under Services in that left panel (something
like "Drive" and "Sheets", each with a version number).

## 4. Narrow the permissions this script will ask for

By default, Apps Script rounds up to the broadest scope it thinks the code might need —
"edit, create, and delete everything in your Drive," "edit, create, and delete every
Sheet in your account" — even though this script only ever touches files it creates
itself. This step tells Google to ask for the narrower, more honest set of permissions
instead.

In **Project Settings** (the gear icon in the left strip), check the box **"Show
'appsscript.json' manifest file in editor."** Go back to the **Editor** view — a new
file called `appsscript.json` now appears at the bottom of your Files list. Open it,
select all, and replace its contents with the `appsscript.json` in this folder.

With this in place, the authorization prompt in the next step should ask for:
"Connect to an external service," "See, edit, create, and delete only the specific
Google Drive files you use with this app," and "See your Google Sheets spreadsheets" —
notably *not* "all of your Drive files" or "all your Sheets, edit and delete." If step
5's consent screen still shows the broader wording, double check this file saved
correctly (Ctrl/Cmd+S) and that both services from step 3 are still listed.

## 5. Run the read-only sanity check first

`testDiscovery` isn't a separate script to add — it's a function that lives inside
`Main.gs`, alongside `PIPELINE_MAIN`, `runInitialBackfill`, and `installWeeklyTrigger`.
The function dropdown at the top of the editor lists every function from every `.gs`
file in the project combined, so if you don't see `testDiscovery` there, it almost
always means one of these two things:

- **`Main.gs` hasn't been added/pasted yet** — go back to step 2 and confirm all 8
  files exist in the left-hand Files list, each with the matching content pasted in.
- **The project hasn't been saved** — the function dropdown only refreshes after a
  save. Press **Ctrl+S** (or **Cmd+S** on Mac), or click the little disk/save icon
  near the top, then check the dropdown again.

Once `testDiscovery` shows up: select it in the function dropdown, then click **Run**.
The first time, Google will ask you to authorize the script — this is the moment to
check that the permissions match what step 4 describes, then accept.

Then open **View > Logs** (or **Executions** in the left sidebar) and check what it
found. You're looking for:
- A real `.xlsx` URL and an `updatedText` date for the dashboard master file
- A list of fiscal years for CF296 and CF18, each with a URL and a date

**If any of these come back empty or null**, the page-parsing regex in
`SourceDiscovery.gs` needs adjusting — see the comment at the top of that file. This is
the one part of this script I couldn't verify without seeing CDSS's actual page HTML, so
it's the most likely thing to need a fix here. Let me know what the logs show and I can
help adjust the regex.

## 6. Run the historical backfill

Once `testDiscovery` looks right, select **runInitialBackfill** and click Run. This
queues every available fiscal year of CF296/CF18 plus the master file, then works
through them a few at a time (Apps Script caps each execution at 6 minutes, so a big
backfill needs several automatic continuation runs — you don't need to keep clicking
Run, it schedules itself to keep going every few minutes until the queue is empty).

Check the **Pipeline_Log** tab in the Sheet periodically to watch progress, or check
**Executions** in the Apps Script editor.

## 7. Install the weekly trigger

Once the backfill finishes (Pipeline_Log will show "Run complete"), select
**installWeeklyTrigger** and click Run once. From here on, the pipeline checks for new
data every Monday around 3am on its own — no further action needed unless you want to
change the cadence (edit the `.everyWeeks(1)` line in `Main.gs`, then re-run
`installWeeklyTrigger`).

## 8. Publish the Sheet for the frontend to read

**File > Share > Publish to web**, publish the entire spreadsheet, and leave it set to
auto-republish when changes are made. This is a sharing-permissions change, so it has to
be you — I'll use the resulting published URL once we build the Vercel site.

---

Once all eight steps are done, let me know and send me the published-to-web link from
step 8 — that's what the dashboard frontend will read from.

## Adding SSILinked.gs to an already-set-up pipeline (2026-08-12)

If you've already done steps 1–8 above, you don't need to redo any of them for this —
`SSILinked.gs` only reads/writes tabs in your own already-bound Sheet via plain
`SpreadsheetApp` calls, so it needs no new Advanced Services and no new OAuth consent.

1. In the Apps Script editor, add one new file (File icon > New > Script file) named
   `SSILinked.gs` and paste in the contents of `pipeline/SSILinked.gs` from this folder.
2. Save (Ctrl/Cmd+S).
3. Select **testSSILinked** in the function dropdown and click **Run**. Check
   **Executions** (or **View > Logs**) for the summary line, and check the new
   **SSI_Linked_Computed** tab it creates in the Sheet — spot-check a row or two against
   the source columns in Master_Monthly if you want to double-check the math before
   trusting it.
4. That's it — `PIPELINE_MAIN()` now calls `computeSSILinked_()` automatically at the end
   of every run (including the existing Monday 3am trigger), so this recomputes on its own
   from here on. Since the whole spreadsheet is already published to the web with
   auto-republish on, the new tab is reachable the same way as any other:
   `.../gviz/tq?tqx=out:csv&sheet=SSI_Linked_Computed`.

## Adding CaseloadStudents.gs (2026-08-13, expanded into a full student table 2026-08-13)

Same deal as SSILinked.gs above — no new services or consent needed.

1. Add a new file named `CaseloadStudents.gs`, paste in the contents of
   `pipeline/CaseloadStudents.gs` from this folder, save. (If you already added a smaller
   single-column version of this file earlier the same day, just replace its contents —
   it's the same file, now pulling ~117 columns instead of 1.)
2. Select **testCaseloadStudents** in the function dropdown and click **Run**. Check
   **Executions** for the summary line — it'll tell you how many of the ~117 requested
   columns actually resolved, and log the exact names of any that didn't (some mismatch on
   the first pass is expected, given the column count — paste any "not found" names back so
   they can get fixed). Check the new **Student_Table_Computed** tab it creates.
3. `PIPELINE_MAIN()` now calls `computeCaseloadStudents_()` automatically too, right after
   the SSI-linked computation — no further action needed. Reachable the same way:
   `.../gviz/tq?tqx=out:csv&sheet=Student_Table_Computed`.
