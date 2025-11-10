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

      <div className="mx-auto mt-2 mb-0 max-w-10/12 overflow-hidden rounded-t-2xl bg-linear-to-br from-primary/80 to-primary/40 h-20 shadow-lg backdrop-blur-md border border-white/10">
        <div className="flex flex-col w-full h-full items-start justify-start px-6 py-4">
          <span className="text-xs tracking-widest uppercase text-primary-foreground/80 font-semibold">
            Proximity
          </span>
          <span className="text-primary-foreground text-2xl font-semibold">
            Core
          </span>
        </div>
      </div>

      {/* Actions under membership header */}
      <ItemGroup className="bg-card rounded-2xl relative z-10">
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
