import {
  ApiResponse,
  HttpError,
  HttpMethod,
  Yearclock,
  createId,
  created,
  deleteYearclockRecord,
  listYearclocks,
  methodNotAllowed,
  noContent,
  nowIso,
  ok,
  parseJsonBody,
  putYearclock,
  requireUser,
  requireYearclock,
  validateRequiredString,
  validateYear,
  yearclockHasTasks,
} from "../api.js";

type CreateYearclockInput = {
  title: string;
  year: number;
  ownerId: string;
};

type UpdateYearclockInput = {
  title?: string;
  year?: number;
  ownerId?: string;
};

export async function yearclocks(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listYearclocks() });
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateYearclockInput>(rawBody);
      return created(await createYearclock(payload));
    }
  }

  if (segments.length === 2) {
    const yearclockId = segments[1];

    if (method === "GET") {
      return ok(await requireYearclock(yearclockId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateYearclockInput>(rawBody);
      return ok(await updateYearclock(yearclockId, payload));
    }

    if (method === "DELETE") {
      await deleteYearclock(yearclockId);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/yearclocks");
}

async function createYearclock(input: CreateYearclockInput): Promise<Yearclock> {
  validateRequiredString(input.title, "title");
  validateYear(input.year, "year");
  await requireUser(validateRequiredString(input.ownerId, "ownerId"));

  const yearclock: Yearclock = {
    id: createId("ycl"),
    title: input.title.trim(),
    year: input.year,
    ownerId: input.ownerId.trim(),
    createdAt: nowIso(),
  };

  await putYearclock(yearclock);
  return yearclock;
}

async function updateYearclock(
  yearclockId: string,
  input: UpdateYearclockInput,
): Promise<Yearclock> {
  const yearclock = await requireYearclock(yearclockId);

  if (input.title !== undefined) {
    validateRequiredString(input.title, "title");
    yearclock.title = input.title.trim();
  }

  if (input.year !== undefined) {
    validateYear(input.year, "year");
    yearclock.year = input.year;
  }

  if (input.ownerId !== undefined) {
    await requireUser(validateRequiredString(input.ownerId, "ownerId"));
    yearclock.ownerId = input.ownerId.trim();
  }

  await putYearclock(yearclock);
  return yearclock;
}

async function deleteYearclock(yearclockId: string): Promise<void> {
  await requireYearclock(yearclockId);

  const hasTasks = await yearclockHasTasks(yearclockId);
  if (hasTasks) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_TASKS",
      "Delete the yearclock's tasks before deleting the yearclock.",
    );
  }

  await deleteYearclockRecord(yearclockId);
}
