"use client";

import React from "react";

export const LINE_COLORS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith & city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#000000",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo & city": "#95CDBA",
  dlr: "#00AFAD",
  "elizabeth line": "#6950A1",
  "london overground": "#EE7C0E",
  overground: "#EE7C0E",
  tram: "#66CC00",
};

export const getLineColor = (name: string) => {
  const key = name.trim().toLowerCase();
  return LINE_COLORS[key] ?? "#374151";
};

export const getContrastingText = (color: string) => {
  const hex = color.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (normalized.length !== 6) return "#0b0b0b";
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7 ? "#0b0b0b" : "#ffffff";
};

export const InstructionWithLineBadges = ({ text }: { text: string }) => {
  if (!text) return null;
  const result: React.ReactNode[] = [];
  const tokenRegex =
    /(\b[A-Za-z]+ line\b)|(\b(?:[NC]?\d{1,3}[A-Z]?|[A-Z]\d{1,2})\b)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const [full, lineMatch, busMatch] = match;
    if (lineMatch) {
      const lineName = lineMatch.replace(/ line/i, "").trim();
      const bg = getLineColor(lineName);
      const fg = getContrastingText(bg);
      result.push(
        <span
          key={`${lineMatch}-${match.index}`}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle"
          style={{ backgroundColor: bg, color: fg }}
        >
          {lineMatch}
        </span>
      );
    } else if (busMatch) {
      result.push(
        <span
          key={`${busMatch}-${match.index}`}
          className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white align-middle"
        >
          {busMatch}
        </span>
      );
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <span className="inline-flex flex-wrap gap-1">{result}</span>;
};
