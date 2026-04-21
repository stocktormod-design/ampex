import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type SubmitButtonProps = Omit<React.ComponentProps<"button">, "type"> &
  VariantProps<typeof buttonVariants>;

/** Native submit-knapp med `buttonVariants` — trygg sammen med server actions i RSC. */
export function SubmitButton({
  className,
  variant,
  size,
  ...props
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      data-slot="submit-button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
