"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Plus, ArrowUp } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";

export default function MessageBar({
  value,
  onChange,
  onSend,
  placeholder = "Write a message…",
  maxRows = 5,
  disabled,
  onShareClick,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  maxRows?: number;
  disabled?: boolean;
  onShareClick?: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative w-full max-w-full overflow-hidden flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-full h-9 w-9 shrink-0"
        onClick={onShareClick}
        aria-label="Share to conversation"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <div className="relative flex-1">
        <TextareaAutosize
          minRows={1}
          maxRows={maxRows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          data-slot="input-group-control"
          className="block w-full resize-none rounded-full bg-transparent px-4 pr-20 py-2 text-base leading-5 outline-none md:text-sm field-sizing-content min-h-0 whitespace-pre-wrap wrap-break-word"
          style={{ overflow: "hidden" }}
        />
        <Button
          type="button"
          onClick={onSend}
          size="icon"
          disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
