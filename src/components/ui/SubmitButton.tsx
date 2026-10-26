"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";

type Props = {
  variant?: "primary" | "ghost" | "quiet";
  size?: "md" | "lg";
  block?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

// Shows the spinner and blocks double-submits while the form action runs.
export function SubmitButton(props: Props) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" loading={pending} />;
}
