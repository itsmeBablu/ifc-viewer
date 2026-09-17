# Modeling algorithms

`apartment.ts` is a bounded layout compiler shared by Gemini and Ollama recipes. A compact `apartment_layout` action expands to exterior walls, 20 m² clear bedrooms, 150 mm partitions, a 1.2 m clear corridor, an 8 m² bathroom, open living/kitchen, doors, windows and floor. It supports one to six bedrooms and optional bedroom area, origin and wall sizes. It does not create furniture, roof or MEP.

`index.ts` supplies concept guidance across all supported elements: levels, walls, hosted doors/windows, floors/roofs, columns/beams, catalogue equipment, ducts, pipes and cable trays. Existing `playbooks` select relevant tools and catalogue entries; `recipes.ts` computes repeated coordinates. Equipment dimensions remain catalogue based; existing MEP connections require project evidence.

`brief.ts` recognizes standalone residential requests, number words and common apartment spelling variants. Omitted bedroom counts mean two for apartments, three for villas/houses/bungalows, and five for duplexes. One to six bedrooms are supported. Prefix and suffix counts both work, for example “three-bedroom apartment” and “duplex house with five bedrooms”.

`house.ts` compiles `house_layout`: a villa is one storey with larger living space and a flat roof. A duplex is one two-storey dwelling with bedrooms split between aligned floors, a bathroom on each floor, slab solids forming a concept staircase, an upper-floor opening and a flat roof. Extra sleeping-zone bays are studies. Slab-built stairs are concept geometry; railings, native stair semantics and construction detailing are not included.

Standalone basic residential commands can compile locally with zero provider tokens. Attachments, conversation, selections and custom constraints go through the selected provider, which has access to the same recipes. Explicit dimensions always take precedence. All results pass the same strict geometry and reference validation before application. Defaults are concept choices, not regulatory standards.
