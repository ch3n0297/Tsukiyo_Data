import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  test("renders label and value", () => {
    render(<MetricCard label="TOTAL ACCOUNTS" value={42} />);
    expect(screen.getByText("TOTAL ACCOUNTS")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders delta with correct class", () => {
    render(
      <MetricCard label="SUCCESS" value={10} delta="↑ 5% 比昨日" deltaVariant="success" />,
    );
    const delta = screen.getByText("↑ 5% 比昨日");
    expect(delta).toHaveClass("metric-card__delta--success");
  });

  test("renders — as value when isComingSoon is true", () => {
    render(<MetricCard label="COMING SOON" isComingSoon />);
    expect(screen.getByText("—")).toBeInTheDocument();
    // Delta should not render
    expect(screen.queryByRole("paragraph", { name: /delta/ })).not.toBeInTheDocument();
  });

  test("does not render delta when isComingSoon is true, even if delta is provided", () => {
    render(
      <MetricCard label="COMING SOON" isComingSoon delta="should not appear" deltaVariant="warning" />,
    );
    expect(screen.queryByText("should not appear")).not.toBeInTheDocument();
  });

  test("renders muted delta variant by default", () => {
    render(<MetricCard label="L" value={1} delta="info" />);
    expect(screen.getByText("info")).toHaveClass("metric-card__delta--muted");
  });
});
