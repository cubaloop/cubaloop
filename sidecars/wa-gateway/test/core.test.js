import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateConfig, TestDispatch, readJson } from "../core.js";
const config = {
  admin: "971500000001",
  recipient: "971500000002",
  name: "Test",
  message: "Mensaje ficticio para prueba automatizada.",
};
async function fixture(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jota-wa-"));
  try {
    await fn(path.join(dir, "dispatch.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
function socket(send) {
  return {
    user: { id: config.admin + ":1@s.whatsapp.net" },
    onWhatsApp: async () => [{ exists: true }],
    sendMessage: send,
  };
}
test("normalizes phones and rejects invalid/same recipients", () => {
  assert.equal(
    validateConfig({ ...config, admin: "+971 500000001" }).admin,
    config.admin,
  );
  assert.throws(() => validateConfig({ ...config, admin: "abc" }));
  assert.throws(() => validateConfig({ ...config, recipient: config.admin }));
});
test("requires correct owner and explicit approval", () =>
  fixture(async (file) => {
    const d = new TestDispatch(file);
    let calls = 0;
    const s = socket(async () => {
      calls++;
    });
    await assert.rejects(d.send(s, config, false));
    await assert.rejects(
      d.send(
        { ...s, user: { id: "971500000099@s.whatsapp.net" } },
        config,
        true,
      ),
    );
    assert.equal(calls, 0);
  }));
test("sends exact approved message once, including after restart", () =>
  fixture(async (file) => {
    let calls = 0;
    const s = socket(async (jid, body) => {
      calls++;
      assert.equal(jid, config.recipient + "@s.whatsapp.net");
      assert.deepEqual(body, { text: config.message });
      return {
        key: { id: "message-test" },
        message: { conversation: body.text },
      };
    });
    await new TestDispatch(file).send(s, config, true);
    const again = await new TestDispatch(file).send(s, config, true);
    assert.equal(again.status, "accepted");
    assert.equal(calls, 1);
  }));
test("network ambiguity never retries automatically", () =>
  fixture(async (file) => {
    let calls = 0;
    const s = socket(async () => {
      calls++;
      throw Error("timeout");
    });
    await assert.rejects(new TestDispatch(file).send(s, config, true));
    await assert.rejects(new TestDispatch(file).send(s, config, true));
    assert.equal((await readJson(file)).status, "sending");
    assert.equal(calls, 1);
  }));
test("parallel sends cannot duplicate delivery", () =>
  fixture(async (file) => {
    let calls = 0;
    const s = socket(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { key: { id: "one" } };
    });
    const d = new TestDispatch(file);
    const results = await Promise.allSettled([
      d.send(s, config, true),
      d.send(s, config, true),
    ]);
    assert.equal(calls, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  }));
test("unregistered contact is never dispatched", () =>
  fixture(async (file) => {
    let calls = 0;
    const s = {
      ...socket(async () => {
        calls++;
      }),
      onWhatsApp: async () => [{ exists: false }],
    };
    await assert.rejects(new TestDispatch(file).send(s, config, true));
    assert.equal(calls, 0);
    assert.equal(await readJson(file, null), null);
  }));
