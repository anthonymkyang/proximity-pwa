"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { E2EEProvider, useE2EE } from "@/components/providers/e2ee-context";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

function PinSetupInner() {
  const router = useRouter();
  const { enableWithPin } = useE2EE();
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a 6-digit PIN.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs do not match.");
      return;
    }
    setSaving(true);
    try {
      await enableWithPin(pin, true);
      router.replace("/app");
    } catch (err: any) {
      setError(err?.message || "Unable to set PIN.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>Set your PIN</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="pin">6-digit PIN</Label>
          <Input
            id="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            type="password"
            placeholder="Enter PIN"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pinConfirm">Confirm PIN</Label>
          <Input
            id="pinConfirm"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value)}
            inputMode="numeric"
            type="password"
            placeholder="Re-enter PIN"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Set PIN"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function PinSetupClient() {
  return (
    <E2EEProvider>
      <PinSetupInner />
    </E2EEProvider>
  );
}
