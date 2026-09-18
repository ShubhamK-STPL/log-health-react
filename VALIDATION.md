# Validation performed

- Production build: `npm run build` passed (React 19.2.0 / Vite 7.2.2).
- Six automated analysis tests passed using `npm test`.
- Supplied error log: 825 valid entries, zero skipped records, 825 errors; 17 underlying-message groups; 21 affected request paths.
- Missing procedure category: 482 entries.
- Deadlock category: 158 entries, including wrapper exceptions identified through their stack-trace first line.
- Inclusive UTC date boundaries, inverted date range, malformed JSON records, missing timestamps, duplicate request identifiers, filters, report contents and prioritization rules are covered by the tests.
- Production local server delivered the entry point and compiled assets.
- Browser UI execution and visual QA were not completed: no browser was preinstalled and browser download timed out. Build/tests do not substitute for browser interaction testing.
- Real uploaded log contents are not included in this package. `examples/demo.jsonl` is synthetic.

Manual acceptance checklist:
1. Start `node serve.mjs`; open http://localhost:4173.
2. Upload `examples/demo.jsonl`: expect 40 error entries, three groups, one affected endpoint.
3. Set From and To to 2026-08-11: expect 8 errors and only the null-reference issue across the dashboard.
4. Click All dates: expect 40 errors again. Use Latest day: expect 20 errors on 2026-08-12.
5. Open an issue, change the manual workflow, download a brief, and inspect related logs.
6. Upload an invalid file: confirm the previous valid data stays visible and an error message appears.
7. Upload your own log file; verify raw records and UTC timestamp interpretation against the source.
8. Check narrow screen layout, keyboard tab navigation, date inputs and file chooser in your preferred browser.
