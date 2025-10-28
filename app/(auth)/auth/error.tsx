"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset,
}: {
  error?: Error;
  reset?: () => void;
}) {
  return (
    <main className="min-h-[calc(100dvh)] grid place-items-center px-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl tracking-tight">
            Something went wrong
          </CardTitle>
          <CardDescription>
            {error?.message ?? "Please try again."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground text-center">
            If this keeps happening, contact support or try again.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          {reset && (
            <Button onClick={() => reset()} className="min-w-28">
              Try again
            </Button>
          )}
          <Button variant="outline" asChild className="min-w-28">
            <Link href="/">Go home</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
