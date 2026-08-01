"use client";

import { useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { gsapDuration, gsapEase } from "@/lib/gsapMotion";

const ViewerApp = dynamic(() => import("./ViewerApp"), {
  ssr: false,
  loading: () => <ViewerLoadingFallback />,
});

function ViewerLoadingFallback() {
  const rootRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const spinner = spinnerRef.current;
    const label = labelRef.current;
    if (!root) return;

    gsap.fromTo(
      root,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: gsapDuration.fast, ease: gsapEase.ios },
    );

    if (label) {
      gsap.fromTo(
        label,
        { y: 8, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: gsapDuration.overlay,
          ease: gsapEase.ios,
          delay: 0.08,
        },
      );
    }

    if (!spinner) return;
    const spin = gsap.to(spinner, {
      rotation: 360,
      duration: 0.9,
      ease: "none",
      repeat: -1,
    });
    return () => {
      spin.kill();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex h-dvh w-full items-center justify-center bg-zinc-100 text-zinc-500"
      style={{ visibility: "hidden" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          ref={spinnerRef}
          className="h-8 w-8 rounded-full border-2 border-zinc-300 border-t-zinc-700"
        />
        <p ref={labelRef} className="text-sm" style={{ visibility: "hidden" }}>
          Loading viewer…
        </p>
      </div>
    </div>
  );
}

export default function ViewerAppClient() {
  return <ViewerApp />;
}
