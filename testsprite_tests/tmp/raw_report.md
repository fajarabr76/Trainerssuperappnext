
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** trainers-superapp-next
- **Date:** 2026-04-11
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Generate and download a Service QA report
- **Test Code:** [TC001_Generate_and_download_a_Service_QA_report.py](./TC001_Generate_and_download_a_Service_QA_report.py)
- **Test Error:** TEST FAILURE

Report generation did not complete and no downloadable .docx was produced.

Observations:
- The page showed the error message: 'An unexpected response was received from the server.'
- The Generate report control is disabled/greyed and no ready/download state or download link is visible
- Two attempts to generate the report were made but neither produced a .docx to download
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/c90373e1-d2f2-4373-b74b-439fbc64ff8c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Generate and download an Individual agent QA report
- **Test Code:** [TC002_Generate_and_download_an_Individual_agent_QA_report.py](./TC002_Generate_and_download_an_Individual_agent_QA_report.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/69b5fec9-cf18-469c-bbde-632ad2906438
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Filter QA Dashboard charts by date range and team
- **Test Code:** [TC003_Filter_QA_Dashboard_charts_by_date_range_and_team.py](./TC003_Filter_QA_Dashboard_charts_by_date_range_and_team.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/cd5f61c5-0c55-4faa-92f9-9935c9a8ffce
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Access control gates Report Maker for unauthenticated users
- **Test Code:** [TC004_Access_control_gates_Report_Maker_for_unauthenticated_users.py](./TC004_Access_control_gates_Report_Maker_for_unauthenticated_users.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/1404cc64-5443-459e-aafb-dc61c5d2d9f6
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Access control gates QA Dashboard for unauthenticated users
- **Test Code:** [TC005_Access_control_gates_QA_Dashboard_for_unauthenticated_users.py](./TC005_Access_control_gates_QA_Dashboard_for_unauthenticated_users.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/f19671a5-f837-4bbc-ad8d-2a1879ff5d2f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Service report required-field validation blocks submission
- **Test Code:** [TC006_Service_report_required_field_validation_blocks_submission.py](./TC006_Service_report_required_field_validation_blocks_submission.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/c71e6e9e-c07b-4af9-b37e-51e05b6cef7a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Generate a Service report with an optional team filter applied
- **Test Code:** [TC007_Generate_a_Service_report_with_an_optional_team_filter_applied.py](./TC007_Generate_a_Service_report_with_an_optional_team_filter_applied.py)
- **Test Error:** TEST FAILURE

Generating the Service report did not produce a downloadable file or a ready state.

Observations:
- After clicking 'Generate report' and waiting, no download link or '.docx' file was shown.
- No 'Ready' state message or generated reports list appeared on the page.
- The report form remained visible with messages like 'Tidak ada data Pareto' / 'Tidak ada tren', indicating no generated content was available for download.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/d38e6bd6-6bec-431d-8633-88d33bc28197
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 QA Dashboard supports single-day date range filtering
- **Test Code:** [TC008_QA_Dashboard_supports_single_day_date_range_filtering.py](./TC008_QA_Dashboard_supports_single_day_date_range_filtering.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/441e3f1d-7327-484c-8139-440943afb998
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Daily report generation limit blocks the 11th request
- **Test Code:** [TC009_Daily_report_generation_limit_blocks_the_11th_request.py](./TC009_Daily_report_generation_limit_blocks_the_11th_request.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached because the app is stuck on the login modal after submitting credentials.

Observations:
- After submitting the provided credentials the login modal shows a persistent loading spinner and the dashboard never appears.
- No navigation to /qa-analyzer/reports was possible, so report generation cannot be performed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/128243d6-2c9f-4c1d-b234-6757024f988f
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Switching report type resets incompatible inputs
- **Test Code:** [TC010_Switching_report_type_resets_incompatible_inputs.py](./TC010_Switching_report_type_resets_incompatible_inputs.py)
- **Test Error:** TEST FAILURE

Switching between report types did not clear agent selection when returning to Individu (Individual). The agent selection persisted after switching to Layanan (Service) and back, which can lead to accidental mixed-criteria submissions.

Observations:
- After selecting 'Adhitya Wisnuwadhana (Tim Call)' in Individu, switching to Layanan hid the agent field.
- Switching back to Individu showed the agent still selected (the dropdown displays 'Adhitya Wisnuwadhana (Tim Call)')

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/71102786-0100-4251-be10-a490f65885bb/83297f81-6807-4af8-928c-57626be43b9f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **60.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---