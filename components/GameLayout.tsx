"use client";

import type { ReactNode } from "react";
import { PanoramaScene } from "@/components/PanoramaScene";
import type { Round } from "@/types/game";

type GameLayoutProps = {
  round: Round;
  children: ReactNode;
  isDimmed: boolean;
};

export function GameLayout({ round, children, isDimmed }: GameLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08131f] text-white">
      <PanoramaScene
        imageUrl={round.imageUrl}
        initialYaw={round.initialPanoramaYaw}
        isDimmed={isDimmed}
        title={round.title}
      />
      <div className="arena-glow absolute inset-0" />
      <div className="pointer-events-none relative z-10 min-h-screen">
        {children}
      </div>
    </main>
  );
}
