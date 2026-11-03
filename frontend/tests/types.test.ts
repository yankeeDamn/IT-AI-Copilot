import assert from "node:assert/strict";
import test from "node:test";
import { canApprove, canModify } from "../src/lib/types.ts";

test("role checks are least-privilege UI hints", () => {
  assert.equal(canModify("viewer"), false);
  assert.equal(canModify("technician"), true);
  assert.equal(canApprove("technician"), false);
  assert.equal(canApprove("admin"), true);
});
