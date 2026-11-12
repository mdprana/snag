import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/db";
import { deleteAccount, requireOwner } from "@/src/lib/auth";
import { createSession, getSession } from "@/src/lib/session";

describe("account auth", () => {
  it("logout invalidates session", async () => {
    const db = await testDb();
    await db.execute({ sql: "INSERT INTO users(id, created_at) VALUES(?, ?)", args: ["u1", Date.now()] });
    const session = await createSession(db, "u1");
    expect(await getSession(db, session.cookie)).toEqual({ userId: "u1" });
    await db.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: ["u1"] });
    expect(await getSession(db, session.cookie)).toBeNull();
  });

  it("delete removes all user rows", async () => {
    const db = await testDb();
    await db.execute({ sql: "INSERT INTO users(id, created_at) VALUES(?, ?)", args: ["u1", Date.now()] });
    await db.batch([
      { sql: "INSERT INTO identities(provider, subject, user_id, display_name, created_at) VALUES('steam', ?, ?, 'x', ?)", args: ["76561198000000000", "u1", Date.now()] },
      { sql: "INSERT INTO sessions(id_hash, user_id, created_at, expires_at) VALUES('s', ?, ?, ?)", args: ["u1", Date.now(), Date.now() + 1000] },
    ]);
    await deleteAccount(db, "u1");
    expect((await db.execute("SELECT * FROM users")).rows).toHaveLength(0);
    expect((await db.execute("SELECT * FROM identities")).rows).toHaveLength(0);
    expect((await db.execute("SELECT * FROM sessions")).rows).toHaveLength(0);
  });

  it("requireOwner rejects non-owner", async () => {
    const db = await testDb();
    await db.execute({ sql: "INSERT INTO users(id, created_at) VALUES(?, ?)", args: ["u1", Date.now()] });
    await db.execute({ sql: "INSERT INTO identities(provider, subject, user_id, display_name, created_at) VALUES('steam', ?, ?, 'x', ?)", args: ["76561198000000000", "u1", Date.now()] });
    await expect(requireOwner(db, "u1", "76561198000000001")).rejects.toMatchObject({ status: 404 });
  });
});
