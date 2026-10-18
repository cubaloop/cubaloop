import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, ["sidecars/wa-gateway/server.js"], {
  cwd: root,
  env: process.env,
  stdio: ["inherit", "pipe", "inherit"],
});
let buffer = "",
  opened = false;
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  buffer += chunk.toString();
  const match = buffer.match(
    /Panel privado del operador: (http:\/\/127\.0\.0\.1:\d+\/#[-\w]+)/,
  );
  if (match && !opened) {
    opened = true;
    const command =
      process.platform === "win32"
        ? "rundll32.exe"
        : process.platform === "darwin"
          ? "open"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", match[1]]
        : [match[1]];
    const browser = spawn(command, args, { stdio: "ignore" });
    browser.on("error", () =>
      console.log(
        "Abre el enlace privado que aparece arriba en un navegador de este ordenador.",
      ),
    );
  }
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
