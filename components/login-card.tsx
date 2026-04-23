"use client";

import { useState } from "react";
import { login } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function LoginCard() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-1">Dashboard Access</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Sign in to view real-time payment analytics, agent network, and live orchestrator
        </p>
        <form action={handleSubmit} className="flex flex-col gap-3">
          <Input name="email" type="email" placeholder="Email" required />
          <Input name="password" type="password" placeholder="Password" required />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in..." : "View Dashboard"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Demo: any email + password &quot;demo&quot;
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
