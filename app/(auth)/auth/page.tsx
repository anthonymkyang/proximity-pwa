"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestOtp, verifyOtp } from "./actions";
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
  const stage = sp.get("stage") ?? "request";

  const [error] = useState(initialError);
  const [info] = useState(initialInfo);
  const [email] = useState(initialEmail);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Use your email to get a 6-digit code.
          </CardDescription>
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

            {stage === "verify" ? (
              <div className="space-y-2">
                <Label htmlFor="token">6-digit code</Label>
                <Input
                  id="token"
                  name="token"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter code"
                  required
                />
              </div>
            ) : null}

            <CardFooter className="flex flex-col gap-2 px-0">
              {stage === "verify" ? (
                <>
                  <Button formAction={verifyOtp} className="w-full">
                    Verify code
                  </Button>
                  <Button
                    variant="outline"
                    type="submit"
                    formAction={requestOtp}
                    className="w-full"
                  >
                    Send new code
                  </Button>
                </>
              ) : (
                <Button formAction={requestOtp} className="w-full">
                  Send code
                </Button>
              )}
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
