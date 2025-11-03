"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, signup } from "./actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialError = sp.get("error") ?? "";
  const initialInfo = sp.get("info") ?? "";
  const initialEmail = sp.get("email") ?? "";

  const [error] = useState(initialError);
  const [info] = useState(initialInfo);
  const [email] = useState(initialEmail);

  // clean the URL right after we read the params
  useEffect(() => {
    if (sp.toString()) {
      router.replace("/auth");
    }
  }, [sp, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your email and password.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {info ? (
            <Alert className="bg-emerald-100 text-emerald-700 border-emerald-200">
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={email}
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            <CardFooter className="flex flex-col gap-2 px-0">
              <Button formAction={login} className="w-full">
                Log in
              </Button>
              <Button
                variant="outline"
                type="submit"
                formAction={signup}
                className="w-full"
              >
                Create account
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
