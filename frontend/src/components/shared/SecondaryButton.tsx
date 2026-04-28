import type { ReactNode, ButtonHTMLAttributes } from "react";

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SecondaryButton({
  children,
  className,
  ...rest
}: SecondaryButtonProps) {
  const classNames = ["secondary-button", className ?? ""].filter(Boolean).join(" ");
  return (
    <button className={classNames} {...rest}>
      {children}
    </button>
  );
}
