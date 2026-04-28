"use client";

import { useState } from "react";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ErpProvider } from "@/lib/integrations/types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  currentProvider: ErpProvider | null;
  currentSlug: string | null; // Fiken-spesifikk ikke-sensitiv metadata
};

export function IntegrationSetupForm({ action, currentProvider, currentSlug }: Props) {
  const [provider, setProvider] = useState<ErpProvider>(currentProvider ?? "fiken");

  return (
    <form action={action} className="space-y-5">
      {/* Leverandørvalg */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">ERP-leverandør</legend>
        <div className="flex gap-3">
          {(["fiken", "tripletex"] as const).map((p) => (
            <label
              key={p}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                provider === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => setProvider(p)}
                className="sr-only"
              />
              {p === "fiken" ? "Fiken" : "Tripletex"}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Fiken-felter */}
      {provider === "fiken" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <NativeLabel htmlFor="companySlug">Bedriftsslug</NativeLabel>
            <NativeInput
              id="companySlug"
              name="companySlug"
              required
              defaultValue={currentSlug ?? ""}
              placeholder="mitt-firma-as"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Finnes i Fiken URL-en: app.fiken.no/mitt-firma-as
            </p>
          </div>
          <div className="space-y-2">
            <NativeLabel htmlFor="accessToken">API-nøkkel (Personal Access Token)</NativeLabel>
            <NativeInput
              id="accessToken"
              name="accessToken"
              type="password"
              required
              placeholder="••••••••••••••••••••"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Lagres kryptert i Vault — vises aldri igjen etter lagring.
            </p>
          </div>
        </div>
      )}

      {/* Tripletex-felter */}
      {provider === "tripletex" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <NativeLabel htmlFor="consumerToken">Consumer Token</NativeLabel>
            <NativeInput
              id="consumerToken"
              name="consumerToken"
              type="password"
              required
              placeholder="••••••••••••••••••••"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <NativeLabel htmlFor="employeeToken">Employee Token</NativeLabel>
            <NativeInput
              id="employeeToken"
              name="employeeToken"
              type="password"
              required
              placeholder="••••••••••••••••••••"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Begge tokens lagres kryptert i Vault — vises aldri igjen etter lagring.
            </p>
          </div>
        </div>
      )}

      <SubmitButton>Lagre integrasjon</SubmitButton>
    </form>
  );
}
