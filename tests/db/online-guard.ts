import pg from "pg";
import { invariantConnection } from "./test-connection";

const db = new pg.Client(invariantConnection());
try {
  await db.connect();
  const { rows } = await db.query(
    "select run_id from atenza_validation.run where run_id=$1 and expires_at>now()",
    [process.env.ATENZA_TEST_RUN_ID],
  );
  if (rows.length !== 1) throw new Error("Banco fora da execução descartável autorizada pelo runner.");
} finally {
  await db.end();
}
