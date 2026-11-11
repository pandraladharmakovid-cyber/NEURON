import type { ButtonHTMLAttributes } from "react";
export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      type="button"
      {...props}
      className={`btn btn-${variant} ${className}`}
    />
  );
}