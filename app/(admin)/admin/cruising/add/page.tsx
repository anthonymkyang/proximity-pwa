"use client";

import React from "react";
import CruisingForm from "@/components/map/CruisingForm";

export default function AddCruisingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-foreground">
          Add Cruising Spot
        </h1>
        <p className="text-sm text-muted-foreground">
          Temporary admin form for adding cruising places. Remove before
          production.
        </p>
        <CruisingForm />
      </div>
    </main>
  );
}
