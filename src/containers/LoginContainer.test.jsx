import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginContainer from "./LoginContainer";

const reply = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

async function submit({ fetchImpl, email = "host@example.com", password = "secreto123" }) {
  const onSuccess = vi.fn();
  const user = userEvent.setup();
  render(<LoginContainer fetchImpl={fetchImpl} onSuccess={onSuccess} />);
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return { onSuccess };
}

describe("Login", () => {
  it("posts the credentials as JSON and goes to the game on success", async () => {
    const fetchImpl = vi.fn(() => reply(200, { ok: true, user: { email: "host@example.com" } }));
    const { onSuccess } = await submit({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "host@example.com", password: "secreto123" }),
    }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows the server error and stays on the page", async () => {
    const { onSuccess } = await submit({ fetchImpl: () => reply(401, { error: "Correo o contraseña incorrectos." }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("shows a connection error when the request fails", async () => {
    await submit({ fetchImpl: () => Promise.reject(new TypeError("offline")) });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
  });

  it("requires both fields before sending", async () => {
    const fetchImpl = vi.fn();
    render(<LoginContainer fetchImpl={fetchImpl} onSuccess={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Entrar" }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Correo")).toBeRequired();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
  });
});
