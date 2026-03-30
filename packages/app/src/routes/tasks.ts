import {
  ApiResponse,
  HttpMethod,
  Task,
  TaskStatus,
  createId,
  created,
  deleteTaskRecord,
  methodNotAllowed,
  noContent,
  nowIso,
  listTasks,
  ok,
  parseJsonBody,
  putTask,
  requireTask,
  requireUser,
  requireYearclock,
  validateOptionalDate,
  validateRequiredString,
  validateTaskStatus,
} from "../api.js";

type CreateTaskInput = {
  title: string;
  status?: TaskStatus;
  dueDate?: string | null;
  userId: string;
  yearclockId: string;
};

type UpdateTaskInput = {
  title?: string;
  status?: TaskStatus;
  dueDate?: string | null;
  userId?: string;
  yearclockId?: string;
};

export async function tasks(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listTasks() });
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

async function createTask(input: CreateTaskInput): Promise<Task> {
  validateRequiredString(input.title, "title");
  const status = validateTaskStatus(input.status ?? "todo");
  const dueDate = validateOptionalDate(input.dueDate, "dueDate");
  await requireUser(validateRequiredString(input.userId, "userId"));
  await requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));

  const task: Task = {
    id: createId("tsk"),
    title: input.title.trim(),
    status,
    dueDate,
    userId: input.userId.trim(),
    yearclockId: input.yearclockId.trim(),
    createdAt: nowIso(),
  };

  await putTask(task);
  return task;
}

async function updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  const task = await requireTask(taskId);

  if (input.title !== undefined) {
    validateRequiredString(input.title, "title");
    task.title = input.title.trim();
  }

  if (input.status !== undefined) {
    task.status = validateTaskStatus(input.status);
  }

  if (input.dueDate !== undefined) {
    task.dueDate = validateOptionalDate(input.dueDate, "dueDate");
  }

  if (input.userId !== undefined) {
    await requireUser(validateRequiredString(input.userId, "userId"));
    task.userId = input.userId.trim();
  }

  if (input.yearclockId !== undefined) {
    await requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));
    task.yearclockId = input.yearclockId.trim();
  }

  await putTask(task);
  return task;
}

async function deleteTask(taskId: string): Promise<void> {
  await requireTask(taskId);
  await deleteTaskRecord(taskId);
}
