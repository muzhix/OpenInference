/** Buttons per 13-ui-style-spec.md: sm (28px) / md (40px) x primary/secondary/ghost. */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shown as the title tooltip while disabled; required for a11y (F1). */
  disabledReason?: string | null;
  children: ReactNode;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary whitespace-nowrap";

function variantClasses(variant: ButtonVariant, size: ButtonSize): string {
  if (variant === "primary") {
    return "bg-primary text-white hover:bg-[#5B21B6]";
  }
  if (variant === "ghost") {
    return "text-gray-700 hover:bg-gray-100";
  }
  const border = size === "md" ? "border-gray-300" : "border-gray-200";
  return `bg-white text-gray-700 border ${border} hover:bg-gray-50`;
}

export function Button({
  variant = "secondary",
  size = "sm",
  disabled = false,
  disabledReason = null,
  className = "",
  title,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const sizeClasses = size === "sm" ? "h-7 px-2.5 text-xs" : "h-10 px-4 text-xs";
  const stateClasses = disabled ? "cursor-not-allowed opacity-50" : "";
  return (
    <button
      type="button"
      aria-disabled={disabled ? "true" : undefined}
      title={disabled ? (disabledReason ?? title ?? "Not available") : title}
      className={`${BASE_CLASSES} ${sizeClasses} ${disabled ? "" : variantClasses(variant, size)} ${stateClasses} ${className}`}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Square 28px ghost icon button (canvas toolbar, node ops). */
export function IconButton({
  disabled = false,
  disabledReason = null,
  label,
  className = "",
  title,
  onClick,
  children,
}: {
  disabled?: boolean;
  disabledReason?: string | null;
  label: string;
  className?: string;
  title?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled ? "true" : undefined}
      title={disabled ? (disabledReason ?? label) : (title ?? label)}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-primary ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}
