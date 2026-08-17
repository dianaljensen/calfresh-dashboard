# Data Dictionary

Consolidated reference for every source feeding the CalFresh Data - Consolidated Sheet. Where a definition is CDSS's own words, it's marked as sourced, with a note on which document it came from, that document's own publication/update date, and when it entered this project. Where something is inferred rather than confirmed, it's marked as such — this project would rather show a gap plainly than guess and be wrong in public. If you can resolve an open item below, please do, and update its provenance note accordingly.

## Sources and provenance

Every definition below traces back to one of these five documents, all archived alongside this file. "CDSS date" is the document's own publication or last-update date; "Added to project" is when it was provided to this project and incorporated here — tracking both matters since CDSS sometimes revises these documents without changing their filename.

| Document | CDSS date | Added to project | Covers |
|---|---|---|---|
| `Definitions_Sources.pdf` | Updated 04/10/17 | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | Master dashboard column definitions, PRI definition, Consortium |
| `Program_Reach_Index_(PRI)_Methodology_Writeup.pdf` | Undated in-document; CDSS academic writeup | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | Full PRI derivation, child-only method, Fresno County worked example |
| `Interpretation of PRI Trends.pdf` | Undated in-document | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | How to interpret PRI trend charts, sampling-noise caveats |
| `22-85.pdf` (ACL 22-85) | October 21, 2022 | 2026-07-28 (Diana) | CF 296 revision (current 135-cell layout), new CF 256 report, PACF/NACF/SNB/TNB definitions, CF 358F/S |
| `22-85E.pdf` (ACL 22-85E) | February 7, 2024 | 2026-07-28 (Diana) | Errata to ACL 22-85: CF 296 SAR 7 discontinuance carry-forward clarification |

Everything else in this file not traced to one of these five documents (mainly the ~280 undefined Master_Monthly columns, and the County Size/Region filter definitions) is sourced as noted inline — either "CDSS column name taken verbatim, no further definition available" or "from Diana's own prior Tableau work," with its own date.

## Acronym Glossary

Confirmed directly from CDSS source documents. Unless noted otherwise, the terms below (FPL through Consortium systems) are sourced from `Definitions_Sources.pdf` (CDSS date 04/10/17, added 2026-07-17):

- **FPL** — Federal Poverty Level
- **SOC** — Share of Cost
- **CFAP** — California Food Assistance Program (covers individuals ineligible for federal SNAP, largely due to immigration status, but eligible for a state-funded equivalent)
- **SSI/SSP** — Supplemental Security Income / State Supplementary Payment
- **MEDS** — Medi-Cal Eligibility Data System (DHCS's data system; CDSS tabulates extracts from it for demographic/eligibility figures)
- **DFA256 / CF256** — CalFresh Participation and Benefit Issuance Report. DFA256 was the form used through April 2024; CF256 replaced it starting May 2024. Any dashboard calculation that historically used DFA256 (see County Size, below) should be re-derived from data we already pipeline rather than treated as a live source.
- **PRI** — Program Reach Index, CDSS's own measure of CalFresh access (full methodology below)
- **PAI** — Program Access Index, the FNS/USDA measure PRI is modeled after and adjusted from
- **ACS** — American Community Survey (Census Bureau)
- **ICT** — Inter-County Transfer
- **ES** — Expedited Service
- **ADP** — Average Days to Process
- **SAR 7** — Semi-Annual Report (the periodic eligibility report certain CalFresh households must file)
- **RRR** — Redetermination / Recertification / Reapplication
- **QC** — Quality Control (federally-governed review process, 7 CFR 275 Subpart C)
- **PMC** — Performance Measurement Counties: the 19 largest counties, reviewed directly by the federal QC sample (Alameda, Contra Costa, Fresno, Kern, Los Angeles, Merced, Monterey, Orange, Riverside, Sacramento, San Bernardino, San Diego, San Francisco, San Joaquin, Santa Clara, Solano, Stanislaus, Tulare, Ventura). The other 39 ("non-PMC") are reviewed by the state and share a single pooled active error rate.
- **C-IV, CalWIN, LRS (LEADER Replacement System)** — the three case-management systems California counties historically used; the `Consortium` column in the raw data tables recorded which one a county was on. **Now historical/deprecated — see the Consortium section below**: all counties have since consolidated onto **CalSAWS** (California Statewide Automated Welfare System), confirmed by Diana 2026-07-29.

**PACF / NACF** — Source: ACL 22-85 (CDSS date October 21, 2022; added to project 2026-07-28 by Diana). Full definitions:

- **Public Assistance CalFresh (PACF)**: a CalFresh household in which members receive some type of public assistance in addition to CalFresh (CalWORKs, Tribal TANF, SSI/SSP, or GA/GR). PACF is an umbrella term with six official CDSS subcategories: **PACF CalWORKs-Only** (all members also receive CalWORKs; excludes WINS), **PACF Tribal TANF-Only**, **PACF SSI/SSP-Only**, **PACF GA/GR-Only**, **PACF Multiple PA** (all members receive some combination of the above program types), and **PACF Mixed** (some members receive only CalFresh, others receive public assistance).
- **Non-Assistance CalFresh (NACF)**: a CalFresh household in which all members do *not* receive any public assistance in addition to CalFresh.
- These same definitions apply identically across the CF 296, CF 256 (successor to DFA 256), and CF 358F/S reports — CDSS standardized the PACF/NACF classification across its whole CalFresh reporting family in this ACL.

**SNB / TNB** — Source: ACL 22-85's CF 256 instructions (CDSS date October 21, 2022; added to project 2026-07-28 by Diana). Effective June 1, 2019, California reversed its CalFresh "cash-out" policy, making SSI/SSP recipients eligible for CalFresh for the first time. Two transitional state-funded programs were created to manage this shift: the **Supplemental Nutrition Benefit (SNB)** Program and the **Transitional Nutrition Benefit (TNB)** Program. TNB Program cases are explicitly *not* reported on the CF 256; SNB Program cases are counted within the CF 256's regular household counts but not broken out as a separate line. Their benefit issuance amounts are excluded from the CF 256's benefit issuance counts. (Full SNB/TNB data-collection methodology is described in ACIN I-80-18, which we don't currently have a copy of — worth requesting if SNB/TNB columns need deeper interpretation.)

## Program Reach Index (PRI) — methodology and how to interpret it

Sources: `Definitions_Sources.pdf` (CDSS date 04/10/17), `Program_Reach_Index_(PRI)_Methodology_Writeup.pdf`, and `Interpretation of PRI Trends.pdf` (both undated CDSS documents) — all added to project 2026-07-17 by Diana, linked from the live CDSS dashboard site.

PRI is CDSS's own measure of CalFresh access: it estimates what share of *eligible* people are actually receiving CalFresh, adjusted for the roughly 2.8 million Californians who are income-eligible but excluded because of immigration status or SSI/SSP receipt (SSI recipients have been categorically ineligible for CalFresh since 1975). It's modeled on the federal FNS Program Access Index (PAI), but adjusts the poverty threshold from 125% to 130% FPL and removes the estimated ineligible population that the raw PAI denominator would otherwise wrongly count.

The core estimation problem PRI solves: there's no direct county-level count of "adults ineligible for CalFresh due to immigration status." CDSS's workaround (the "child-only method") starts from households where children receive CalFresh but the adults don't (CCO households), assumes 94% of those are child-only specifically because of the parents' citizenship status, and applies fixed multipliers (1.77 adults per household with children, 1.70 per household without) to extrapolate a total ineligible-adult estimate per county. Full derivation, worked example (Fresno County), and validation against independent PPIC/DHS estimates are in `Program_Reach_Index_(PRI)_Methodology_Writeup.pdf`.

**This is a modeled estimate with real, CDSS-acknowledged limitations — worth surfacing in the dashboard UI itself, not just this doc, given how easy it'd be to misread a PRI swing as a real change in program access:**

- Year-over-year PRI changes can be driven mostly by ACS sampling noise in the eligible-population estimate, not by real changes in caseload or access. CDSS's own interpretation memo (`Interpretation of PRI Trends.pdf`) walks through a Contra Costa County example where the year-over-year PRI swing tracked the *eligible population estimate* far more than actual caseload changes.
- 41 of the largest counties use single-year ACS estimates; the other 18 smaller counties use five-year estimates (Alpine, Amador, Calaveras, Colusa, Del Norte, Glenn, Inyo, Lassen, Mariposa, Modoc, Mono, Plumas, San Benito, Sierra, Siskiyou, Tehama, Trinity, Tuolumne). **PRI comparisons for those 18 counties are only valid across non-overlapping five-year periods** (e.g. 2007-2011 vs. 2012-2016) — comparing adjacent years for those counties isn't meaningful.
- PRI can come out above 100% or negative in edge cases (small-sample ACS estimates undercounting the eligible population, or finding more CalFresh recipients than estimated eligible people in a tract).
- Address-quality issues in MEDS (PO boxes, one shared address for thousands of beneficiaries in rural counties) affect the finer-grained (non-county) versions of this analysis; less of a concern at the county level, which is what we're mirroring.

**Recommendation for the dashboard:** show a persistent caveat/tooltip on any PRI chart along these lines, rather than presenting PRI as a clean trend line — something to nail down exact wording for once we're building that view.

**Attribution and the PRI target line.** Diana's original Tableau PRI tab included a reference line: "CA PRI Target" at 0.80, with a footnote crediting "The Alliance to Transform CalFresh" (ATC) and recommending "a statewide goal of raising the CalFresh PRI to at least 80% by the end of 2019, with no county below 70%." Diana confirmed 2026-07-29 that she was herself the consultant on this project, under the umbrella of Sacramento State University — so this isn't external work being borrowed, it's her own earlier professional work. ATC no longer exists as an organization. Decision for now: keep a note in the dashboard that this was a goal set by ATC at the time, and that today's users might want to keep using it as a benchmark or set an updated one — rather than silently dropping it or presenting a 2019 goal as current. The same attribution question applies to the Application Outcomes, Days to Approval, and Churn chart designs, which credited "CDSS and Sacramento State University (2018)" and linked to `transformcalfresh.org` — same answer applies (her own prior work, org no longer exists, note the origin rather than erase or fully re-claim it as new).

**PRI map — demand not yet confirmed.** The PRI tab's California county choropleth map is a real candidate for the rebuild, but Diana isn't sure how much current interest there is in PRI or how often advocates actually use it (2026-07-29) — worth confirming actual demand before investing in the mapping dependency this would require.

## County Size and Region (dashboard filter fields, not CDSS source columns)

Source: Diana's own prior Tableau Public dashboard (not a CDSS document) — shared with this project via screenshot on 2026-07-17. These are Diana's own calculated fields, not CDSS's official variable dictionary. Captured here since they're going to be recreated filters; full lists already recorded in `TODO.md` (Phase 4). County Size was originally sourced from DFA256 household counts; since DFA256 is retired (see above), we're deriving it instead from `CalFresh Households` in Master_Monthly, which we already pipeline — confirmed acceptable to Diana (2026-07-17).

## Consortium (Master file column) — now historical/deprecated

Source: `Definitions_Sources.pdf` (CDSS date 04/10/17, added 2026-07-17). Historically recorded which of three case-management systems a county used:

- **C-IV**: Alpine, Amador, Butte, Calaveras, Colusa, Del Norte, El Dorado, Glenn, Humboldt, Imperial, Inyo, Kern, Kings, Lake, Lassen, Madera, Marin, Mariposa, Mendocino, Merced, Modoc, Mono, Monterey, Napa, Nevada, Plumas, Riverside, San Benito, San Bernardino, San Joaquin, Shasta, Sierra, Siskiyou, Stanislaus, Sutter, Tehama, Trinity, Tuolumne, Yuba
- **CalWIN**: Alameda, Contra Costa, Fresno, Orange, Placer, Sacramento, San Diego, San Francisco, San Luis Obispo, San Mateo, Santa Barbara, Santa Clara, Santa Cruz, Solano, Sonoma, Tulare, Ventura, Yolo
- **LRS**: Los Angeles (only)

**Confirmed with Diana 2026-07-29: consortia are no longer a thing.** All counties have since consolidated onto a single statewide system, CalSAWS (California Statewide Automated Welfare System) — ACL 22-85 references this consolidation directly ("upon completion of automation into the eligibility system... California Statewide Automated Welfare System (CalSAWS)"). The three-way C-IV/CalWIN/LRS split, and any filter or chart built around it, is obsolete for current data. Diana's own prior dashboard used Consortia as the sort/group dimension for some churn charts specifically because CalWIN and C-IV appeared to calculate certain churn metrics differently — that caveat no longer applies now that there's one system, but it's worth remembering as an example of a methodology quirk that mattered historically.

## Master Dashboard file — column definitions

Source: `Definitions_Sources.pdf` (CDSS date 04/10/17, added to project 2026-07-17 by Diana). CDSS explicitly defines the following Master_Monthly / Master_Annual columns (paraphrased from the source doc; see the PDF for exact wording):

- **Child-Only Households / Persons in Child-Only Households** — from MEDS; households/persons where everyone is under 18
- **English as a Second Language (ESL)** — from MEDS, using the Language field
- **Children (Under 18) / Elderly (60+)** — from MEDS
- **Total Population / Elderly Population / Population Under 18** — CA Department of Finance population projections (Report P-2/P-3)
- **ESL Population** — ACS 5-Year Estimates (Table B16005), sum of "not well" and "not at all" English speakers
- **SSI Recipients** — State Data Exchange annual average, excluding certain living-arrangement codes
- **Unemployment Rate** — CA Employment Development Department, monthly, not seasonally adjusted
- **Persons Receiving Medi-Cal** — DHCS "Medi-Cal Certified Eligibles" by county
- **CalFresh Households/Persons (Annual & Monthly)** — originally DFA256-sourced (see retirement note above); Annual = 12-month state fiscal year + calendar year average, Monthly = sum for that month
- **Medi-Cal Recipients Likely Eligible for CalFresh** — MEDS point-in-time extract, excludes SSI recipients, undocumented individuals, incarcerated individuals, and those over 200% FPL
- **% CalFresh Recipients Ages 0-4 Enrolled in WIC / WIC Recipients Likely Reachable by CalFresh** — CDPH WIC administrative data + MEDS, point-in-time
- **% Medi-Cal Receiving CalFresh / % CalFresh Persons Receiving Medi-Cal / CalFresh Persons Receiving Medi-Cal** — all from MEDS
- **Total Applications Received / Online Applications Received** — CF296, Items 1 and 1a (cells 1 and 2)
- **Percent of Expedited Service Benefits Issued in 1-3 Days** — CF296 (post-July 2016) or the retired quarterly DFA 296X (pre-July 2016)
- **Applications Approved Within 30 Days (Monthly %)** — CF296 formula, see PDF for exact cells
- **Active Error Rate** — from the federal RADEP system; cumulative FFY data
- **Negative Error Rate / Negative Error Rate Cases Completed** — federal SNAPQCS system; PMC counties get individual rates, the 39 non-PMC counties share one pooled rate
- **Recertification Churn / Total Churn (County Consortia Data)** — reapplication/benefit-continuity ratios, see PDF for exact formulas

**The remaining ~280 of Master_Monthly's 303 columns are not individually defined in CDSS's PDF.** For those, the column name itself (verbatim from CDSS) is the working definition — most are self-explanatory (e.g. `New Applications Age 17 and Under`, `Caseload Race/Ethnicity Hispanic`), but anything ambiguous should get called out here as it comes up during dashboard-building, the same way SNB/TNB is flagged above.

## CF296 and CF18 (per-cell dictionaries)

Source: the report files' own header rows / DataDictionary tabs (real sample xlsx files Diana provided 2026-07-16), cross-checked against ACL 22-85 (CDSS date October 21, 2022, added 2026-07-28) for the current-era CF296 layout. These live in `pipeline/Labels.gs` rather than duplicated here, since they're large (135 + 123 + 68 items) and need to stay in lockstep with the ingest code that uses them (see README's Key Decisions Log for the full reconstruction trail, including two rounds of correction once tested against real historical files). Cross-reference the acronym glossary above (PACF, NACF, ES, ADP, SAR7, RRR, ICT) when reading those labels.

## Impact Estimator Methodology (Applications, Approval Rate, Recertification Churn)

Source: Diana's own original design work (she was the consultant on this project, under the umbrella of Sacramento State University's "Alliance to Transform CalFresh" (ATC) initiative, circa 2018 — see "Attribution and the PRI target line" under the PRI section below for the fuller context). Confirmed with Diana 2026-07-29 from the original Tableau tooltips/screenshots. These are counterfactual "what if this county performed at its own historical best?" estimates, not raw CDSS metrics — reconstructing them requires computing a county's own average and best (max or min, depending on direction) monthly rate since a fixed reference point (July 2016 in the original), then applying the formulas below.

**1. Applications Received → Added Case-Months**
Formula: `added_cases = (max_monthly_applications − avg_monthly_applications) × avg_approval_rate`, then `case_months = added_cases × 6`.
Assumption: if a county raised its monthly applications-received volume from its own average to its own historical maximum (since July 2016), while holding its approval rate at its own average, the resulting additional approved cases are assumed to receive 6 months of CalFresh benefits each.
Worked example (San Francisco): max 3,270, average 2,812, approval rate 63% → (3,270 − 2,812) × 0.63 ≈ 288 added cases → 288 × 6 ≈ 1,729 case-months.

**2. Approval Rate → Added Case-Months**
Formula: `added_cases = avg_monthly_applications × (max_approval_rate − avg_approval_rate)`, then `case_months = added_cases × 6`.
Assumption: same 6-month benefit assumption, but this time holding applications-received at the county's average and raising only the approval rate to its own historical maximum.
Worked example (San Francisco): average applications 2,812, approval rate average 63% vs. max 70% → 2,812 × (0.70 − 0.63) ≈ 197 added cases → ≈1,202 case-months (displayed figures rounded from unrounded intermediate values).

**3. Recertification Churn (Incomplete Recerts Reapplying Within 90 Days) → Added Case-Months**
Formula: `reduced_incomplete_recerts = avg_incomplete_recerts − min_incomplete_recerts`; `case_months_recert = reduced_incomplete_recerts × 1` (one month of benefits per newly-successful recert, since most who do reapply do so within 30 days); then **doubled** to `case_months_total = case_months_recert × 2` as a stand-in for the impact on SAR-7 churn (semi-annual reporting), which isn't separately measured in this metric.
Assumption, in Diana's own words from the original tooltip: *"Without additional data on the volume of churn from SAR7s, these estimates assume that SAR7s may have slightly lower rates due to the lack of interview requirement, but slightly higher rates due to higher overall volume (as some cases do not stay on the program long enough to have the opportunity to recertify). The best guess is that these differences more or less balance out."* — i.e., the 2x multiplier is an explicitly acknowledged rough approximation, not a measured figure, and should be presented as such if rebuilt.
Worked example (San Francisco): average 343, minimum 317 → 26 case-months from recerts alone → doubled to ≈51 total (accounting for rounding).

**Rebuild note:** all three depend on computing a rolling average and best-value-since-a-reference-date per county from CF296 (applications/approval) and CF18 (recertification churn) — the reference point in the original was July 2016; whether to keep that or use a different anchor (e.g., a rolling window, or since CalSAWS consolidation) is an open question, see the Consortia/CalSAWS note below.

## CF report family: what changed in 2022, and what we don't pipeline yet

Source: ACL 22-85 (CDSS date October 21, 2022; added to project 2026-07-28 by Diana) and its errata ACL 22-85E (CDSS date February 7, 2024; added 2026-07-28). ACL 22-85 is CDSS's official specification for the current CF 296 layout, and it's the authoritative source behind the 135-cell `current` variant already reconstructed in `pipeline/Labels.gs`. It's a good independent check: the item text in the ACL's CF 296 instructions (e.g. "Applications received during the month" = Cell 1, "Online applications received during the month" = Cell 2, etc., through Cell 135) can be diffed against `CF296_LABELS` to verify our reconstruction — see the Pending Tasks note in `TODO.md`.

The same ACL also retired the DFA 256 report and replaced it with the **CF 256** (4 parts: Participation, Participation by Federal/State, Benefit Issuances, Disaster CalFresh), and revised two reports we do not currently pipeline at all:

- **CF 358F** (federal-only and combined households) and **CF 358S** (state-only households) — annual reports (due every September 10, covering the July report month) breaking down CalFresh households by race/ethnicity, Hispanic/Latino origin, sexual orientation, and gender identity. Required under 7 CFR 272.6(g)-(h) and Government Code § 8310.8. Not in scope for this project today, but flagged in `TODO.md` as a candidate future data source since it's part of the same CDSS reporting family and might interest advocates working on equity analysis.

ACL 22-85E clarified one specific CF 296 edge case: cases discontinued for a late SAR 7 *before* the end of the report month, with aid reinstated before the end of that same month, count as "carried forward" in Item 4; cases discontinued *after* the report month ends do not. This is a fine-grained rule that could matter if we ever try to reconcile month-to-month caseload counts ourselves rather than just mirroring CDSS's reported totals.
