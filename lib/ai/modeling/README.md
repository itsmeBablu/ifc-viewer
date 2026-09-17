# Modeling algorithms

`apartment.ts` is a bounded layout compiler shared by Gemini and Ollama recipes. A compact `apartment_layout` action expands to exterior walls, 20 m² clear bedrooms, 150 mm partitions, a 1.2 m clear corridor, an 8 m² bathroom, open living/kitchen, doors, windows and floor. It supports one to four bedrooms and optional bedroom area, origin and wall sizes. It does not create furniture, roof or MEP.

`index.ts` supplies concept guidance across all supported elements: levels, walls, hosted doors/windows, floors/roofs, columns/beams, catalogue equipment, ducts, pipes and cable trays. Existing `playbooks` select relevant tools and catalogue entries; `recipes.ts` computes repeated coordinates. Equipment dimensions remain catalogue based; existing MEP connections require project evidence.

Standalone default apartment commands can compile locally with zero provider tokens. Attachments, conversation, selections and custom constraints go through the selected provider. Explicit dimensions always take precedence. All results pass the same strict geometry and reference validation before application. Defaults are concept choices, not regulatory standards.
