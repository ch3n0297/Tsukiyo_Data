import { render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAutoRefresh } from "./useAutoRefresh.js";

function TestHarness({ onTick }) {
  useAutoRefresh(onTick, 1000);
  return null;
}

afterEach(() => {
  vi.useRealTimers();
});

test("useAutoRefresh runs the polling callback and clears the timer on unmount", () => {
  vi.useFakeTimers();

  const onTick = vi.fn();
  const view = render(<TestHarness onTick={onTick} />);

  vi.advanceTimersByTime(2500);
  expect(onTick).toHaveBeenCalledTimes(2);

  view.unmount();
  vi.advanceTimersByTime(2500);
  expect(onTick).toHaveBeenCalledTimes(2);
});
