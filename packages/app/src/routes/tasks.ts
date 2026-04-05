import {
  ApiResponse,
  HttpError,
  HttpMethod,
  QueryParams,
  Task,
  TaskStatus,
  buildMonthTaskResponse,
  createId,
  created,
  deleteTaskRecord,
  listTasks,
  methodNotAllowed,
  noContent,
  nowIso,
  ok,
  parseJsonBody,
  putTask,
  requireCategory,
  requireTask,
  requireUser,
  requireYearclock,
  taskHasCompletions,
  validateInteger,
  validateMonth,
  validateRecurrence,
  validateRequiredString,
  validateTaskStatus,
  validateYear,
} from "../api.js";

type CreateTaskInput = {
  yearclockId: string;
  categoryId: string;
  title: string;
  description?: string;
  recurrence: Task["recurrence"];
  order?: number;
  createdBy: string;
  status?: TaskStatus;
};

type UpdateTaskInput = {
  categoryId?: string;
  title?: string;
  description?: string | null;
  recurrence?: Task["recurrence"];
  order?: number;
  status?: TaskStatus;
};

export async function tasks(
  method: HttpMethod,
  segments: string[],
  query: QueryParams,
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok(await getTasksResponse(query));
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateTaskInput>(rawBody);
      return created(await createTask(payload));
    }
  }

  if (segments.length === 2) {
    const taskId = segments[1];

    if (method === "GET") {
      return ok(await requireTask(taskId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateTaskInput>(rawBody);
      return ok(await updateTask(taskId, payload));
    }

    if (method === "DELETE") {
      await deleteTask(taskId);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/tasks");
}

async function getTasksResponse(query: QueryParams) {
  if (query.year && query.month) {
    const year = Number(query.year);
    const month = Number(query.month);
    validateYear(year, "year");
    validateMonth(month, "month");

    return buildMonthTaskResponse({
      yearclockId: query.yearclockId,
      year,
      month,
    });
  }

  return {
    items: await listTasks(query.yearclockId),
  };
}

async function createTask(input: CreateTaskInput): Promise<Task> {
  const yearclockId = validateRequiredString(input.yearclockId, "yearclockId");
  const categoryId = validateRequiredString(input.categoryId, "categoryId");
  const createdBy = validateRequiredString(input.createdBy, "createdBy");
  validateRequiredString(input.title, "title");
  const recurrence = validateRecurrence(input.recurrence);
  const status = validateTaskStatus(input.status ?? "active");

  await requireYearclock(yearclockId);
  const category = await requireCategory(categoryId);
  if (category.yearclockId !== yearclockId) {
    throw new HttpError(
      400,
      "CATEGORY_YEARCLOCK_MISMATCH",
      "categoryId must belong to the provided yearclockId.",
    );
  }
  await requireUser(createdBy);

  if (input.order !== undefined) {
    validateInteger(input.order, "order");
  }

  const task: Task = {
    id: createId("tsk"),
    yearclockId,
    categoryId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    recurrence,
    order: input.order ?? 0,
    createdAt: nowIso(),
    createdBy,
    status,
  };

  await putTask(task);
  return task;
}

async function updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  const task = await requireTask(taskId);

  if (input.categoryId !== undefined) {
    const category = await requireCategory(
      validateRequiredString(input.categoryId, "categoryId"),
    );
    if (category.yearclockId !== task.yearclockId) {
      throw new HttpError(
        400,
        "CATEGORY_YEARCLOCK_MISMATCH",
        "categoryId must belong to the task's yearclock.",
      );
    }
    task.categoryId = category.id;
  }

  if (input.title !== undefined) {
    validateRequiredString(input.title, "title");
    task.title = input.title.trim();
  }

  if (input.description !== undefined) {
    task.description = input.description?.trim() || undefined;
  }

  if (input.recurrence !== undefined) {
    task.recurrence = validateRecurrence(input.recurrence);
  }

  if (input.order !== undefined) {
    validateInteger(input.order, "order");
    task.order = input.order;
  }

  if (input.status !== undefined) {
    task.status = validateTaskStatus(input.status);
  }

  await putTask(task);
  return task;
}

async function deleteTask(taskId: string): Promise<void> {
  const task = await requireTask(taskId);

  if (await taskHasCompletions(taskId)) {
    throw new HttpError(
      409,
      "TASK_HAS_COMPLETIONS",
      "Delete the task's completions before deleting the task.",
    );
  }

  await deleteTaskRecord(task);
}
