"use client";

import type { ReactNode } from "react";
import { PanoramaScene } from "@/components/PanoramaScene";
import type { Round } from "@/types/game";

type GameLayoutProps = {
  round: Round;
  children: ReactNode;
  isDimmed: boolean;
  showPanoramaHint?: boolean;
};

export function GameLayout({
  round,
  children,
  isDimmed,
  showPanoramaHint = false,
}: GameLayoutProps) {
  return (
    <main className="game-root relative min-h-screen overflow-hidden bg-[#08131f] text-white">
      <PanoramaScene
        imageUrl={round.imageUrl}
        initialYaw={round.initialPanoramaYaw}
        isDimmed={isDimmed}
        showInteractionHint={showPanoramaHint}
        title={round.title}
      />
      <div className="arena-glow absolute inset-0" />
      <div className="game-content pointer-events-none relative z-10 min-h-screen">
        {children}
      </div>
    </main>
  );
}
