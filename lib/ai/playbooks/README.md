# Creation playbooks

These files are runtime guidance, not an unused documentation folder. `creationPlaybook` chooses relevant guides, catalogue rows and action schemas for each Gemini request. Unknown, attachment-based and edit/delete requests keep broad tools so routing does not hide required capabilities.

- `architecture.ts`: shells, partitions, openings, floors and roofs.
- `mep.ts`: duct and pipe routes, systems, elevations and local fitting derivation.
- `equipment.ts`: catalogue placements and bounded grids.

Gemini interprets the brief and returns a small recipe. `recipes.ts` expands repeated geometry in code; `validate.ts` checks the complete batch before `execute.ts` saves anything. Never execute model-generated code or apply an incomplete response.

To add a workflow, implement its bounded schema and expansion first, add examples using valid fields and generated ID prefixes, then add routing terms and regression tests. Keep guides short; do not inject this README or every example into every request.

Google's API quota and availability are separate from the app's 1,500-request allowance. Guides reduce prompt/output size; they do not raise Google's quota. Temporary server errors are retried on the selected Gemini model with a bounded delay; key, unsupported-model, quota and validation errors are not retried automatically.
