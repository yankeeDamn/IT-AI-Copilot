import assert from "node:assert/strict";
import test from "node:test";

import { ticketCreateSchema, listQuerySchema } from "../lib/ticket-contract";

test("validates incident submissions", () => {
  const input = ticketCreateSchema.parse({
    title: "VPN drops after sign-in",
    description: "Repeated VPN failures on Windows laptops.",
    priority: "HIGH"
  });
  assert.equal(input.priority, "HIGH");
  assert.equal(ticketCreateSchema.safeParse({ title: "a", description: "", priority: "CRITICAL" }).success, false);
  assert.equal(ticketCreateSchema.safeParse({
    title: "Valid title", description: "A sufficiently long description",
    priority: "CRITICAL", organizationId: "attacker-chosen"
  }).success, false);
});

test("rejects unbounded pagination and invalid filters", () => {
  assert.equal(listQuerySchema.safeParse({ limit: "10000" }).success, false);
  assert.equal(listQuerySchema.parse({}).limit, 25);
  assert.equal(listQuerySchema.safeParse({ status: "DROP TABLE" }).success, false);
});
