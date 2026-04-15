import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ComingSoonBlock } from "./ComingSoonBlock";

describe("ComingSoonBlock", () => {
  test("renders default title and description", () => {
    render(<ComingSoonBlock />);
    expect(screen.getByText("即將推出")).toBeInTheDocument();
    expect(screen.getByText("此功能需要後端 API 支援，開發中。")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  test("renders custom title and description", () => {
    render(<ComingSoonBlock title="自訂標題" description="自訂說明" />);
    expect(screen.getByText("自訂標題")).toBeInTheDocument();
    expect(screen.getByText("自訂說明")).toBeInTheDocument();
  });

  test("has dashed border class", () => {
    const { container } = render(<ComingSoonBlock />);
    expect(container.firstChild).toHaveClass("coming-soon-block");
  });

  test("renders lock icon by default", () => {
    const { container } = render(<ComingSoonBlock icon="lock" />);
    // Lucide renders an svg
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("renders clock icon", () => {
    const { container } = render(<ComingSoonBlock icon="clock" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
