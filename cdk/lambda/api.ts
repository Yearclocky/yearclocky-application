import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiGatewayEvent = {
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
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

export type QueryParams = Record<string, string>;

export type EntityId = string;

export type Role = "owner" | "member";

export type TaskStatus = "active" | "disabled";

export type RecurrenceType = "yearly" | "monthly";

export type User = {
  id: EntityId;
  email: string;
  name: string;
  createdAt?: string;
};

export type Yearclock = {
  id: EntityId;
  name: string;
  ownerUserId: EntityId;
  createdAt: string;
};

export type Membership = {
  userId: EntityId;
  yearclockId: EntityId;
  role?: Role;
  joinedAt: string;
};

export type Category = {
  id: EntityId;
  yearclockId: EntityId;
  name: string;
  color: string;
  icon?: string;
  order: number;
  archived: boolean;
};

export type Task = {
  id: EntityId;
  yearclockId: EntityId;
  categoryId: EntityId;
  title: string;
  description?: string;
  recurrence: {
    type: RecurrenceType;
    months?: number[];
  };
  order: number;
  createdAt: string;
  createdBy: EntityId;
  status: TaskStatus;
};

export type TaskCompletion = {
  id: EntityId;
  taskId: EntityId;
  yearclockId: EntityId;
  year: number;
  month: number;
  completedAt: string;
  completedBy: EntityId;
  note?: string;
};

export type TaskMonthView = {
  taskId: EntityId;
  yearclockId: EntityId;
  category: Category;
  title: string;
  description?: string;
  recurrence: Task["recurrence"];
  order: number;
  year: number;
  month: number;
  completion?: TaskCompletion;
};

export type CategoryTaskGroup = {
  category: Category;
  activeTasks: TaskMonthView[];
  completedTasks: TaskMonthView[];
};

export type MonthTaskResponse = {
  yearclock: Yearclock;
  categories: CategoryTaskGroup[];
};

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type EntityType =
  | "USER"
  | "YEARCLOCK"
  | "MEMBERSHIP"
  | "CATEGORY"
  | "TASK"
  | "TASK_COMPLETION";

type BaseRecord = {
  pk: string;
  sk: string;
  entityType: EntityType;
  gsi1pk?: string;
  gsi1sk?: string;
};

type UserRecord = BaseRecord &
  User & {
    entityType: "USER";
  };

type YearclockRecord = BaseRecord &
  Yearclock & {
    entityType: "YEARCLOCK";
  };

type MembershipRecord = BaseRecord &
  Membership & {
    entityType: "MEMBERSHIP";
  };

type CategoryRecord = BaseRecord &
  Category & {
    entityType: "CATEGORY";
  };

type TaskRecord = BaseRecord &
  Task & {
    entityType: "TASK";
  };

type TaskCompletionRecord = BaseRecord &
  TaskCompletion & {
    entityType: "TASK_COMPLETION";
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

export function getQueryParams(event: ApiGatewayEvent): QueryParams {
  return Object.fromEntries(
    Object.entries(event.queryStringParameters ?? {}).flatMap(([key, value]) =>
      typeof value === "string" && value.trim().length > 0
        ? [[key, value.trim()]]
        : [],
    ),
  );
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

export function validateOptionalString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be a string when provided.`,
    );
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
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

export function validateMonth(
  value: unknown,
  fieldName: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 12) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be an integer between 1 and 12.`,
    );
  }
}

export function validateInteger(
  value: unknown,
  fieldName: string,
  minimum = 0,
): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be an integer greater than or equal to ${minimum}.`,
    );
  }
}

export function validateBoolean(
  value: unknown,
  fieldName: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `${fieldName} must be a boolean.`,
    );
  }
}

export function validateTaskStatus(value: unknown): TaskStatus {
  if (value === "active" || value === "disabled") {
    return value;
  }

  throw new HttpError(
    400,
    "VALIDATION_ERROR",
    "status must be one of active or disabled.",
  );
}

export function validateRole(value: unknown): Role {
  if (value === "owner" || value === "member") {
    return value;
  }

  throw new HttpError(
    400,
    "VALIDATION_ERROR",
    "role must be one of owner or member.",
  );
}

export function validateRecurrence(value: unknown): Task["recurrence"] {
  if (!value || typeof value !== "object") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "recurrence must be an object.",
    );
  }

  const recurrence = value as Task["recurrence"];
  if (recurrence.type !== "yearly" && recurrence.type !== "monthly") {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "recurrence.type must be yearly or monthly.",
    );
  }

  if (recurrence.type === "monthly") {
    return { type: "monthly" };
  }

  if (!Array.isArray(recurrence.months) || recurrence.months.length === 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "recurrence.months must contain at least one month for yearly tasks.",
    );
  }

  const months = [...new Set(recurrence.months)].sort((left, right) => left - right);
  for (const month of months) {
    validateMonth(month, "recurrence.months");
  }

  return {
    type: "yearly",
    months,
  };
}

export async function listUsers(): Promise<User[]> {
  return scanEntity("USER", toUser);
}

export async function requireUser(userId: EntityId): Promise<User> {
  const record = await getEntity<UserRecord>(createUserKey(userId));
  if (!record || record.entityType !== "USER") {
    throw new HttpError(404, "USER_NOT_FOUND", `User ${userId} was not found.`);
  }

  return toUser(record);
}

export async function putUser(user: User): Promise<void> {
  const record: UserRecord = {
    pk: createUserPartitionKey(user.id),
    sk: createUserSortKey(user.id),
    entityType: "USER",
    ...user,
  };

  await putEntity(record);
}

export async function deleteUserRecord(userId: EntityId): Promise<void> {
  await deleteEntity(createUserKey(userId));
}

export async function userHasYearclocks(userId: EntityId): Promise<boolean> {
  return hasEntity(
    "YEARCLOCK",
    "#ownerUserId = :ownerUserId",
    { "#ownerUserId": "ownerUserId" },
    { ":ownerUserId": userId },
  );
}

export async function userHasMemberships(userId: EntityId): Promise<boolean> {
  const memberships = await queryGsi1(createMembershipUserPartitionKey(userId), undefined, 1);
  return memberships.length > 0;
}

export async function userHasTasks(userId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK",
    "#createdBy = :createdBy",
    { "#createdBy": "createdBy" },
    { ":createdBy": userId },
  );
}

export async function userHasTaskCompletions(userId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK_COMPLETION",
    "#completedBy = :completedBy",
    { "#completedBy": "completedBy" },
    { ":completedBy": userId },
  );
}

export async function listYearclocks(): Promise<Yearclock[]> {
  return scanEntity("YEARCLOCK", toYearclock);
}

export async function requireYearclock(yearclockId: EntityId): Promise<Yearclock> {
  const record = await getEntity<YearclockRecord>(createYearclockKey(yearclockId));
  if (!record || record.entityType !== "YEARCLOCK") {
    throw new HttpError(
      404,
      "YEARCLOCK_NOT_FOUND",
      `Yearclock ${yearclockId} was not found.`,
    );
  }

  return toYearclock(record);
}

export async function requireDefaultYearclock(): Promise<Yearclock> {
  const yearclocks = await listYearclocks();
  if (yearclocks.length === 1) {
    return yearclocks[0];
  }

  throw new HttpError(
    400,
    "YEARCLOCK_ID_REQUIRED",
    "yearclockId is required when multiple yearclocks exist.",
  );
}

export async function putYearclock(yearclock: Yearclock): Promise<void> {
  const record: YearclockRecord = {
    pk: createYearclockPartitionKey(yearclock.id),
    sk: createYearclockSortKey(yearclock.id),
    entityType: "YEARCLOCK",
    ...yearclock,
  };

  await putEntity(record);
}

export async function deleteYearclockRecord(yearclockId: EntityId): Promise<void> {
  await deleteEntity(createYearclockKey(yearclockId));
}

export async function yearclockHasTasks(yearclockId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId },
  );
}

export async function yearclockHasCategories(yearclockId: EntityId): Promise<boolean> {
  return hasEntity(
    "CATEGORY",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId },
  );
}

export async function yearclockHasMemberships(yearclockId: EntityId): Promise<boolean> {
  return hasEntity(
    "MEMBERSHIP",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId },
  );
}

export async function yearclockHasTaskCompletions(yearclockId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK_COMPLETION",
    "#yearclockId = :yearclockId",
    { "#yearclockId": "yearclockId" },
    { ":yearclockId": yearclockId },
  );
}

export async function listMemberships(filters?: {
  userId?: EntityId;
  yearclockId?: EntityId;
}): Promise<Membership[]> {
  if (filters?.userId) {
    const items = await queryGsi1(createMembershipUserPartitionKey(filters.userId));
    const memberships = items
      .filter((item) => item.entityType === "MEMBERSHIP")
      .map((item) => toMembership(item as MembershipRecord));

    return memberships.filter((membership) => {
      if (filters.yearclockId && membership.yearclockId !== filters.yearclockId) {
        return false;
      }

      return true;
    });
  }

  const memberships = await scanEntity("MEMBERSHIP", toMembership);
  return memberships.filter((membership) => {
    if (filters?.userId && membership.userId !== filters.userId) {
      return false;
    }

    if (filters?.yearclockId && membership.yearclockId !== filters.yearclockId) {
      return false;
    }

    return true;
  });
}

export async function requireMembership(
  yearclockId: EntityId,
  userId: EntityId,
): Promise<Membership> {
  const record = await getEntity<MembershipRecord>(createMembershipKey(yearclockId, userId));
  if (!record || record.entityType !== "MEMBERSHIP") {
    throw new HttpError(
      404,
      "MEMBERSHIP_NOT_FOUND",
      `Membership for user ${userId} in yearclock ${yearclockId} was not found.`,
    );
  }

  return toMembership(record);
}

export async function putMembership(membership: Membership): Promise<void> {
  const record: MembershipRecord = {
    pk: createYearclockPartitionKey(membership.yearclockId),
    sk: createMembershipSortKey(membership.userId),
    gsi1pk: createMembershipUserPartitionKey(membership.userId),
    gsi1sk: createMembershipUserSortKey(membership.yearclockId),
    entityType: "MEMBERSHIP",
    ...membership,
  };

  await putEntity(record);
}

export async function deleteMembershipRecord(
  yearclockId: EntityId,
  userId: EntityId,
): Promise<void> {
  await deleteEntity(createMembershipKey(yearclockId, userId));
}

export async function listCategories(yearclockId?: EntityId): Promise<Category[]> {
  if (yearclockId) {
    const items = await queryPartition(createYearclockPartitionKey(yearclockId), "CATEGORY#");
    return items
      .filter((item) => item.entityType === "CATEGORY")
      .map((item) => toCategory(item as CategoryRecord));
  }

  return scanEntity("CATEGORY", toCategory);
}

export async function requireCategory(categoryId: EntityId): Promise<Category> {
  const categories = await scanEntity("CATEGORY", toCategory);
  const category = categories.find((entry) => entry.id === categoryId);
  if (!category) {
    throw new HttpError(
      404,
      "CATEGORY_NOT_FOUND",
      `Category ${categoryId} was not found.`,
    );
  }

  return category;
}

export async function putCategory(category: Category): Promise<void> {
  const record: CategoryRecord = {
    pk: createYearclockPartitionKey(category.yearclockId),
    sk: createCategorySortKey(category.id),
    entityType: "CATEGORY",
    ...category,
  };

  await putEntity(record);
}

export async function deleteCategoryRecord(category: Category): Promise<void> {
  await deleteEntity({
    pk: createYearclockPartitionKey(category.yearclockId),
    sk: createCategorySortKey(category.id),
  });
}

export async function categoryHasTasks(categoryId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK",
    "#categoryId = :categoryId",
    { "#categoryId": "categoryId" },
    { ":categoryId": categoryId },
  );
}

export async function listTasks(yearclockId?: EntityId): Promise<Task[]> {
  if (yearclockId) {
    const items = await queryPartition(createYearclockPartitionKey(yearclockId), "TASK#");
    return items
      .filter((item) => item.entityType === "TASK")
      .map((item) => toTask(item as TaskRecord));
  }

  return scanEntity("TASK", toTask);
}

export async function requireTask(taskId: EntityId): Promise<Task> {
  const tasks = await scanEntity("TASK", toTask);
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw new HttpError(404, "TASK_NOT_FOUND", `Task ${taskId} was not found.`);
  }

  return task;
}

export async function putTask(task: Task): Promise<void> {
  const record: TaskRecord = {
    pk: createYearclockPartitionKey(task.yearclockId),
    sk: createTaskSortKey(task.id),
    entityType: "TASK",
    ...task,
  };

  await putEntity(record);
}

export async function deleteTaskRecord(task: Task): Promise<void> {
  await deleteEntity({
    pk: createYearclockPartitionKey(task.yearclockId),
    sk: createTaskSortKey(task.id),
  });
}

export async function taskHasCompletions(taskId: EntityId): Promise<boolean> {
  return hasEntity(
    "TASK_COMPLETION",
    "#taskId = :taskId",
    { "#taskId": "taskId" },
    { ":taskId": taskId },
  );
}

export async function listTaskCompletions(filters?: {
  yearclockId?: EntityId;
  year?: number;
  month?: number;
  taskId?: EntityId;
}): Promise<TaskCompletion[]> {
  if (filters?.yearclockId && filters.year !== undefined && filters.month !== undefined) {
    const items = await queryPartition(
      createTaskCompletionPartitionKey(
        filters.yearclockId,
        filters.year,
        filters.month,
      ),
    );

    return items
      .filter((item) => item.entityType === "TASK_COMPLETION")
      .map((item) => toTaskCompletion(item as TaskCompletionRecord))
      .filter((completion) =>
        filters.taskId ? completion.taskId === filters.taskId : true,
      );
  }

  const completions = await scanEntity("TASK_COMPLETION", toTaskCompletion);
  return completions.filter((completion) => {
    if (filters?.yearclockId && completion.yearclockId !== filters.yearclockId) {
      return false;
    }

    if (filters?.year !== undefined && completion.year !== filters.year) {
      return false;
    }

    if (filters?.month !== undefined && completion.month !== filters.month) {
      return false;
    }

    if (filters?.taskId && completion.taskId !== filters.taskId) {
      return false;
    }

    return true;
  });
}

export async function requireTaskCompletion(
  completionId: EntityId,
): Promise<TaskCompletion> {
  const completions = await scanEntity("TASK_COMPLETION", toTaskCompletion);
  const completion = completions.find((entry) => entry.id === completionId);
  if (!completion) {
    throw new HttpError(
      404,
      "TASK_COMPLETION_NOT_FOUND",
      `Task completion ${completionId} was not found.`,
    );
  }

  return completion;
}

export async function putTaskCompletion(
  completion: TaskCompletion,
): Promise<void> {
  const record: TaskCompletionRecord = {
    pk: createTaskCompletionPartitionKey(
      completion.yearclockId,
      completion.year,
      completion.month,
    ),
    sk: createTaskCompletionSortKey(completion.taskId),
    entityType: "TASK_COMPLETION",
    ...completion,
  };

  await putEntity(record);
}

export async function deleteTaskCompletionRecord(
  completion: TaskCompletion,
): Promise<void> {
  await deleteEntity({
    pk: createTaskCompletionPartitionKey(
      completion.yearclockId,
      completion.year,
      completion.month,
    ),
    sk: createTaskCompletionSortKey(completion.taskId),
  });
}

export async function requireNoCompletionForTaskPeriod(
  yearclockId: EntityId,
  taskId: EntityId,
  year: number,
  month: number,
): Promise<void> {
  const existingCompletion = await listTaskCompletions({
    yearclockId,
    taskId,
    year,
    month,
  });

  if (existingCompletion.length > 0) {
    throw new HttpError(
      409,
      "TASK_COMPLETION_EXISTS",
      `Task ${taskId} is already completed for ${year}-${String(month).padStart(2, "0")}.`,
    );
  }
}

export async function buildMonthTaskResponse(input: {
  yearclockId?: EntityId;
  year: number;
  month: number;
}): Promise<MonthTaskResponse> {
  const yearclock = input.yearclockId
    ? await requireYearclock(input.yearclockId)
    : await requireDefaultYearclock();
  const categories = (await listCategories(yearclock.id))
    .filter((category) => !category.archived)
    .sort((left, right) => left.order - right.order);
  const tasks = (await listTasks(yearclock.id)).sort((left, right) => left.order - right.order);
  const completions = await listTaskCompletions({
    yearclockId: yearclock.id,
    year: input.year,
    month: input.month,
  });
  const completionByTaskId = new Map(
    completions.map((completion) => [completion.taskId, completion]),
  );

  return {
    yearclock,
    categories: categories
      .map((category) => {
        const taskViews = tasks
          .filter((task) => task.categoryId === category.id)
          .filter((task) => {
            if (task.recurrence.type === "monthly") {
              return true;
            }

            return task.recurrence.months?.includes(input.month) ?? false;
          })
          .flatMap((task) => {
            const completion = completionByTaskId.get(task.id);

            if (!completion && task.status !== "active") {
              return [];
            }

            return [
              {
                taskId: task.id,
                yearclockId: task.yearclockId,
                category,
                title: task.title,
                description: task.description,
                recurrence: task.recurrence,
                order: task.order,
                year: input.year,
                month: input.month,
                completion,
              },
            ];
          });

        return {
          category,
          activeTasks: taskViews.filter((task) => !task.completion),
          completedTasks: taskViews.filter((task) => task.completion),
        };
      })
      .filter((group) => group.activeTasks.length > 0 || group.completedTasks.length > 0),
  };
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

async function queryPartition(
  partitionKey: string,
  sortKeyPrefix?: string,
): Promise<Record<string, unknown>[]> {
  return queryIndex({
    partitionKeyName: "pk",
    sortKeyName: "sk",
    partitionKey,
    sortKeyPrefix,
  });
}

async function queryGsi1(
  partitionKey: string,
  sortKeyPrefix?: string,
  limit?: number,
): Promise<Record<string, unknown>[]> {
  return queryIndex({
    indexName: "gsi1",
    partitionKeyName: "gsi1pk",
    sortKeyName: "gsi1sk",
    partitionKey,
    sortKeyPrefix,
    limit,
  });
}

async function queryIndex(input: {
  indexName?: string;
  partitionKeyName: string;
  sortKeyName: string;
  partitionKey: string;
  sortKeyPrefix?: string;
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const response = await dynamoDbClient.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: input.indexName,
      KeyConditionExpression: input.sortKeyPrefix
        ? "#pk = :pk AND begins_with(#sk, :skPrefix)"
        : "#pk = :pk",
      ExpressionAttributeNames: {
        "#pk": input.partitionKeyName,
        "#sk": input.sortKeyName,
      },
      ExpressionAttributeValues: input.sortKeyPrefix
        ? {
            ":pk": input.partitionKey,
            ":skPrefix": input.sortKeyPrefix,
          }
        : {
            ":pk": input.partitionKey,
          },
      Limit: input.limit,
    }),
  );

  return (response.Items as Record<string, unknown>[] | undefined) ?? [];
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

function createUserPartitionKey(userId: EntityId): string {
  return `USER#${userId}`;
}

function createUserSortKey(userId: EntityId): string {
  return `PROFILE#${userId}`;
}

function createYearclockPartitionKey(yearclockId: EntityId): string {
  return `YEARCLOCK#${yearclockId}`;
}

function createYearclockSortKey(yearclockId: EntityId): string {
  return `YEARCLOCK#${yearclockId}`;
}

function createMembershipSortKey(userId: EntityId): string {
  return `MEMBERSHIP#${userId}`;
}

function createMembershipUserPartitionKey(userId: EntityId): string {
  return `USER#${userId}`;
}

function createMembershipUserSortKey(yearclockId: EntityId): string {
  return `YEARCLOCK#${yearclockId}`;
}

function createCategorySortKey(categoryId: EntityId): string {
  return `CATEGORY#${categoryId}`;
}

function createTaskSortKey(taskId: EntityId): string {
  return `TASK#${taskId}`;
}

function createTaskCompletionPartitionKey(
  yearclockId: EntityId,
  year: number,
  month: number,
): string {
  return `YEARCLOCK#${yearclockId}#Y#${year}#M#${month}`;
}

function createTaskCompletionSortKey(taskId: EntityId): string {
  return `TASK#${taskId}`;
}

function createUserKey(userId: EntityId): { pk: string; sk: string } {
  return {
    pk: createUserPartitionKey(userId),
    sk: createUserSortKey(userId),
  };
}

function createYearclockKey(yearclockId: EntityId): { pk: string; sk: string } {
  return {
    pk: createYearclockPartitionKey(yearclockId),
    sk: createYearclockSortKey(yearclockId),
  };
}

function createMembershipKey(
  yearclockId: EntityId,
  userId: EntityId,
): { pk: string; sk: string } {
  return {
    pk: createYearclockPartitionKey(yearclockId),
    sk: createMembershipSortKey(userId),
  };
}

function toUser(record: Record<string, unknown>): User {
  return {
    id: String(record.id),
    email: String(record.email),
    name: String(record.name),
    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : undefined,
  };
}

function toYearclock(record: Record<string, unknown>): Yearclock {
  return {
    id: String(record.id),
    name: String(record.name),
    ownerUserId: String(record.ownerUserId),
    createdAt: String(record.createdAt),
  };
}

function toMembership(record: Record<string, unknown>): Membership {
  return {
    userId: String(record.userId),
    yearclockId: String(record.yearclockId),
    role:
      record.role === "owner" || record.role === "member"
        ? record.role
        : undefined,
    joinedAt: String(record.joinedAt),
  };
}

function toCategory(record: Record<string, unknown>): Category {
  return {
    id: String(record.id),
    yearclockId: String(record.yearclockId),
    name: String(record.name),
    color: String(record.color),
    icon: typeof record.icon === "string" ? record.icon : undefined,
    order: Number(record.order),
    archived: Boolean(record.archived),
  };
}

function toTask(record: Record<string, unknown>): Task {
  const recurrenceRecord = record.recurrence as
    | {
        type?: unknown;
        months?: unknown;
      }
    | undefined;

  return {
    id: String(record.id),
    yearclockId: String(record.yearclockId),
    categoryId: String(record.categoryId),
    title: String(record.title),
    description:
      typeof record.description === "string" ? record.description : undefined,
    recurrence: {
      type:
        recurrenceRecord?.type === "monthly" ? "monthly" : "yearly",
      months: Array.isArray(recurrenceRecord?.months)
        ? recurrenceRecord?.months.map((month) => Number(month))
        : undefined,
    },
    order: Number(record.order),
    createdAt: String(record.createdAt),
    createdBy: String(record.createdBy),
    status: record.status === "disabled" ? "disabled" : "active",
  };
}

function toTaskCompletion(record: Record<string, unknown>): TaskCompletion {
  return {
    id: String(record.id),
    taskId: String(record.taskId),
    yearclockId: String(record.yearclockId),
    year: Number(record.year),
    month: Number(record.month),
    completedAt: String(record.completedAt),
    completedBy: String(record.completedBy),
    note: typeof record.note === "string" ? record.note : undefined,
  };
}
