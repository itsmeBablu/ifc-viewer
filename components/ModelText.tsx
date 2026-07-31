import type { ReactNode } from "react";

/**
 * Renders IFC model strings (floor / room names, etc.) without browser
 * auto-translate — keep labels exactly as imported.
 */
export default function ModelText({
  children,
  className = "",
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  return (
    <Tag className={`notranslate ${className}`.trim()} translate="no">
      {children}
    </Tag>
  );
}
