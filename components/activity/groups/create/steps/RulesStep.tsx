"use client";

import { useState } from "react";
import React from "react";
import { createClient } from "@/utils/supabase/client";
import { updateGroup } from "@/app/api/groups/actions";
import { X, Plus, Loader2 } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";

type RulesStepProps = {
  groupId?: string;
  onNext?: () => void;
  onBack?: () => void;
};

export default function RulesStep({ groupId, onNext, onBack }: RulesStepProps) {
  const [rules, setRules] = useState<string[]>([""]);
  const [provided, setProvided] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!groupId) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("groups")
          .select("house_rules, provided_items")
          .eq("id", groupId)
          .maybeSingle();
        if (error || !data || !active) return;
        const hr = Array.isArray(data.house_rules) ? data.house_rules : [];
        const pi = Array.isArray(data.provided_items)
          ? data.provided_items
          : [];
        setRules(hr.length ? hr.map((s: any) => String(s)) : [""]);
        setProvided(pi.length ? pi.map((s: any) => String(s)) : [""]);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      if (!groupId) {
        onNext?.();
        return;
      }
      const cleanRules = rules
        .map((s) => s.trim())
        .filter((s) => s.length >= 3)
        .slice(0, 12);
      const cleanProvided = provided
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
        .slice(0, 12);

      await updateGroup(groupId, {
        // Arrays are NOT NULL in DB, send empty arrays when user leaves them blank
        house_rules: cleanRules,
        provided_items: cleanProvided,
      });
      onNext?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold mb-4 px-1">At the event</h1>
      <div className="bg-card rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-2">House rules</h2>
        <div className="space-y-2">
          {rules.map((value, idx) => {
            const canClear = value.trim().length >= 3;
            const canDelete = rules.length > 1 || canClear;
            return (
              <div key={idx} className="flex items-center gap-2">
                <InputGroup className="flex-1">
                  <InputGroupAddon>
                    <span className="inline-flex items-center justify-center size-6 rounded-full border border-border bg-background/60 backdrop-blur-sm text-foreground/80 text-[11px] font-semibold">
                      {idx + 1}
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Enter a rule"
                    value={value}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((r, i) => (i === idx ? e.target.value : r))
                      )
                    }
                  />
                </InputGroup>
                <InputGroupButton
                  size="icon-sm"
                  variant="destructive"
                  className="rounded-full"
                  disabled={!canDelete}
                  onClick={() =>
                    setRules((prev) =>
                      prev.length > 1
                        ? prev.filter((_, i) => i !== idx)
                        : prev.map((r, i) => (i === idx ? "" : r))
                    )
                  }
                  aria-label={
                    rules.length > 1
                      ? "Delete rule"
                      : canClear
                      ? "Clear rule"
                      : "Clear (keep 1 field)"
                  }
                  title={
                    rules.length > 1
                      ? "Delete rule"
                      : canClear
                      ? "Clear rule"
                      : "Clear (keep 1 field)"
                  }
                >
                  <X className="size-4" />
                </InputGroupButton>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setRules((prev) => (prev.length < 12 ? [...prev, ""] : prev))
              }
              className="rounded-full"
              disabled={rules[rules.length - 1].trim().length < 3}
            >
              <Plus className="size-4 mr-1" />
              Add new rule
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-card rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-2">Provided</h2>
        <div className="space-y-2">
          {provided.map((value, idx) => {
            const canClear = value.trim().length >= 3;
            const canDelete = provided.length > 1 || canClear;
            return (
              <div key={idx} className="flex items-center gap-2">
                <InputGroup className="flex-1">
                  <InputGroupAddon>
                    <span className="inline-flex items-center justify-center size-6 rounded-full border border-border bg-background/60 backdrop-blur-sm text-foreground/80 text-[11px] font-semibold">
                      {idx + 1}
                    </span>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Enter an item"
                    value={value}
                    onChange={(e) =>
                      setProvided((prev) =>
                        prev.map((r, i) => (i === idx ? e.target.value : r))
                      )
                    }
                  />
                </InputGroup>
                <InputGroupButton
                  size="icon-sm"
                  variant="destructive"
                  className="rounded-full"
                  disabled={!canDelete}
                  onClick={() =>
                    setProvided((prev) =>
                      prev.length > 1
                        ? prev.filter((_, i) => i !== idx)
                        : prev.map((r, i) => (i === idx ? "" : r))
                    )
                  }
                  aria-label={
                    provided.length > 1
                      ? "Delete item"
                      : canClear
                      ? "Clear item"
                      : "Clear (keep 1 field)"
                  }
                  title={
                    provided.length > 1
                      ? "Delete item"
                      : canClear
                      ? "Clear item"
                      : "Clear (keep 1 field)"
                  }
                >
                  <X className="size-4" />
                </InputGroupButton>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setProvided((prev) => (prev.length < 12 ? [...prev, ""] : prev))
              }
              className="rounded-full"
              disabled={provided[provided.length - 1].trim().length < 3}
            >
              <Plus className="size-4 mr-1" />
              Add new item
            </Button>
          </div>
        </div>
      </div>
      <div className="pt-3">
        <Button
          type="button"
          size="lg"
          variant="default"
          onClick={handleSave}
          className="rounded-md w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Continue
            </>
          ) : (
            <>Continue</>
          )}
        </Button>
      </div>
    </div>
  );
}
