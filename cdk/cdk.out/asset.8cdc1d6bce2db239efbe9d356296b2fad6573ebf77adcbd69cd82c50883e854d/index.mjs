// cdk/lambda/api.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
var HttpError = class extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
};
var jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};
var dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true
  }
});
function parseJsonBody(rawBody) {
  if (!rawBody) {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}
function validateRequiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be a non-empty string.`
    );
  }
  return value.trim();
}
function validateEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "email must be a valid email address."
    );
  }
}
function validateYear(value, fieldName) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1970 || value > 3e3) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be an integer between 1970 and 3000.`
    );
  }
}
function validateTaskStatus(value) {
  if (value === "todo" || value === "in_progress" || value === "done") {
    return value;
  }
  throw new HttpError(
    400,
    "VALIDATION_ERROR",
    "status must be one of todo, in_progress, or done."
  );
}
function validateOptionalDate(value, fieldName) {
  if (value === void 0 || value === null) {
    return null;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must use YYYY-MM-DD format.`
    );
  }
  return value;
}
async function listUsers() {
  return scanEntity("USER", toUser);
}
async function requireUser(userId) {
  const record = await getEntity(createKey("USER", userId));
  if (!record || record.entityType !== "USER") {
    throw new HttpError(404, "USER_NOT_FOUND", `User ${userId} was not found.`);
  }
  return toUser(record);
}
async function putUser(user) {
  const record = {
    pk: createPartitionKey("USER", user.id),
    sk: createSortKey("USER", user.id),
    entityType: "USER",
    ...user
  };
  await putEntity(record);
}
async function deleteUserRecord(userId) {
  await deleteEntity(createKey("USER", userId));
}
async function userHasYearclocks(userId) {
  return hasEntity(
    "YEARCLOCK",
    "#ownerId = :ownerId",
    { "#ownerId": "ownerId" },
    { ":ownerId": userId }
  );
}
async function userHasTasks(userId) {
  return hasEntity(
    "TASK",
    "#userId = :userId",
    { "#userId": "userId" },
    { ":userId": userId }
  );
}
async function listYearclocks() {
  return scanEntity("YEARCLOCK", toYearclock);
}
async function requireYearclock(yearclockId) {
  const record = await getEntity(createKey("YEARCLOCK", yearclockId));
  if (!record || record.entityType !== "YEARCLOCK") {
    throw new HttpError(
      404,
      "YEARCLOCK_NOT_FOUND",
      `Yearclock ${yearclockId} was not found.`
    );
  }
  return toYearclock(record);
}
async function putYearclock(yearclock) {
  const record = {
    pk: createPartitionKey("YEARCLOCK", yearclock.id),
    sk: createSortKey("YEARCLOCK", yearclock.id),
    entityType: "YEARCLOCK",
    ...yearclock
  };
  await putEntity(record);
}
async function deleteYearclockRecord(yearclockId) {
  await deleteEntity(createKey("YEARCLOCK", yearclockId));
}
async function yearclockHasTasks(yearclockId) {
  return hasEntity(
    "TASK",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId }
  );
}
async function listTasks() {
  return scanEntity("TASK", toTask);
}
async function requireTask(taskId) {
  const record = await getEntity(createKey("TASK", taskId));
  if (!record || record.entityType !== "TASK") {
    throw new HttpError(404, "TASK_NOT_FOUND", `Task ${taskId} was not found.`);
  }
  return toTask(record);
}
async function putTask(task) {
  const record = {
    pk: createPartitionKey("TASK", task.id),
    sk: createSortKey("TASK", task.id),
    entityType: "TASK",
    ...task
  };
  await putEntity(record);
}
async function deleteTaskRecord(taskId) {
  await deleteEntity(createKey("TASK", taskId));
}
function methodNotAllowed(method, resource) {
  return new HttpError(
    405,
    "METHOD_NOT_ALLOWED",
    `Method ${method} is not supported for ${resource}.`
  );
}
function getMethod(event) {
  const method = event.requestContext?.http?.method;
  if (method === "GET" || method === "POST" || method === "PATCH" || method === "DELETE") {
    return method;
  }
  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Unsupported HTTP method.");
}
function normalizePath(path) {
  if (!path || path === "/") {
    return "/";
  }
  const normalized = path.replace(/\/+$/, "");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
function getPathSegments(path) {
  if (path === "/") {
    return [];
  }
  return path.split("/").map((segment) => segment.trim()).filter(Boolean);
}
function ok(payload) {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  };
}
function created(payload) {
  return {
    statusCode: 201,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  };
}
function noContent() {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: ""
  };
}
function handleError(error) {
  if (error instanceof HttpError) {
    const body2 = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
    return {
      statusCode: error.statusCode,
      headers: jsonHeaders,
      body: JSON.stringify(body2)
    };
  }
  const body = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  };
  return {
    statusCode: 500,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}
function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function scanEntity(entityType, mapper) {
  const items = await scanAll({
    FilterExpression: "#entityType = :entityType",
    ExpressionAttributeNames: {
      "#entityType": "entityType"
    },
    ExpressionAttributeValues: {
      ":entityType": entityType
    }
  });
  return items.map((item) => mapper(item));
}
async function hasEntity(entityType, extraFilter, extraNames, extraValues) {
  const items = await scanAll({
    FilterExpression: "#entityType = :entityType AND " + extraFilter,
    ExpressionAttributeNames: {
      "#entityType": "entityType",
      ...extraNames
    },
    ExpressionAttributeValues: {
      ":entityType": entityType,
      ...extraValues
    },
    Limit: 1
  });
  return items.length > 0;
}
async function getEntity(key) {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: key
    })
  );
  return response.Item;
}
async function putEntity(item) {
  await dynamoDbClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item
    })
  );
}
async function deleteEntity(key) {
  await dynamoDbClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: key
    })
  );
}
async function scanAll(input) {
  const items = [];
  let exclusiveStartKey;
  do {
    const response = await dynamoDbClient.send(
      new ScanCommand({
        TableName: getTableName(),
        ...input,
        ExclusiveStartKey: exclusiveStartKey
      })
    );
    items.push(...response.Items ?? []);
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey && (input.Limit === void 0 || items.length < input.Limit));
  return input.Limit === void 0 ? items : items.slice(0, input.Limit);
}
function getTableName() {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new HttpError(
      500,
      "TABLE_NAME_NOT_CONFIGURED",
      "TABLE_NAME environment variable is required."
    );
  }
  return tableName;
}
function createKey(entityType, id) {
  return {
    pk: createPartitionKey(entityType, id),
    sk: createSortKey(entityType, id)
  };
}
function createPartitionKey(entityType, id) {
  return `${entityType}#${id}`;
}
function createSortKey(entityType, id) {
  return `${entityType}#${id}`;
}
function toUser(record) {
  return {
    id: String(record.id),
    email: String(record.email),
    displayName: String(record.displayName),
    createdAt: String(record.createdAt)
  };
}
function toYearclock(record) {
  return {
    id: String(record.id),
    title: String(record.title),
    year: Number(record.year),
    ownerId: String(record.ownerId),
    createdAt: String(record.createdAt)
  };
}
function toTask(record) {
  return {
    id: String(record.id),
    title: String(record.title),
    status: record.status,
    dueDate: record.dueDate === null || record.dueDate === void 0 ? null : String(record.dueDate),
    userId: String(record.userId),
    yearclockId: String(record.yearclockId),
    createdAt: String(record.createdAt)
  };
}

// cdk/lambda/routes/tasks.ts
async function tasks(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listTasks() });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      return created(await createTask(payload));
    }
  }
  if (segments.length === 2) {
    const taskId = segments[1];
    if (method === "GET") {
      return ok(await requireTask(taskId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      return ok(await updateTask(taskId, payload));
    }
    if (method === "DELETE") {
      await deleteTask(taskId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/tasks");
}
async function createTask(input) {
  validateRequiredString(input.title, "title");
  const status = validateTaskStatus(input.status ?? "todo");
  const dueDate = validateOptionalDate(input.dueDate, "dueDate");
  await requireUser(validateRequiredString(input.userId, "userId"));
  await requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));
  const task = {
    id: createId("tsk"),
    title: input.title.trim(),
    status,
    dueDate,
    userId: input.userId.trim(),
    yearclockId: input.yearclockId.trim(),
    createdAt: nowIso()
  };
  await putTask(task);
  return task;
}
async function updateTask(taskId, input) {
  const task = await requireTask(taskId);
  if (input.title !== void 0) {
    validateRequiredString(input.title, "title");
    task.title = input.title.trim();
  }
  if (input.status !== void 0) {
    task.status = validateTaskStatus(input.status);
  }
  if (input.dueDate !== void 0) {
    task.dueDate = validateOptionalDate(input.dueDate, "dueDate");
  }
  if (input.userId !== void 0) {
    await requireUser(validateRequiredString(input.userId, "userId"));
    task.userId = input.userId.trim();
  }
  if (input.yearclockId !== void 0) {
    await requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));
    task.yearclockId = input.yearclockId.trim();
  }
  await putTask(task);
  return task;
}
async function deleteTask(taskId) {
  await requireTask(taskId);
  await deleteTaskRecord(taskId);
}

// cdk/lambda/routes/users.ts
async function users(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listUsers() });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      return created(await createUser(payload));
    }
  }
  if (segments.length === 2) {
    const userId = segments[1];
    if (method === "GET") {
      return ok(await requireUser(userId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      return ok(await updateUser(userId, payload));
    }
    if (method === "DELETE") {
      await deleteUser(userId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/users");
}
async function createUser(input) {
  validateRequiredString(input.email, "email");
  validateRequiredString(input.displayName, "displayName");
  validateEmail(input.email);
  const user = {
    id: createId("usr"),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    createdAt: nowIso()
  };
  await putUser(user);
  return user;
}
async function updateUser(userId, input) {
  const user = await requireUser(userId);
  if (input.email !== void 0) {
    validateRequiredString(input.email, "email");
    validateEmail(input.email);
    user.email = input.email.trim().toLowerCase();
  }
  if (input.displayName !== void 0) {
    validateRequiredString(input.displayName, "displayName");
    user.displayName = input.displayName.trim();
  }
  await putUser(user);
  return user;
}
async function deleteUser(userId) {
  await requireUser(userId);
  const hasOwnedYearclocks = await userHasYearclocks(userId);
  if (hasOwnedYearclocks) {
    throw new HttpError(
      409,
      "USER_HAS_YEARCLOCKS",
      "Delete the user's yearclocks before deleting the user."
    );
  }
  const hasTasks = await userHasTasks(userId);
  if (hasTasks) {
    throw new HttpError(
      409,
      "USER_HAS_TASKS",
      "Delete the user's tasks before deleting the user."
    );
  }
  await deleteUserRecord(userId);
}

// cdk/lambda/routes/yearclocks.ts
async function yearclocks(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listYearclocks() });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      return created(await createYearclock(payload));
    }
  }
  if (segments.length === 2) {
    const yearclockId = segments[1];
    if (method === "GET") {
      return ok(await requireYearclock(yearclockId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      return ok(await updateYearclock(yearclockId, payload));
    }
    if (method === "DELETE") {
      await deleteYearclock(yearclockId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/yearclocks");
}
async function createYearclock(input) {
  validateRequiredString(input.title, "title");
  validateYear(input.year, "year");
  await requireUser(validateRequiredString(input.ownerId, "ownerId"));
  const yearclock = {
    id: createId("ycl"),
    title: input.title.trim(),
    year: input.year,
    ownerId: input.ownerId.trim(),
    createdAt: nowIso()
  };
  await putYearclock(yearclock);
  return yearclock;
}
async function updateYearclock(yearclockId, input) {
  const yearclock = await requireYearclock(yearclockId);
  if (input.title !== void 0) {
    validateRequiredString(input.title, "title");
    yearclock.title = input.title.trim();
  }
  if (input.year !== void 0) {
    validateYear(input.year, "year");
    yearclock.year = input.year;
  }
  if (input.ownerId !== void 0) {
    await requireUser(validateRequiredString(input.ownerId, "ownerId"));
    yearclock.ownerId = input.ownerId.trim();
  }
  await putYearclock(yearclock);
  return yearclock;
}
async function deleteYearclock(yearclockId) {
  await requireYearclock(yearclockId);
  const hasTasks = await yearclockHasTasks(yearclockId);
  if (hasTasks) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_TASKS",
      "Delete the yearclock's tasks before deleting the yearclock."
    );
  }
  await deleteYearclockRecord(yearclockId);
}

// cdk/lambda/index.ts
async function handler(event) {
  try {
    const method = getMethod(event);
    const path = normalizePath(event.rawPath);
    const segments = getPathSegments(path);
    if (segments.length === 0) {
      return ok({
        service: "yearclocky-api",
        functionName: "api-handler",
        routes: ["/tasks", "/yearclocks", "/users"]
      });
    }
    const resource = segments[0];
    switch (resource) {
      case "tasks":
        return await tasks(method, segments, event.body);
      case "yearclocks":
        return await yearclocks(method, segments, event.body);
      case "users":
        return await users(method, segments, event.body);
      default:
        throw new HttpError(404, "NOT_FOUND", `Route ${path} was not found.`);
    }
  } catch (error) {
    return handleError(error);
  }
}
export {
  handler
};
