import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import type { PublicUser } from "../../types/api";

const ADMIN_USER: PublicUser = {
  id: "u1",
  email: "admin@example.com",
  displayName: "系統管理員",
  role: "admin",
  status: "active",
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvedBy: "bootstrap",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const MEMBER_USER: PublicUser = {
  ...ADMIN_USER,
  id: "u2",
  email: "member@example.com",
  displayName: "一般成員",
  role: "member",
};

function renderSidebar(user: PublicUser, onLogout = vi.fn(), currentPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[currentPath]}>
      <Sidebar user={user} onLogout={onLogout} />
    </MemoryRouter>,
  );
}

describe("Sidebar — admin role", () => {
  test("renders brand mark and brand text", () => {
    renderSidebar(ADMIN_USER);
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("TSUKIYO")).toBeInTheDocument();
  });

  test("renders main nav items for admin", () => {
    renderSidebar(ADMIN_USER);
    expect(screen.getByRole("link", { name: /總覽看板/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /資料來源/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /同步任務/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /帳號接入/ })).toBeInTheDocument();
  });

  test("renders admin-only nav group for admin", () => {
    renderSidebar(ADMIN_USER);
    // Admin group label
    expect(screen.getByText("管理員", { selector: ".sidebar__nav-group-label" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /管理員首頁/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /使用者管理/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /系統設定/ })).toBeInTheDocument();
  });

  test("active nav item gets active class for current path", () => {
    renderSidebar(ADMIN_USER, vi.fn(), "/dashboard");
    const dashboardLink = screen.getByRole("link", { name: /總覽看板/ });
    expect(dashboardLink).toHaveClass("sidebar__nav-item--active");
  });

  test("non-current nav items do not have active class", () => {
    renderSidebar(ADMIN_USER, vi.fn(), "/dashboard");
    const accountsLink = screen.getByRole("link", { name: /資料來源/ });
    expect(accountsLink).not.toHaveClass("sidebar__nav-item--active");
  });

  test("shows user displayName and role in footer", () => {
    renderSidebar(ADMIN_USER);
    expect(screen.getByText("系統管理員", { selector: ".sidebar__footer-name" })).toBeInTheDocument();
    expect(screen.getByText("admin", { selector: ".sidebar__footer-role" })).toBeInTheDocument();
  });

  test("calls onLogout when logout button is clicked", () => {
    const onLogout = vi.fn();
    renderSidebar(ADMIN_USER, onLogout);
    fireEvent.click(screen.getByRole("button", { name: /登出/ }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});

describe("Sidebar — member role", () => {
  test("renders only 3 main nav items for member (no admin items)", () => {
    renderSidebar(MEMBER_USER);
    expect(screen.getByRole("link", { name: /總覽看板/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /資料來源/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /同步任務/ })).toBeInTheDocument();
  });

  test("does not render admin nav group for member", () => {
    renderSidebar(MEMBER_USER);
    expect(screen.queryByText("管理員", { selector: ".sidebar__nav-group-label" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /管理員首頁/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /使用者管理/ })).not.toBeInTheDocument();
  });

  test("does not render admin-only 帳號接入 link for member", () => {
    renderSidebar(MEMBER_USER);
    expect(screen.queryByRole("link", { name: /帳號接入/ })).not.toBeInTheDocument();
  });

  test("shows member displayName and role in footer", () => {
    renderSidebar(MEMBER_USER);
    expect(screen.getByText("一般成員", { selector: ".sidebar__footer-name" })).toBeInTheDocument();
    expect(screen.getByText("member", { selector: ".sidebar__footer-role" })).toBeInTheDocument();
  });
});
