import { describe, it, expect, vi } from "vitest";
import { server, gracefulShutdown } from "../src/server.js";
import * as dbModule from "../src/db/connection.js";

describe("API Graceful Shutdown", () => {
  it("closes HTTP server and disconnects from database cleanly upon shutdown signal", async () => {
    const serverCloseSpy = vi
      .spyOn(server, "close")
      .mockImplementation((cb?: (err?: Error) => void) => {
        if (cb) setImmediate(() => cb());
        return server;
      });

    const dbDisconnectSpy = vi.spyOn(dbModule, "disconnectDatabase").mockResolvedValue();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    await gracefulShutdown("SIGTERM");

    expect(serverCloseSpy).toHaveBeenCalled();
    expect(dbDisconnectSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    serverCloseSpy.mockRestore();
    dbDisconnectSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
