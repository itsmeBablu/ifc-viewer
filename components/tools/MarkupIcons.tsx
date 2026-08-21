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
      className={`vstudio-multicolor-icon h-4 w-4 ${className}`}
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
      <path className="v3-face" d="m6 6 9-2 3 3v12l-9 2-3-3V6Z" />
      <path className="v3-accent" d="m15 4v4l3-1M9 11l6-1M9 15l5-1" />
    </Svg>
  );
}

export function IconMarkupWall({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="v3-top" d="m3.5 8 13-4 4 2.5-13 4L3.5 8Z" />
      <path className="v3-face" d="m3.5 8 4 2.5v9l-4-2.5V8Z" />
      <path className="v3-accent" d="m7.5 10.5 13-4v9l-13 4v-9Z" />
      <path d="m11.8 9.2v9m4.3-10.3v9M7.5 14.8l13-4" />
    </Svg>
  );
}

export function IconMarkupDoor({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="v3-top" d="m6 6 9-3 3 2-9 3-3-2Z" />
      <path className="v3-face" d="m6 6 3 2v13l-3-2V6Z" />
      <path className="v3-accent" d="m9 8 9-3v13l-9 3V8Z" />
      <circle cx="15.2" cy="12.8" r=".7" fill="currentColor" />
    </Svg>
  );
}

export function IconMarkupWindow({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="v3-top" d="m4 8 13-4 3 2-13 4-3-2Z" />
      <path className="v3-face" d="m4 8 3 2v10l-3-2V8Z" />
      <path className="v3-accent" d="m7 10 13-4v10L7 20V10Z" />
      <path d="m13.5 8v10M7 15l13-4" />
    </Svg>
  );
}

export function IconMarkupFloor({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="v3-top" d="m3 11 13-5 5 3-13 5-5-3Z" />
      <path className="v3-face" d="m3 11 5 3v5l-5-3v-5Z" />
      <path className="v3-accent" d="m8 14 13-5v5L8 19v-5Z" />
      <path d="m8 16.5 13-5" />
    </Svg>
  );
}

export function IconMarkupRoof({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path className="v3-top" d="m3 13 9-8 9 5-9 8-9-5Z" />
      <path className="v3-accent" d="m12 5 9 5-4 4-9-5 4-4Z" />
      <path className="v3-face" d="m3 13 9 5 9-8v4l-9 8-9-5v-4Z" />
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

export const LAYOUT_TOOL_ICONS = {
  wall: IconMarkupWall,
  door: IconMarkupDoor,
  window: IconMarkupWindow,
  floor: IconMarkupFloor,
  roof: IconMarkupRoof,
} as const;


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
