"use client";

import React from "react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { ChevronRight, Crown, CreditCard } from "lucide-react";

export default function Membership() {
  const [cardOpen, setCardOpen] = React.useState(false);

  return (
    <>
      <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-3 uppercase">
        Membership
      </p>

      {/* Card stage: list header with peek + View card */}
      <div className=" backdrop-blur overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium">Membership</div>
        </div>

        {/* Peek area – card pokes out of the top of the list container */}
        <div className="relative h-16">
          <div className="absolute left-4 right-4 -top-8">
            <div className="relative overflow-hidden rounded-xl aspect-85/54 w-full shadow-xl bg-linear-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-900">
              <div className="relative z-10 flex flex-col h-full">
                <div className="pl-3 pt-3">
                  <div className="text-xs uppercase tracking-wider text-slate-800/80 font-semibold">
                    Proximity
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight leading-tight mt-0.5">
                    Core
                  </div>
                </div>
                <div className="mt-auto pl-3 pb-3">
                  <div className="text-[11px] text-slate-800/80">
                    Member since 2025
                  </div>
                </div>
              </div>
              {/* Subtle noise overlay */}
              <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'><circle cx=\'1\' cy=\'1\' r=\'1\' fill=\'black\'/></svg>')] bg-size-[6px_6px]" />
              {/* Brushed overlays */}
              <div className="pointer-events-none absolute inset-0 opacity-30 -z-10 [background:repeating-linear-gradient(-45deg,rgba(255,255,255,0.35)_0px,rgba(255,255,255,0.35)_1px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_3px)]" />
              <div className="pointer-events-none absolute -top-8 -left-10 h-40 w-72 -rotate-12 rounded-full bg-white/30 blur-xl opacity-40 -z-10" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-black/20 blur-2xl opacity-60 -z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen expand modal when viewing the card */}
      {cardOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCardOpen(false)}
          />
          <div className="relative z-10 w-[min(92vw,420px)]">
            <div className="relative overflow-hidden rounded-xl aspect-85/54 w-full shadow-2xl border border-border bg-linear-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-900">
              <div className="relative z-10 flex flex-col h-full">
                <div className="pl-4 pt-4">
                  <div className="text-sm uppercase tracking-wider text-slate-800/80 font-semibold">
                    Proximity
                  </div>
                  <div className="text-3xl font-extrabold font-stack-sans-notch tracking-tight leading-tight mt-1">
                    Core
                  </div>
                </div>
                <div className="mt-auto pl-4 pb-4">
                  <div className="text-xs text-slate-800/80">
                    Member since 2025
                  </div>
                </div>
              </div>
              {/* Subtle noise overlay */}
              <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.05] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'><circle cx=\'1\' cy=\'1\' r=\'1\' fill=\'black\'/></svg>')] bg-size-[6px_6px]" />
              {/* Brushed overlays */}
              <div className="pointer-events-none absolute inset-0 opacity-30 -z-10 [background:repeating-linear-gradient(-45deg,rgba(255,255,255,0.35)_0px,rgba(255,255,255,0.35)_1px,rgba(0,0,0,0.08)_2px,rgba(0,0,0,0.08)_3px)]" />
              <div className="pointer-events-none absolute -top-8 -left-10 h-40 w-72 -rotate-12 rounded-full bg-white/30 blur-xl opacity-40 -z-10" />
              <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-black/20 blur-2xl opacity-60 -z-10" />

              <button
                onClick={() => setCardOpen(false)}
                className="absolute -top-10 right-0 rounded-full bg-card/80 px-3 py-1 text-xs text-foreground shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Actions under membership header */}
      <ItemGroup className="bg-card rounded-2xl -mt-8 relative z-10">
        <Item className="px-4 py-3">
          <ItemMedia variant="icon">
            <Crown className="h-4 w-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Upgrade to Max</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </ItemActions>
        </Item>
        <Item className="px-4 py-3">
          <ItemMedia variant="icon">
            <CreditCard className="h-4 w-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Payment details</ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </ItemActions>
        </Item>
      </ItemGroup>
    </>
  );
}
