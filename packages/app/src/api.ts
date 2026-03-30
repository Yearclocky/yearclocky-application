import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiGatewayEvent = {
  rawPath?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
  body?: string | null;
};

export type ApiResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export type EntityId = string;

export type User = {
  id: EntityId;
  email: string;
  displayName: string;
  createdAt: string;
};

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: EntityId;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  userId: EntityId;
  yearclockId: EntityId;
  createdAt: string;
};

export type Yearclock = {
  id: EntityId;
  title: string;
  year: number;
  ownerId: EntityId;
  createdAt: string;
};

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type EntityType = "USER" | "YEARCLOCK" | "TASK";

type BaseRecord = {
  pk: string;
  sk: string;
  entityType: EntityType;
  id: string;
};

type UserRecord = BaseRecord &
  User & {
    entityType: "USER";
  };

type YearclockRecord = BaseRecord &
  Yearclock & {
    entityType: "YEARCLOCK";
  };

type TaskRecord = BaseRecord &
  Task & {
    entityType: "TASK";
  };

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
};

const dynamoDbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export function parseJsonBody<T>(rawBody?: string | null): T {
  if (!rawBody) {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

export function validateRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be a non-empty string.`,
    );
  }

  return value.trim();
}

export function validateEmail(value: string): void {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "email must be a valid email address.",
    );
  }
}

export function validateYear(
  value: unknown,
  fieldName: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1970 ||
    value > 3000
  ) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be an integer between 1970 and 3000.`,
    );
  }
}

export function validateTaskStatus(value: unknown): TaskStatus {
  if (value === "todo" || value === "in_progress" || value === "done") {
    return value;
  }

  throw new HttpError(
    400,
    "VALIDATION_ERROR",
    "status must be one of todo, in_progress, or done.",
  );
}

export function validateOptionalDate(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must use YYYY-MM-DD format.`,
    );
  }

  return value;
}

export async function listUsers(): Promise<User[]> {
  return scanEntity("USER", toUser);
}

export async function requireUser(userId: EntityId): Promise<User> {
  const record = await getEntity<UserRecord>(createKey("USER", userId));
  if (!record || record.entityType !== "USER") {
    throw new HttpError(404, "USER_NOT_FOUND", `User ${userId} was not found.`);
  }

  return toUser(record);
}

export async function putUser(user: User): Promise<void> {
  const record: UserRecord = {
    pk: createPartitionKey("USER", user.id),
    sk: createSortKey("USER", user.id),
    entityType: "USER",
    ...user,
  };

  await putEntity(record);
}

export async function deleteUserRecord(userId: EntityId): Promise<void> {
  await deleteEntity(createKey("USER", userId));
}

export async function userHasYearclocks(userId: EntityId): Promise<boolean> {
  return hasEntity(
    "YEARCLOCK",
    "#ownerId = :ownerId",
    { "#ownerId": "ownerId" },
    { ":ownerId": userId },
  );
}

export async function userHasTasks(userId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK",
    "#userId = :userId",
    { "#userId": "userId" },
    { ":userId": userId },
  );
}

export async function listYearclocks(): Promise<Yearclock[]> {
  return scanEntity("YEARCLOCK", toYearclock);
}

export async function requireYearclock(yearclockId: EntityId): Promise<Yearclock> {
  const record = await getEntity<YearclockRecord>(createKey("YEARCLOCK", yearclockId));
  if (!record || record.entityType !== "YEARCLOCK") {
    throw new HttpError(
      404,
      "YEARCLOCK_NOT_FOUND",
      `Yearclock ${yearclockId} was not found.`,
    );
  }

  return toYearclock(record);
}

export async function putYearclock(yearclock: Yearclock): Promise<void> {
  const record: YearclockRecord = {
    pk: createPartitionKey("YEARCLOCK", yearclock.id),
    sk: createSortKey("YEARCLOCK", yearclock.id),
    entityType: "YEARCLOCK",
    ...yearclock,
  };

  await putEntity(record);
}

export async function deleteYearclockRecord(yearclockId: EntityId): Promise<void> {
  await deleteEntity(createKey("YEARCLOCK", yearclockId));
}

export async function yearclockHasTasks(yearclockId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId },
  );
}

export async function listTasks(): Promise<Task[]> {
  return scanEntity("TASK", toTask);
}

export async function requireTask(taskId: EntityId): Promise<Task> {
  const record = await getEntity<TaskRecord>(createKey("TASK", taskId));
  if (!record || record.entityType !== "TASK") {
    throw new HttpError(404, "TASK_NOT_FOUND", `Task ${taskId} was not found.`);
  }

  return toTask(record);
}

export async function putTask(task: Task): Promise<void> {
  const record: TaskRecord = {
    pk: createPartitionKey("TASK", task.id),
    sk: createSortKey("TASK", task.id),
    entityType: "TASK",
    ...task,
  };

  await putEntity(record);
}

export async function deleteTaskRecord(taskId: EntityId): Promise<void> {
  await deleteEntity(createKey("TASK", taskId));
}

export function methodNotAllowed(method: HttpMethod, resource: string): HttpError {
  return new HttpError(
    405,
    "METHOD_NOT_ALLOWED",
    `Method ${method} is not supported for ${resource}.`,
  );
}

export function getMethod(event: ApiGatewayEvent): HttpMethod {
  const method = event.requestContext?.http?.method;
  if (
    method === "GET" ||
    method === "POST" ||
    method === "PATCH" ||
    method === "DELETE"
  ) {
    return method;
  }

  throw new HttpError(405, "METHOD_NOT_ALLOWED", "Unsupported HTTP method.");
}

export function normalizePath(path?: string): string {
  if (!path || path === "/") {
    return "/";
  }

  const normalized = path.replace(/\/+$/, "");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function getPathSegments(path: string): string[] {
  if (path === "/") {
    return [];
  }

  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function ok(payload: unknown): ApiResponse {
  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

export function created(payload: unknown): ApiResponse {
  return {
    statusCode: 201,
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  };
}

export function noContent(): ApiResponse {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: "",
  };
}

export function handleError(error: unknown): ApiResponse {
  if (error instanceof HttpError) {
    const body: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };

    return {
      statusCode: error.statusCode,
      headers: jsonHeaders,
      body: JSON.stringify(body),
    };
  }

  const body: ErrorBody = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  };

  return {
    statusCode: 500,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  };
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

async function scanEntity<T>(
  entityType: EntityType,
  mapper: (record: Record<string, unknown>) => T,
): Promise<T[]> {
  const items = await scanAll({
    FilterExpression: "#entityType = :entityType",
    ExpressionAttributeNames: {
      "#entityType": "entityType",
    },
    ExpressionAttributeValues: {
      ":entityType": entityType,
    },
  });

  return items.map((item) => mapper(item));
}

async function hasEntity(
  entityType: EntityType,
  extraFilter: string,
  extraNames: Record<string, string>,
  extraValues: Record<string, unknown>,
): Promise<boolean> {
  const items = await scanAll({
    FilterExpression: "#entityType = :entityType AND " + extraFilter,
    ExpressionAttributeNames: {
      "#entityType": "entityType",
      ...extraNames,
    },
    ExpressionAttributeValues: {
      ":entityType": entityType,
      ...extraValues,
    },
    Limit: 1,
  });

  return items.length > 0;
}

async function getEntity<T>(key: { pk: string; sk: string }): Promise<T | undefined> {
  const response = await dynamoDbClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: key,
    }),
  );

  return response.Item as T | undefined;
}

async function putEntity(item: Record<string, unknown>): Promise<void> {
  await dynamoDbClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
    }),
  );
}

async function deleteEntity(key: { pk: string; sk: string }): Promise<void> {
  await dynamoDbClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: key,
    }),
  );
}

async function scanAll(input: {
  FilterExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
  Limit?: number;
}): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await dynamoDbClient.send(
      new ScanCommand({
        TableName: getTableName(),
        ...input,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...((response.Items as Record<string, unknown>[] | undefined) ?? []));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey && (input.Limit === undefined || items.length < input.Limit));

  return input.Limit === undefined ? items : items.slice(0, input.Limit);
}

function getTableName(): string {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new HttpError(
      500,
      "TABLE_NAME_NOT_CONFIGURED",
      "TABLE_NAME environment variable is required.",
    );
  }

  return tableName;
}

function createKey(entityType: EntityType, id: string): { pk: string; sk: string } {
  return {
    pk: createPartitionKey(entityType, id),
    sk: createSortKey(entityType, id),
  };
}

function createPartitionKey(entityType: EntityType, id: string): string {
  return `${entityType}#${id}`;
}

function createSortKey(entityType: EntityType, id: string): string {
  return `${entityType}#${id}`;
}

function toUser(record: Record<string, unknown>): User {
  return {
    id: String(record.id),
    email: String(record.email),
    displayName: String(record.displayName),
    createdAt: String(record.createdAt),
  };
}

function toYearclock(record: Record<string, unknown>): Yearclock {
  return {
    id: String(record.id),
    title: String(record.title),
    year: Number(record.year),
    ownerId: String(record.ownerId),
    createdAt: String(record.createdAt),
  };
}

function toTask(record: Record<string, unknown>): Task {
  return {
    id: String(record.id),
    title: String(record.title),
    status: record.status as TaskStatus,
    dueDate:
      record.dueDate === null || record.dueDate === undefined
        ? null
        : String(record.dueDate),
    userId: String(record.userId),
    yearclockId: String(record.yearclockId),
    createdAt: String(record.createdAt),
  };
}
