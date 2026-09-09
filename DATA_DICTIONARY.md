# Data Dictionary

Consolidated reference for every source feeding the CalFresh Data - Consolidated Sheet. Where a definition is CDSS's own words, it's marked as sourced, with a note on which document it came from, that document's own publication/update date, and when it entered this project. Where something is inferred rather than confirmed, it's marked as such — this project would rather show a gap plainly than guess and be wrong in public. If you can resolve an open item below, please do, and update its provenance note accordingly.

## Sources and provenance

Every definition below traces back to one of these five documents, all archived alongside this file. "CDSS date" is the document's own publication or last-update date; "Added to project" is when it was provided to this project and incorporated here — tracking both matters since CDSS sometimes revises these documents without changing their filename.

| Document | CDSS date | Added to project | Covers |
|---|---|---|---|
| `Definitions_Sources.pdf` | Updated 04/10/17 | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | Master dashboard column definitions, PRI definition, Consortium |
| `Program_Reach_Index_(PRI)_Methodology_Writeup.pdf` | Undated in-document; CDSS academic writeup | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | Full PRI derivation, child-only method, Fresno County worked example |
| `Interpretation of PRI Trends.pdf` | Undated in-document | 2026-07-17 (Diana, linked from the live CDSS dashboard site) | How to interpret PRI trend charts, sampling-noise caveats |
| `22-85.pdf` ([ACL 22-85](https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2022/22-85.pdf)) | October 21, 2022 | 2026-07-28 (Diana); live CDSS PDF linked 2026-09-07 | CF 296 revision (current 135-cell layout), new CF 256 report, PACF/NACF/SNB/TNB definitions, CF 358F/S |
| `22-85E.pdf` ([ACL 22-85E](https://www.cdss.ca.gov/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/2022/22-85E.pdf)) | February 7, 2024 | 2026-07-28 (Diana); live CDSS PDF linked 2026-09-07 | Errata to ACL 22-85: CF 296 SAR 7 discontinuance carry-forward clarification |

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
- **Average Days to Approve** (Master_Quarterly, calendar 2014–2020) — dashboard quarterly average days to approve; plotted on Application Outcomes as a step across the three months of each quarter, then replaced by CF18 in any month CF18 exists (from July 2020 / February 2021)
- **Average Days to Dispose - SSI** (Master_Monthly) — average days to dispose applications from households with at least some SSI. `SSI Only Average Days to Dispose Application` is the only-SSI subset and is not on the chart. There is no college-student days-to-process column on the Monthly tab
- **Active Error Rate** — QC sample of households already receiving CalFresh. Share of those reviews that found the wrong benefit amount or an ineligible certification. “Active” means the case was on the program, not that the error is current. Not a fraud rate. From RADEP; cumulative FFY.
- **Negative Error Rate / Negative Error Rate Cases Completed** — QC sample of denials and closings. Share of those reviews that found the “no” was incorrect or a required procedure was skipped. “Negative” means the agency said no. USDA’s current name for this measure is CAPER; CDSS still publishes Negative Error Rate. SNAPQCS; PMC counties get individual rates, the 39 non-PMC counties share one pooled rate.
- **Recertification Churn / Total Churn (County Consortia Data)** — reapplication/benefit-continuity ratios, see PDF for exact formulas

**The remaining ~280 of Master_Monthly's 303 columns are not individually defined in CDSS's PDF.** For those, the column name itself (verbatim from CDSS) is the working definition — most are self-explanatory (e.g. `New Applications Age 17 and Under`, `Caseload Race/Ethnicity Hispanic`), but anything ambiguous should get called out here as it comes up during dashboard-building, the same way SNB/TNB is flagged above.

### Student-scoped block (confirmed Diana, 2026-09-01)

The whole Master_Monthly range from `Applications Approved Containing at Least One Student` through the last column (`Caseload Total Student Count`) is **college-student applications and caseload**, including columns with no “student” in the name. Do not use `New Applications …`, `Denial Reason …`, `Applications Submitted via …`, `Caseload Age/Gender/Language/Race…`, or exemption columns as general-population figures. The Participation view’s “Caseload Age” overlay caveat is the same fact: those age columns sum to `Caseload Total Student Count`, not total CalFresh persons.

Headline application columns (households/applications, not persons):

- `Applications Approved Containing at Least One Student`
- `Applications Denied Containing at Least One Student`
- `Applications Pended Containing at Least One Student`

These are reported monthly from January 2023 onward (Statewide and counties). `New Applications Age Total` does **not** match approved + denied (or + pended); treat age totals as a different unit (likely persons), not a checksum for application counts.

**Who-applied mixes on Application Trends (Diana, 2026-09-04; household size / exemptions 2026-09-04):** Age / Language / Race / Gender are composition of the applicant pool, not outcomes by group. Age uses 17 and under / 18–49 / 50 and over; CDSS names the middle band `New Applications Age 8 to 49`. Language keeps English and Spanish and lumps the rest (including CDSS Other and Missing) as Other. Race/ethnicity uses the nine CDSS `New Applications …` categories. Gender is Female / Male / Other / Declined to state. Denominators are the matching Totals. Hover on Age includes `New Applications Avg Age`. Student volume hover notes `New Applications - ICT Transfers`.

**Exemptions (overlapping, not a mix):** The 16 `New Applications Exemptions- …` columns can overlap on one person. Application Trends plots the types that are typically ≥5% of `New Applications Age Total` statewide: Employment and Training Program, Other Employment and Training Program, LPIE, Employed 20 Hours Week, Care of a Child, Work Study. Tiny / obsolete types stay off the canvas.

**Application sources (Statewide live check, through May 2026):** `Applications Submitted via BenefitsCal` + `Applications Submitted via Code for America` + `Applications Submitted via Other Online Source` + `Applications Submitted via Other Source` equals approved + denied + pended in every statewide month (residual 0). They do **not** equal `New Applications Age Total`. Do not mix `Applications Submitted via Code for America` with `CfA_GCF_apps_submit`. Code for America on the student series continues after June 2025, at a small volume, as BenefitsCal becomes the main channel. The `explore/outcomes-drilldowns` Channels row groups those four into GetCalFresh / BenefitsCal / Other Online / Other.

**Denial-reason identity (Statewide live check, through May 2026):** `Denial Reason - Ineligible` + `Denial Reason - Procedural` is only a subset of `Applications Denied Containing at Least One Student` (e.g. May 2026: 1,747 + 1,280 = 3,027 vs 9,026 denied). Missed interview, failed to complete determination, over income, and the other listed reasons sit alongside those two. The nine `Denial Reason - …` columns together nearly equal total denials after October 2023 (Statewide median residual ~0.1% of denied; May 2026 residual 82). January–June 2023 under-counts (residual 5–13%). There is no withdrawn column. How Application Outcomes groups those reasons on the chart (Approved / Ineligible / Procedurally Denied / Other vs lumped Denied; Denial details ungrouping) is a dashboard recipe, not a CDSS definition. That recipe lives in the collapsed **Wonky & math-y details** fold on Application Outcomes.

The full column list (verbatim CDSS names, including source quirks like `Langugage` / `New Application Asian`) lives in `pipeline/CaseloadStudents.gs` (`STUDENT_TABLE_COLUMNS`) and is copied to `Student_Table_Computed`.

### SSI application outcomes (Master_Monthly)

Households with at least some SSI (not persons, not SSI-only unless labeled):

- `New Apps with at Least Some SSI - Approved`
- `New Apps with at Least Some SSI - Denied`
- `Ineligible Denials - SSI`
- `Procedural Denials - SSI`

Ineligible + Procedural is close to Denied in recent years (~2% leftover). The frontend uses that split (plus **Other** for leftover ≤5% of Denied, never when leftover is negative). When the split is not close — CalWIN counties ~2020–May 2022, where ineligible and procedural are 0 while approved and denied are filled, and some statewide months including a bad November 2025 ineligible reading — the mix falls back to **Approved / Denied** of those two columns rather than staying blank. The dashboard draws that lumped Denied in warm grey (`#A89890`), not the procedural orange, so those months do not look like a procedural surge.

SSI-only is a **subset of denials**, not a full third stack (no SSI-only approved column):

- `SSI Only - Ineligible Denials`
- `SSI Only Procedural Denials`

The Denial details mix on Application Trends is those two columns (households that include only SSI recipients). Hover shows their sum — the SSI-only denied count for that month.

**Who-applied mixes (Diana, 2026-09-04; household size / exemptions 2026-09-04):** SSI Language is `SSI Disposed HH Language - [X]` (households disposed; English / Spanish / Other, same lumping as students). SSI Race is the nine `SSI Person Race/Ethnicity - [X]` columns — persons in new apps disposed, the same total as `SSI Persons in New Apps Disposed`. There are no SSI age bands. `Average Age of SSI Persons Newly Applying` sits on household-size and volume hover. No SSI-app gender columns.

**SSI-only household size (added in the month):** `SSI-only HHs of 1 added in the month`, `SSI-only HHs of 2 added in the month`, `SSI only-HHs of 3+ added in the month` (hyphen placement is CDSS’s), denominator `Total SSI-only HHs added in the month`. New SSI-only cases that month — not the some-SSI disposed mix.

**SSI deductions (overlapping, some-SSI):** `Claim Homeless Deduction - SSI`, `Claim Shelter Deduction - SSI`, `Claim Standard Medical Deduction - SSI`, as a share of some-SSI approved + denied. Parallel `SSI Only Claim …` columns are unused on Application Trends.

Volume under the SSI mix (explore `explore/outcomes-drilldowns`) is `Online Apps - SSI` + `Non-Online Apps - SSI` (households with at least some SSI). That pair is not `SSI Only Online Apps` / `SSI Only Non Online Apps`. Reporting starts June 2019. Statewide, the sum nearly equals approved + denied; do not treat it as a required checksum, and do not impute 5 for starred cells.

There is **no CfA/CBO SSI GetCalFresh column**. `SSA_GCF_apps_submit` is applications submitted by Social Security Administration offices via a GetCalFresh-built channel on behalf of SSI recipients — a type of online SSI app. Statewide it is ≤ `Online Apps - SSI` in overlapping months. Last nonzero count is September 2024 (SSA GCF tool sunset 2024-09-30); the column is 0 through June 2025, then missing. SSI Channels: GetCalFresh (SSA) = `SSA_GCF_apps_submit`; BenefitsCal / Other Online = `Online Apps - SSI` − that; Other = `Non-Online Apps - SSI`. Missing SSA GCF is treated as 0 so the mix continues after the tool ends. If SSA GCF exceeds Online SSI, the month stays blank (cannot subtract). That happens in about 10% of county-months, almost all CalWIN counties December 2019–May 2022 where both SSI online and non-online volume are reported as 0 while SSA GCF is still positive — a missing online/not-online split, not evidence that SSA GCF sits outside SSI. Statewide never overshoots. Non-online SSI may include SSA paper/in-person referrals, but that is not separately published.

### Application channels (Master_Monthly)

- `Applications Received` ≥ `Online Applications Received` ≥ `All_GCF_apps_submit`
- All-application Channels (explore): GetCalFresh = `All_GCF_apps_submit`, BenefitsCal / Other Online = `Online Applications Received` − GetCalFresh, Other = `Applications Received` − `Online Applications Received`. Before January 2019 and after June 2025, GetCalFresh is 0 so the mix is still 100% of received.
- `All_GCF_apps_submit` ≈ `CfA_GCF_apps_submit` + `CBO_GCF_apps_submit` + `SSA_GCF_apps_submit` (small Other when close; skip Other when the sum overshoots, e.g. March 2024). The explore Channels row does not plot that CfA/CBO/SSA split.
- GetCalFresh submit columns stop after **June 2025**. CDSS’s GetCalFresh application assister (including the CBO portal) ended June 30, 2025; from July 2025 new applications go through BenefitsCal. Do not mix student `Applications Submitted via Code for America` with `CfA_GCF_apps_submit`.

## CF296 and CF18 (per-cell dictionaries)

Source: the report files' own header rows / DataDictionary tabs (real sample xlsx files Diana provided 2026-07-16), cross-checked against ACL 22-85 (CDSS date October 21, 2022, added 2026-07-28) for the current-era CF296 layout. These live in `pipeline/Labels.gs` rather than duplicated here, since they're large (135 + 123 + 68 items) and need to stay in lockstep with the ingest code that uses them (see README's Key Decisions Log for the full reconstruction trail, including two rounds of correction once tested against real historical files). Cross-reference the acronym glossary above (PACF, NACF, ES, ADP, SAR7, RRR, ICT) when reading those labels.

**Part C caseload movement (dashboard recipe, confirmed 2026-09-03; same-month 2026-09-03):** Item 7 is gross cases discontinued, including ICT outs. Item 5.e Other approvals are rescinded discontinuances (Diana, from county reporting staff, circa 2016–18). Item 5.d is eligibility reinstated with prorated benefits. Both 5.e and 5.d are plotted in the month CDSS reported them — they typically offset the *prior* month’s Item 7, but they are not shifted onto that month. Item 5.c is incoming ICT (same month). Item 5.a is applications approved (same month). Item 5.b PACF/NACF status change sums to 0 at Total. Recertifications determined ineligible (Item 9.b) can include cases that are not in Item 7, so they are not subtracted from discontinuances on the movement chart.

**CF18 churn (dashboard recipe, draft 2026-09-04):** Current CF18 cells C1–C58, not the ~2017 Tableau extract. Official definitions: [ACL 18-117](https://www.cdss.ca.gov/portals/9/acl/2018/18-117.pdf) and [ACL 18-117E](https://www.cdss.ca.gov/portals/9/acl/2018/18-117E.pdf). User-facing names: **SAR 7** and **recertification (RRR)**. Source: CF 18 CalFresh Churn Monthly Report. Cell map: `pipeline/cf18_labels.json`.

Measurement 1 (Recertification | SAR 7) — 100% = Item 1 (households scheduled that Data Cohort Month). Recertification uses the RRR column; SAR 7 the parallel column. A household is in one column or the other, never both. Combined (default) sums the two columns into one stack; Side by side shows each clock. Stack bottom→top: no loss of benefits (Items 2+4+6a), late with loss (Item 6b), recertification/SAR 7 ineligible (Items 3+5+8), no renewal and no return within 4 months (Item 1 minus the rest), **Reapplications** on top (Items 9–16). Dark grey ineligible is the recert or SAR 7 determination. Orange is a later new application after a missed recert or SAR 7; eligible reapplications are churn, ineligible includes withdrawals. Snapshot due-chart hover is the five bands only. Lag months live in Time to reapply (% of Items 9–16; four bars sum to 100%). Eligible vs ineligible of those reapplications live in Reapplication Outcomes, and of each lag month on Time to reapply hover (plain-language sentences; denom = Items 9–16, not Item 1). Recertification / SAR 7 Outcomes by County hover is the five bands plus the group Sort-by rate, not those nested splits. County Report type Combined sums Recertification and SAR 7 counts (default Combined, sort by No loss, group by county size). Item 1 is not an auto-sum of the outcome cells; the leftover *is* the no-return band. Item 6 = 6a+6b exactly; the chart uses the split. Item 7 (average days of lost benefits for Item 6b) is in the **Estimated Lost Benefits** fold-out under the due chart, and still a hover footer. The fold-out total is late-with-loss dollars plus eligible-reapplication dollars (Combined and Side by side sum Recert + SAR 7; a single-clock Show uses that clock only). Dollar estimates: late with loss = Item 6b × (Item 7 days ÷ 30) × average issuance per household; eligible reapplications = Items 9+11+13+15 × 1/2/3/4 months of lag × the same rate. Average issuance is California Total Issuances ÷ CalFresh Households from the Monthly tab ($198/household-month fallback). Does not include no-return or ineligible reapplications. Do not impute 5 on a starred Item 1 total.

Measurement 2 (Who applied that month) — 100% = Item 17 (all CalFresh/CFAP applications disposed that month, not the churn-only pile). Bands, bottom→top: new / not recently on (Item 17 − Item 18), Other Recently On (Item 18 − Item 19), Recent SAR 7 Due (C39), Recent Recert Due (C40). Item 18 is participated in the prior four months. Hover nests restoration and 1 vs 2–4 months prior (approved vs denied) under each due band — restored or closed in those months before the application (ACL 18-117 Items 20–28), not after. This mix uses a forest / olive / wine / rose palette, not the due-chart orange/blue. Do not impute 5 on a starred Item 17 total. This is a different clock from Measurement 1 (same file row, different meaning) — do not shift the series to line up. The county lineup sorts by Recent Recert & SAR 7 Due (C39 + C40 combined counts), Other Recently On, or New (default Recent Recert & SAR 7 Due).

Days to approval (CF18 items 29–38) stays on Application Outcomes, not the Churn view.

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

**Application Outcomes 1% call-out (Diana, 2026-09-08):** a simpler current-era cousin of the Approval Rate estimator, not the max-vs-average table. On Application Trends: 1% of applications disposed in the last month of the date range, for the selected place, as additional cases × California average issuance per household (Total Issuances ÷ CalFresh Households; $198/household-month fallback). Compare Populations lists All / college student / SSI using each population’s disposed count. CDSS does not publish student- or SSI-specific issuance, so those rows use the all-household rate. One month of benefits. The household may or may not have been eligible.

## CF report family: what changed in 2022, and what we don't pipeline yet

Source: ACL 22-85 (CDSS date October 21, 2022; added to project 2026-07-28 by Diana) and its errata ACL 22-85E (CDSS date February 7, 2024; added 2026-07-28). ACL 22-85 is CDSS's official specification for the current CF 296 layout, and it's the authoritative source behind the 135-cell `current` variant already reconstructed in `pipeline/Labels.gs`. It's a good independent check: the item text in the ACL's CF 296 instructions (e.g. "Applications received during the month" = Cell 1, "Online applications received during the month" = Cell 2, etc., through Cell 135) can be diffed against `CF296_LABELS` to verify our reconstruction — see the Pending Tasks note in `TODO.md`.

The same ACL also retired the DFA 256 report and replaced it with the **CF 256** (4 parts: Participation, Participation by Federal/State, Benefit Issuances, Disaster CalFresh), and revised two reports we do not currently pipeline at all:

- **CF 358F** (federal-only and combined households) and **CF 358S** (state-only households) — annual reports (due every September 10, covering the July report month) breaking down CalFresh households by race/ethnicity, Hispanic/Latino origin, sexual orientation, and gender identity. Required under 7 CFR 272.6(g)-(h) and Government Code § 8310.8. Not in scope for this project today, but flagged in `TODO.md` as a candidate future data source since it's part of the same CDSS reporting family and might interest advocates working on equity analysis.

ACL 22-85E clarified one specific CF 296 edge case: cases discontinued for a late SAR 7 *before* the end of the report month, with aid reinstated before the end of that same month, count as "carried forward" in Item 4; cases discontinued *after* the report month ends do not. This is a fine-grained rule that could matter if we ever try to reconcile month-to-month caseload counts ourselves rather than just mirroring CDSS's reported totals.
