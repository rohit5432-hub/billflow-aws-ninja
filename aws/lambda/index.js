// BillFlow API — single Lambda routes all /api/* paths via API Gateway HTTP API.
// Single-table DynamoDB:
//   PK="COMPANY"          SK="SINGLETON"
//   PK="CUSTOMER"         SK=<id>
//   PK="INVOICE"          SK=<id>
//   PK="USER"             SK=<id>

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "content-type": "application/json",
};

const ok = (body, status = 200) => ({
  statusCode: status,
  headers: cors,
  body: JSON.stringify(body),
});
const err = (msg, status = 400) => ok({ error: msg }, status);

async function listByPK(pk) {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk },
    })
  );
  return (out.Items || []).map(stripKeys);
}
const stripKeys = ({ PK, SK, ...rest }) => rest;

async function getOne(pk, sk) {
  const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
  return out.Item ? stripKeys(out.Item) : null;
}

async function putItem(pk, sk, item) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: pk, SK: sk, ...item } }));
  return item;
}

async function deleteItem(pk, sk) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
}

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod || "GET";
    const rawPath = event.rawPath || event.path || "/";
    const path = rawPath.replace(/^\/api/, "") || "/";
    const body = event.body ? JSON.parse(event.body) : null;

    if (method === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };

    // ---------- Company (singleton) ----------
    if (path === "/company") {
      if (method === "GET") return ok((await getOne("COMPANY", "SINGLETON")) || null);
      if (method === "PUT") return ok(await putItem("COMPANY", "SINGLETON", body));
    }

    // ---------- Customers ----------
    if (path === "/customers") {
      if (method === "GET") return ok(await listByPK("CUSTOMER"));
      if (method === "POST") {
        const id = randomUUID();
        return ok(await putItem("CUSTOMER", id, { ...body, id }), 201);
      }
    }
    let m = path.match(/^\/customers\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === "GET") return ok(await getOne("CUSTOMER", id));
      if (method === "PUT") return ok(await putItem("CUSTOMER", id, { ...body, id }));
      if (method === "DELETE") {
        await deleteItem("CUSTOMER", id);
        return ok({ ok: true });
      }
    }

    // ---------- Invoices ----------
    if (path === "/invoices") {
      if (method === "GET") return ok(await listByPK("INVOICE"));
      if (method === "POST") {
        const id = randomUUID();
        // generate sequential number
        const all = await listByPK("INVOICE");
        const number = `INV-${String(all.length + 1).padStart(4, "0")}`;
        const inv = { ...body, id, number };
        return ok(await putItem("INVOICE", id, inv), 201);
      }
    }
    m = path.match(/^\/invoices\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === "GET") return ok(await getOne("INVOICE", id));
      if (method === "PUT") return ok(await putItem("INVOICE", id, { ...body, id }));
      if (method === "DELETE") {
        await deleteItem("INVOICE", id);
        return ok({ ok: true });
      }
    }
    m = path.match(/^\/invoices\/([^/]+)\/status$/);
    if (m && method === "PUT") {
      const id = m[1];
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: "INVOICE", SK: id },
          UpdateExpression: "SET #s = :s",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": body.status },
        })
      );
      return ok({ ok: true });
    }

    // ---------- Users ----------
    if (path === "/users") {
      if (method === "GET") return ok(await listByPK("USER"));
      if (method === "POST") {
        const id = randomUUID();
        const user = { ...body, id, createdAt: new Date().toISOString() };
        return ok(await putItem("USER", id, user), 201);
      }
    }
    m = path.match(/^\/users\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (method === "PUT") return ok(await putItem("USER", id, { ...body, id }));
      if (method === "DELETE") {
        await deleteItem("USER", id);
        return ok({ ok: true });
      }
    }

    // ---------- Health ----------
    if (path === "/" || path === "/health") return ok({ ok: true, service: "billflow-api" });

    return err(`Not found: ${method} ${path}`, 404);
  } catch (e) {
    console.error(e);
    return err(e.message || "Internal error", 500);
  }
};
