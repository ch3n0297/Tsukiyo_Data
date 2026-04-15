import type { ReactNode, ButtonHTMLAttributes } from "react";

interface CTAButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Stretch button to full width */
  fullWidth?: boolean;
  /** Show a loading spinner when true */
  isLoading?: boolean;
}

export function CTAButton({
  children,
  fullWidth = false,
  isLoading = false,
  disabled,
  className,
  ...rest
}: CTAButtonProps) {
  const classNames = [
    "cta-button",
    fullWidth ? "cta-button--full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} disabled={disabled ?? isLoading} {...rest}>
      {isLoading ? "載入中..." : children}
    </button>
  );
}
