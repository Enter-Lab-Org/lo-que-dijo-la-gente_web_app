import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, question } from "../test/fixtures";

describe("Console · session", () => {
  it("shows the signed-in user and logs out from the header", async () => {
    const onLogout = vi.fn();
    render(<App services={fakeServices({ storage: storageWithGame([question("a")]) })} user={{ email: "host@example.com" }} onLogout={onLogout} />);
    expect(screen.getByText("host@example.com")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("has no logout button when the host does not provide one (desktop app)", () => {
    render(<App services={fakeServices({ storage: storageWithGame([question("a")]) })} />);
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });
});
