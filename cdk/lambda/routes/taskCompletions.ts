import {
  ApiResponse,
  HttpMethod,
  TaskCompletion,
  createId,
  created,
  deleteTaskCompletionRecord,
  listTaskCompletions,
  methodNotAllowed,
  noContent,
  nowIso,
  ok,
  parseJsonBody,
  putTaskCompletion,
  requireNoCompletionForTaskPeriod,
  requireTask,
  requireTaskCompletion,
  requireUser,
  validateMonth,
  validateRequiredString,
  validateYear,
} from "../api.js";

type CreateTaskCompletionInput = {
  taskId: string;
  yearclockId: string;
  year: number;
  month: number;
  completedBy: string;
  completedAt?: string;
  note?: string;
};

type UpdateTaskCompletionInput = {
  completedBy?: string;
  completedAt?: string;
  note?: string | null;
};

export async function taskCompletions(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listTaskCompletions() });
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateTaskCompletionInput>(rawBody);
      return created(await createTaskCompletion(payload));
    }
  }

  if (segments.length === 2) {
    const completionId = segments[1];

    if (method === "GET") {
      return ok(await requireTaskCompletion(completionId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateTaskCompletionInput>(rawBody);
      return ok(await updateTaskCompletion(completionId, payload));
    }

    if (method === "DELETE") {
      const completion = await requireTaskCompletion(completionId);
      await deleteTaskCompletionRecord(completion);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/task-completions");
}

async function createTaskCompletion(
  input: CreateTaskCompletionInput,
): Promise<TaskCompletion> {
  const taskId = validateRequiredString(input.taskId, "taskId");
  const yearclockId = validateRequiredString(input.yearclockId, "yearclockId");
  const completedBy = validateRequiredString(input.completedBy, "completedBy");
  validateYear(input.year, "year");
  validateMonth(input.month, "month");
  await requireTask(taskId);
  await requireUser(completedBy);
  await requireNoCompletionForTaskPeriod(yearclockId, taskId, input.year, input.month);

  const completion: TaskCompletion = {
    id: createId("cmp"),
    taskId,
    yearclockId,
    year: input.year,
    month: input.month,
    completedAt: input.completedAt?.trim() || nowIso(),
    completedBy,
    note: input.note?.trim() || undefined,
  };

  await putTaskCompletion(completion);
  return completion;
}

async function updateTaskCompletion(
  completionId: string,
  input: UpdateTaskCompletionInput,
): Promise<TaskCompletion> {
  const completion = await requireTaskCompletion(completionId);

  if (input.completedBy !== undefined) {
    const completedBy = validateRequiredString(input.completedBy, "completedBy");
    await requireUser(completedBy);
    completion.completedBy = completedBy;
  }

  if (input.completedAt !== undefined) {
    completion.completedAt = validateRequiredString(input.completedAt, "completedAt");
  }

  if (input.note !== undefined) {
    completion.note = input.note?.trim() || undefined;
  }

  await putTaskCompletion(completion);
  return completion;
}
