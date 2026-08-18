"use client";

import { useState, useEffect, useRef } from "react";

interface DraggablePanelProps {
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  className?: string;
  dragHandleClass?: string;
}

export default function DraggablePanel({
  children,
  defaultPosition = { x: 20, y: 130 },
  className = "",
  dragHandleClass = "drag-handle",
}: DraggablePanelProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panelStartRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Resize handler to toggle desktop vs mobile layout
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (desktop) {
        // Reset to default docked position on desktop
        setPosition(defaultPosition);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [defaultPosition]);

  // Touch and Mouse drag support
  const handleStart = (clientX: number, clientY: number) => {
    if (isDesktop) return;
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    panelStartRef.current = { x: position.x, y: position.y };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || isDesktop) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    
    // Boundary check within window
    const newX = Math.max(0, Math.min(window.innerWidth - 100, panelStartRef.current.x + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, panelStartRef.current.y + dy));
    
    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Event handlers
  const onMouseDown = (e: React.MouseEvent) => {
    // Only drag on specified handle
    const target = e.target as HTMLElement;
    if (!target.closest(`.${dragHandleClass}`)) return;
    handleStart(e.clientX, e.clientY);
    
    const onMouseMove = (ev: MouseEvent) => handleMove(ev.clientX, ev.clientY);
    const onMouseUp = () => {
      handleEnd();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`.${dragHandleClass}`)) return;
    const touch = e.touches[0];
    if (touch) {
      handleStart(touch.clientX, touch.clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  if (isDesktop) {
    // Normal desktop layout — no absolute offset positioning applied here (falls back to tailwind css)
    return <div className={className}>{children}</div>;
  }

  // Floating draggable layout for touch/tablet mode
  return (
    <div
      ref={panelRef}
      className={`${className} fixed z-50 shadow-2xl transition-shadow ${isDragging ? "shadow-amber-500/20" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        margin: 0,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Visual top drag bar for touch indicator */}
      <div className={`${dragHandleClass} flex h-5 w-full cursor-move items-center justify-center rounded-t-xl bg-[var(--glass-inset-bg)] border-b border-[var(--panel-divider)]/40 hover:bg-amber-500/10 transition-colors`}>
        <div className="h-1 w-10 rounded-full bg-[var(--text-muted)]" />
      </div>
      {children}
    </div>
  );
}
