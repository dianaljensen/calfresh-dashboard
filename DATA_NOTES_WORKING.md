# Data notes working copy (temporary)

Scratch file for rewriting the Applications footer. View Data notes are live. **Wonky & math-y details** is a collapsed fold after Data notes (`#methods`). Sources is slimmed to the two named reports.

**Goal for the view:** Data Notes are a short list of things a lot of people might need while looking at the charts. Column names, CF296 item numbers, CalWIN quirks, and plot-as-5 rules live in the collapsed **Wonky & math-y details** fold at the bottom of the page.

**Public name for `Master_Monthly`:** **CDSS Data Dashboard Monthly tab:** the Monthly sheet in the Excel file on the [CDSS dashboard page](https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-dashboard). Use that in every visible place; keep `Master_Monthly` in code and internal docs.

Participation Trends (`index.html`) has its own short footer; pasted at the bottom for the methods-page idea.

### Decisions so far

- **Note 1** (CF296 current vs legacy combined by item meaning): **methods only.** Off the page. The view already names CF296.
- **Note 2** (`*` / small cells / plot as 5): **short privacy / ~ note on the page**; recovery recipe stays on the methods page. **Agreed; live.**
- **Note 3** (next-month shift of Other approvals / reinstated): **do not shift.** Keep them in the month CDSS reported them. Live on **Participation Trends** (Caseload movement), not Applications.
- **Note 4** (ICT in vs outs): **its own view note, ICT only.** Live on **Participation Trends**. Other approvals stay in note 3.
- **Note 6** (Channels recipes): **short view note; all column math → Wonky & math-y details.** The Data notes link opens `#methods`. **Agreed; live.**
- **Note 7** (student volume column / not a checksum): **methods only.** **Dropped from the page.**
- **Note 8** (student Channels grouping): **dropped:** duplicate of note 6 methods.
- **Note 9** (student-scoped columns vs how we treat denials): column meaning → `DATA_DICTIONARY.md`. Chart grouping → methods. Off the page.
- **Note 10** (SSI volume): **view = CalWIN 2019–2022 zeros only.** Column recipe → methods. Do not mention CF296. **Agreed; live.**
- **Note 11** (SSI outcomes mix): rewritten for best-available data; CalWIN / overshoot months = lumped Denied (warm grey). Nov 2025 / no pended-withdrawn → methods. **Agreed; live.**
- **Note 11b** (SSI Denial details): **its own view note.** Only-SSI ineligible vs procedural, a subset of some-SSI denials. **Agreed; live.**
- **Note 12** (hover denominators): **dropped from the page.** Hover already names the count. Recipe stays in methods / standing UI rule.

---

## 1. On the page right now (`outcomes.html`, quoted)

### Sources

> Data: CDSS CF296: Applications, Expedited Service, and Recertifications (ACL 22-85) and the CalFresh Data Dashboard.

Slimmed 2026-09-03; recipes moved into Methods.

### Definitions

> County Size groups: X-Large = 6 largest counties by CalFresh households, Large > 25,000 households, Medium 5,000–25,000, Small < 5,000, computed from the latest available month of the CDSS Data Dashboard Monthly tab.

### Data notes (each bullet as it appears)

**1. Off the page (methods)**  
CF296 current-era (FY2025-26+) and CF296_Legacy (FY2016-17 through FY2024-25) are combined by item meaning.

**2. Rewritten, live**  
> CDSS hides small numbers to protect privacy. When that happens, we still show the mix, but those percents are estimates (they start with ~). If too much of a month is hidden, we leave it blank rather than guess.

**3. Live on Participation Trends (`index.html`)**  
> Caseload movement is certified cases from CF296, not the same as Total Participants (households and persons who participated that month, from the CDSS Data Dashboard Monthly tab). Each figure is in the month CDSS reported it. Other approvals and reinstated cases typically offset discontinuances from the prior month.

**4. Live on Participation Trends (`index.html`)**  
> ICT in is an inter-county transfer into this county. Transfers out are already inside discontinuances. CDSS does not publish a separate ICT-out count.

**5. Rewritten, live**  
> Total applications is how many came in that month, from the CDSS Data Dashboard Monthly tab, not from CF296. The stacked percents are how that month’s decisions broke down; not the same count.

**6. Rewritten, live**  
> Channels (expandable row) use the same three names, but are calculated based on available variables for each population. [See wonky & math-y details](#methods).

**7. Off the page (methods)**  
College student volume is `New Applications Age Total` on the Monthly tab. It is not CF296 applications received, and it is not a checksum of approved + denied + pended.

**8. Dropped** (dup of note 6 methods)

**9. Off the page (split)**  
Column meaning: `DATA_DICTIONARY.md` → Student-scoped block.  
Chart recipe (methods): when the nine denial-reason columns are close to total denials, stack Approved / Ineligible / Procedurally Denied / Other. Otherwise Approved / Denied (early 2023 under-count). Denial details ungroups the large types.

**10. Rewritten, live**  
> Some CalWIN counties reported 0 SSI applications received from December 2019 through May 2022. SSI outcomes still exist those months.

**11. Rewritten, live**  
> SSI household outcomes are displayed according to best available data from the CDSS Data Dashboard Monthly tab. When ineligible + procedural is close to denied, the mix is shown as approved / ineligible / procedural / other. CalWIN counties ~2020–May 2022 show total denials, but not a break-out of ineligible vs. procedural, and are shown as a single lumped Denied in warm grey. Months where the ineligible / procedural split overshoots total denials are also shown this way.

**11b. Rewritten, live (split out of 11)**  
> SSI Denial details is households with only SSI recipients: ineligible vs procedural, a subset of some-SSI denials.

**12. Dropped**  
Hover already names the denominator (applications disposed / received / denied). No footer note.

---

## 2. View Data notes (list)

Not Q&A: same shape as the footer. Live items match `outcomes.html`.

- CDSS hides small numbers to protect privacy. When that happens, we still show the mix, but those percents are estimates (they start with ~). If too much of a month is hidden, we leave it blank rather than guess.
- Total applications is how many came in that month, from the CDSS Data Dashboard Monthly tab, not from CF296. The stacked percents are how that month’s decisions broke down; not the same count.
- Channels (expandable row) use the same three names, but are calculated based on available variables for each population. See wonky & math-y details.
- Some CalWIN counties reported 0 SSI applications received from December 2019 through May 2022. SSI outcomes still exist those months.
- SSI household outcomes are displayed according to best available data from the CDSS Data Dashboard Monthly tab. When ineligible + procedural is close to denied, the mix is shown as approved / ineligible / procedural / other. CalWIN counties ~2020–May 2022 show total denials, but not a break-out of ineligible vs. procedural, and are shown as a single lumped Denied in warm grey. Months where the ineligible / procedural split overshoots total denials are also shown this way.
- SSI Denial details is households with only SSI recipients: ineligible vs procedural, a subset of some-SSI denials.

Leftovers from the old Q&A that are **not** Data notes (info-tip, Definitions, or methods): All / student / SSI don’t overlay; procedural vs ineligible; GetCalFresh sunset; county size groups.

### Wonky & math-y details (live, collapsed after Data notes)

`#methods` on `outcomes.html`. Label is **Wonky & math-y details**. Starts closed. Grouped under short headings. The Data notes Channels link opens it.

The live bullets match the fold. Internal note numbers below are just our scratch map.

- **Note 1:** CF296 current-era (FY2025-26+) and CF296_Legacy (FY2016-17 through FY2024-25) are combined by item meaning: a Sources implementation detail, not a view note
- **Note 2 detail:** CDSS uses `*` both for counts under 11 and for some larger complementary totals. When exactly one of the five outcome cells is starred, recover from disposed = approved + ineligible + procedural + withdrawn if that number is over 10. Remaining under-11 cells are plotted as 5 (never shown as a count); hover percents get `~`. Two or more large hidden cells, and counties listed as not reporting, stay blank. A complete month next to those gaps still draws. Do not impute 5 on applications-received / volume.
- **Note 3 detail:** Part C items all in the report month: 5.a applications approved, 5.e Other approvals, 5.d reinstated prorated, Item 7 full discontinuances. Omit 5.b (Total is 0). Do not subtract Item 9.b from Item 7. PACF + NACF when TOTAL is starred; starred part plotted as 5. Other approvals typically rescinded discontinuances (offset prior-month Item 7, not shifted onto it).
- **Note 4 detail:** Item 5.c ICT in (incoming only). ICT outs are inside Item 7; CF296 has no ICT-out cell. Statewide, ICT in and those outs should cancel in the net.
- **Note 5+ naming:** Our pipeline tab is `Master_Monthly`. User-facing copy says **CDSS Data Dashboard Monthly tab**. Column names stay on the methods page.
- **Note 6 detail (Channels):** All applications and college students share GetCalFresh, BenefitsCal / Other Online, and Other. SSI uses GetCalFresh (SSA) for the first band.
  - All applications: GetCalFresh = `All_GCF_apps_submit`, BenefitsCal / Other Online = `Online Applications Received` − GetCalFresh, Other = `Applications Received` − Online (100% of received). After June 2025 GetCalFresh is 0; dashed marker at July 2025 (assister ended June 30, 2025).
  - College students: GetCalFresh = `Applications Submitted via Code for America`, BenefitsCal / Other Online = Other Online Source + BenefitsCal, Other = Other Source. Not `CfA_GCF_apps_submit`. Code for America continues after June 2025 at a small volume. The four source columns still sum to student approved + denied + pended.
  - SSI: GetCalFresh (SSA) = `SSA_GCF_apps_submit` (SSA office filings via GetCalFresh on behalf of SSI recipients). BenefitsCal / Other Online = `Online Apps - SSI` − GetCalFresh (SSA). Other = `Non-Online Apps - SSI`. Last nonzero statewide SSA GCF is September 2024. If SSA GCF exceeds Online SSI, leave the month blank. CalWIN counties often reported 0 SSI online/non-online December 2019–May 2022 while SSA GCF was still filled.
- **Note 7 detail:** College student applications (volume) is Monthly-tab `New Applications Age Total`. It is not CF296 applications received, and it is not a checksum of approved + denied + pended.
- **Note 9 detail (student mix, chart recipe):** Mix is share of applications disposed (approved + denied), starting January 2023. Pended is still in process: hover only, not in the mix. When the nine `Denial Reason - …` columns are close to total denials: Approved / Ineligible / Procedurally Denied / Other. Ineligible = ineligible + ineligible CF student + over income. Procedurally Denied = procedural + missed interview + failed to provide income + failed determination. Other = unavailable + out of the home + residual. Otherwise Approved / Denied of that two-part total (early 2023, when the reasons under-count). Denial details ungroups the six large types; Other there is unavailable, out of the home, ineligible CF student, and residual. Named Ineligible + Procedural alone are only a subset of denials (column identity in `DATA_DICTIONARY.md`).
- **Note 10 detail (SSI volume):** `Online Apps - SSI` + `Non-Online Apps - SSI` (households with at least some SSI, not the SSI-only online/non-online pair). Reporting starts June 2019. Statewide the sum is nearly approved + denied from mid-2022 on; not a required checksum. Starred cells stay blank (do not impute 5). CalWIN counties often reported 0 for both volume columns December 2019–May 2022 while SSI outcomes still exist (view note). Do not compare this series to CF296: CF296 has no SSI-specific application cells.
- **Note 11 detail (SSI mix):** Households with at least some SSI. When ineligible + procedural is close to denied: Approved / Ineligible / Procedurally Denied / Other. Otherwise Approved / lumped Denied `#A89890` (warm grey, never procedural orange): CalWIN ~2020–May 2022, and months where the split overshoots (including a bad November 2025 statewide ineligible reading). No pended or withdrawn column. Do not blank months that have approved and denied.
- **Note 11b detail:** SSI Denial details is `SSI Only - Ineligible Denials` vs `SSI Only Procedural Denials`: households with only SSI recipients, a subset of some-SSI denials.
- **Note 12 detail (hover, not a view note):** Stacked mix hover includes the count those percents are of: applications disposed (all), college student applications disposed (approved or denied, not `New Applications Age Total`), SSI household applications disposed. Student mix hover also notes applications still pended. Channels hover is applications received (all / SSI) or the student source total. Denial details hover is applications denied.
- Isolated stack slices (complete month between two gaps still draws)

---

## 3. Wonky & math-y details

Live as a collapsed `<details>` after Data notes, with topic headings. No separate methods page.

`DATA_DICTIONARY.md` still holds CDSS column identity; the fold is *our* chart recipes.

---

## 4. Participation Trends footer (for the same split later)

**Sources:** CDSS CalFresh Data Dashboard and CF296.

**Definitions:** same county-size groups (provisional). EAs = Emergency Allotments.

**Data notes:**

- Less-than-monthly reports are shown as step functions.
- $ Issued county breakdowns start Sep 2023; earlier is a gap except California. DFA/CF256 later.
- One-month 40%+ jump/drop that rebounds is treated as a reporting error (gap, not interpolated). Newest month can’t be checked until the next month is in.
- Caseload movement is certified cases from CF296, not the same as Total Participants. Each figure is in the month CDSS reported it. Other approvals and reinstated typically offset prior-month discontinuances.
- ICT in is an inter-county transfer into this county. Transfers out are already inside discontinuances. CDSS does not publish a separate ICT-out count.

**Wonky fold:** CF296 current/legacy combined by item meaning; Part C recipe; ICT.

---

## 5. Next

- [x] Note 1 → methods (Sources clarification, not a view note)
- [x] Note 2 → simple view sentence; recipe → methods
- [x] Note 3 → same-month reporting; view note about offsetting prior-month discontinuances (chart already live)
- [x] Note 4 → ICT-only view note (Other approvals stay in 3)
- [x] Note 5 → say CDSS Data Dashboard Monthly tab, not Master_Monthly
- [x] Note 6 → short view sentence; column recipes → Wonky & math-y details. Link opens `#methods`.
- [x] Note 7 → methods only (in the fold)
- [x] Note 8 → dropped (dup of 6)
- [x] Note 9 → dictionary for column meaning; methods for how we group denial reasons (in the fold)
- [x] Note 10 → CalWIN zeros on the page; volume recipe → methods (no CF296 in the view note)
- [x] Note 11 → best-available mix + lumped Denied grey; Nov 2025 → methods
- [x] Note 11b → SSI Denial details as its own note
- [x] Note 12 → dropped from Data notes (hover is enough; recipe in methods)
- [x] Swap note 2 to the short privacy/~ sentence; drop note 1 from Data notes
- [x] Slim Sources
- [x] Wonky & math-y details as a collapsed fold after Data notes
- [x] Same pass on Participation when we’re ready (Caseload movement + CF296 notes re-homed 2026-09-03)
