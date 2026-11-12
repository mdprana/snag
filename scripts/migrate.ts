import { db, migrate } from "../src/lib/db.ts";

const applied = await migrate(db());
console.log(applied.length ? `applied: ${applied.join(", ")}` : "up to date");
