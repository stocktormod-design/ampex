import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type SubmitButtonProps = Omit<React.ComponentProps<"button">, "type"> &
  VariantProps<typeof buttonVariants>;

export function SubmitButton({ className, variant, size, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
