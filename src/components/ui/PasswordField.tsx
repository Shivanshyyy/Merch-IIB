"use client";

import { useState, type ComponentProps } from "react";
import { TextField } from "@/components/ui/TextField";

export function PasswordField(props: Omit<ComponentProps<typeof TextField>, "type" | "end">) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      {...props}
      type={shown ? "text" : "password"}
      autoCapitalize="none"
      spellCheck={false}
      end={
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} className="label flex min-h-11 items-center px-2 hover:text-fg">
          {shown ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
