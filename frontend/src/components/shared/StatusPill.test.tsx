import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  test("renders children text", () => {
    render(<StatusPill variant="success">成功</StatusPill>);
    expect(screen.getByText("成功")).toBeInTheDocument();
  });

  test.each([
    ["live", "status-pill--live"],
    ["success", "status-pill--success"],
    ["warning", "status-pill--warning"],
    ["error", "status-pill--error"],
    ["muted", "status-pill--muted"],
  ] as const)("applies correct class for variant %s", (variant, expectedClass) => {
    render(<StatusPill variant={variant}>test</StatusPill>);
    expect(screen.getByText("test")).toHaveClass(expectedClass);
  });

  test("renders dot indicator when showDot is true", () => {
    render(
      <StatusPill variant="live" showDot>
        全域同步中
      </StatusPill>,
    );
    // The dot is an aria-hidden span
    const dot = document.querySelector(".status-pill__dot");
    expect(dot).toBeInTheDocument();
  });

  test("does not render dot by default", () => {
    render(<StatusPill variant="success">成功</StatusPill>);
    expect(document.querySelector(".status-pill__dot")).not.toBeInTheDocument();
  });
});
