"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput({
  name = "password",
  autoComplete,
  describedBy,
  pattern,
}: {
  name?: string;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  pattern?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input">
    <input
      required
      type={visible ? "text" : "password"}
      name={name}
      autoComplete={autoComplete}
      minLength={8}
      maxLength={200}
      pattern={pattern}
      aria-describedby={describedBy}
    />
    <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      <span>{visible ? "Hide" : "Show"}</span>
    </button>
  </span>;
}
