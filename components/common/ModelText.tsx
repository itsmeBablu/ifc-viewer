/**
 * ModelText — renders IFC-sourced strings (floor/room/element names) with
 * browser auto-translate disabled, so imported labels display verbatim.
 *
 * Thin wrapper around a configurable tag (span/p/div) with the
 * `notranslate` class and `translate="no"`.
 */

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
