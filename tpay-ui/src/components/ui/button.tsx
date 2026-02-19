import * as React from "react";
import { cn } from "./../../lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Button({ className, variant = "default", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition";
  const variants: Record<string, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border bg-white text-gray-900 hover:bg-gray-50",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
