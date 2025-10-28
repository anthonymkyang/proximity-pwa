import Link from "next/link";
import { login, signup } from "./actions";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  return (
    <main className="min-h-[calc(100dvh)] grid place-items-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl tracking-tight">
            <span className="bg-linear-to-r from-fuchsia-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
              Proximity
            </span>
          </CardTitle>
          <CardDescription>
            Log in to find guys nearby — fast, simple, and discreet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="grid gap-2 pt-2">
              <Button type="submit" formAction={login} className="w-full">
                Log in
              </Button>
              <Button
                type="submit"
                variant="outline"
                formAction={signup}
                className="w-full"
              >
                Create account
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
          <div className="mx-auto h-px w-10 bg-border" />
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </CardFooter>
      </Card>
    </main>
  );
}
