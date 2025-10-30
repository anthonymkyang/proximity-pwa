"use client";

export default function RealMap({ className = "" }: { className?: string }) {
  return (
    <div
      className={`min-h-[calc(100dvh-(--spacing(14)))] w-full bg-[linear-gradient(135deg,#a8d5ba_0%,#c7e4d0_50%,#9ac7d0_100%),repeating-linear-gradient(0deg,rgba(0,0,0,0.05)_0,rgba(0,0,0,0.05)_1px,transparent_1px,transparent_100%),repeating-linear-gradient(90deg,rgba(0,0,0,0.05)_0,rgba(0,0,0,0.05)_1px,transparent_1px,transparent_100%)] bg-size-[100%_100%,40px_40px,40px_40px] ${className}`}
    />
  );
}
