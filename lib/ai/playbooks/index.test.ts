import { describe, expect, it } from "vitest";
import { COMPONENT_CATALOG } from "@/lib/componentCatalog";
import { creationPlaybook } from ".";
import { functionDeclarations, toolsForCreation, type CommandRequest } from "../protocol";
import { expandModelPlan } from "../recipes";
import { validatePlan } from "../validate";

const input: CommandRequest = { command: "Create an 8 m by 6 m shell", attachments: [], history: [],
  context: { projectId: "p", activeLevelId: "ground", selection: [], defaults: { wallHeightMm: 3000, wallThicknessMm: 200 },
    elements: [{ id: "ground", kind: "level", properties: { name: "Ground", elevationMm: 0, heightMm: 3000 } }] } };

describe("runtime creation playbooks", () => {
  it("reduces shell tools and catalogue without discarding validation geometry", () => {
    const playbook = creationPlaybook(input);
    expect(playbook.kinds).toContain("rectangular_shell");
    expect(playbook.kinds).not.toContain("pipe");
    expect(playbook.catalog).toEqual([]);
    expect(JSON.stringify(toolsForCreation("build", playbook.kinds)).length).toBeLessThan(JSON.stringify(functionDeclarations).length * 0.5);
    const plan = JSON.parse(JSON.stringify(playbook.guide[0].example).replaceAll("<active-level-id>", "ground"));
    const expanded = validatePlan(expandModelPlan(plan), input.context);
    expect(expanded.actions).toHaveLength(5);
    expect(expanded.actions[0]).toMatchObject({ id: "shell:wall:0", endXmm: 8000 });
    expect(input.context.elements).toHaveLength(1);
  });
  it("keeps MEP routing compact and the example executable", () => {
    const playbook = creationPlaybook({ ...input, command: "Add a rectangular duct run", discipline: "mep" });
    expect(playbook.kinds).toContain("duct_run");
    expect(playbook.kinds).not.toContain("rectangular_shell");
    const guide = playbook.guide.find(guide => guide.id === "mep")!;
    const plan = JSON.parse(JSON.stringify(guide.example).replaceAll("<active-level-id>", "ground"));
    expect(validatePlan(expandModelPlan(plan), input.context).actions).toHaveLength(2);
  });
  it("filters chair catalogue rows while retaining their authoritative dimensions", () => {
    const playbook = creationPlaybook({ ...input, command: "Place four dining chairs in a grid" });
    expect(playbook.kinds).toContain("equipment_grid");
    expect(playbook.catalog).toContainEqual(COMPONENT_CATALOG.find(item => item.id === "dining-chair"));
    expect(playbook.catalog.length).toBeLessThan(COMPONENT_CATALOG.length);
  });
  it.each(["Build a complete house", "Move it 2 m", "Delete the selected elements", "Erstelle ein Gebäude"])("preserves broad capabilities for %s", command => {
    const playbook = creationPlaybook({ ...input, command });
    expect(playbook.kinds).toContain("wall");
    expect(playbook.kinds).toContain("equipment");
    if (command.startsWith("Delete")) expect(playbook.kinds).toContain("delete");
  });
  it("preserves conversation-dependent and attachment-dependent capabilities", () => {
    const history = [{ role: "user" as const, text: "I want windows along my wall" }, { role: "assistant" as const, text: "How many?" }];
    expect(creationPlaybook({ ...input, command: "Four", history }).kinds).toContain("window_row");
    const attached = creationPlaybook({ ...input, attachments: [{ name: "plan.png", mimeType: "image/png", data: "test" }] });
    expect(attached.kinds).toContain("pipe_run");
    expect(attached.kinds).toContain("door");
    expect(toolsForCreation("review", attached.kinds).map(tool => tool.name)).not.toContain("propose_model");
  });
});
