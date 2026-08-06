"use client";

import type { MarkupShapeType, MarkupToolId } from "@/lib/toolMarkup";

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${className}`}
      aria-hidden
      {...stroke}
    >
      {children}
    </svg>
  );
}

export function IconMarkupCube({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 4.5 7.5v9L12 21l7.5-4.5v-9L12 3Z" />
      <path d="M12 12v9M12 12 4.5 7.5M12 12l7.5-4.5" />
    </Svg>
  );
}

export function IconMarkupSphere({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M4.5 12h15M12 4.5c2.5 2.2 3.8 4.7 3.8 7.5S14.5 17.3 12 19.5M12 4.5C9.5 6.7 8.2 9.2 8.2 12S9.5 17.3 12 19.5" />
    </Svg>
  );
}

export function IconMarkupCylinder({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="12" cy="6" rx="6" ry="2.5" />
      <path d="M6 6v12" />
      <path d="M18 6v12" />
      <ellipse cx="12" cy="18" rx="6" ry="2.5" />
    </Svg>
  );
}

export function IconMarkupCone({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4 5 19h14L12 4Z" />
      <ellipse cx="12" cy="19" rx="7" ry="2" />
    </Svg>
  );
}

export function IconMarkupTorus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <ellipse cx="12" cy="12" rx="8" ry="4.5" />
      <ellipse cx="12" cy="12" rx="4" ry="2.2" />
    </Svg>
  );
}

export function IconMarkupCapsule({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 7.5a4 4 0 0 1 8 0v9a4 4 0 0 1-8 0v-9Z" />
    </Svg>
  );
}

export function IconMarkupPyramid({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4 4 19h16L12 4Z" />
      <path d="M12 4v15" />
    </Svg>
  );
}

export function IconMarkupNote({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4h8l4 4v12H7V4Z" />
      <path d="M15 4v4h4M9 12h6M9 16h4" />
    </Svg>
  );
}

export const MARKUP_TOOL_ICONS: Record<
  MarkupToolId,
  (props: IconProps) => React.ReactElement
> = {
  cube: IconMarkupCube,
  sphere: IconMarkupSphere,
  cylinder: IconMarkupCylinder,
  cone: IconMarkupCone,
  torus: IconMarkupTorus,
  capsule: IconMarkupCapsule,
  pyramid: IconMarkupPyramid,
  note: IconMarkupNote,
};

export const MARKUP_TOOL_ORDER: MarkupToolId[] = [
  "cube",
  "sphere",
  "cylinder",
  "cone",
  "torus",
  "capsule",
  "pyramid",
  "note",
];

export function isShapeTool(id: MarkupToolId): id is MarkupShapeType {
  return id !== "note";
}
