---
name: Verified contact export scope
description: Which source rows may be included in downloadable WhatsApp contact lists.
---

A filtered positive-contact export must include only source rows with provider status `valid` and preserve the original columns. Do not include invalid, unknown, or unverified rows.

For Excel imports, the current checker processes the first worksheet only. Do not copy unchecked worksheets into a file presented as verified; if full-workbook export is needed, verify each worksheet or clearly disclose the limitation.

**Why:** Users rely on the filtered file as a list of confirmed WhatsApp contacts. Including unverified rows would misrepresent the results.

**How to apply:** Keep downloadable contents aligned with the results actually checked. Extend multi-sheet support only when every included contact has been verified.