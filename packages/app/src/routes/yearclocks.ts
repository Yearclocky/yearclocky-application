import {
  ApiResponse,
  HttpError,
  HttpMethod,
  Membership,
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
  putMembership,
  putYearclock,
  requireUser,
  requireYearclock,
  validateRequiredString,
  yearclockHasCategories,
  yearclockHasMemberships,
  yearclockHasTaskCompletions,
  yearclockHasTasks,
} from "../api.js";

type CreateYearclockInput = {
  name: string;
  ownerUserId: string;
};

type UpdateYearclockInput = {
  name?: string;
  ownerUserId?: string;
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
  validateRequiredString(input.name, "name");
  const ownerUserId = validateRequiredString(input.ownerUserId, "ownerUserId");
  await requireUser(ownerUserId);

  const yearclock: Yearclock = {
    id: createId("ycl"),
    name: input.name.trim(),
    ownerUserId,
    createdAt: nowIso(),
  };

  await putYearclock(yearclock);

  const membership: Membership = {
    userId: ownerUserId,
    yearclockId: yearclock.id,
    role: "owner",
    joinedAt: yearclock.createdAt,
  };

  await putMembership(membership);
  return yearclock;
}

async function updateYearclock(
  yearclockId: string,
  input: UpdateYearclockInput,
): Promise<Yearclock> {
  const yearclock = await requireYearclock(yearclockId);

  if (input.name !== undefined) {
    validateRequiredString(input.name, "name");
    yearclock.name = input.name.trim();
  }

  if (input.ownerUserId !== undefined) {
    const ownerUserId = validateRequiredString(input.ownerUserId, "ownerUserId");
    await requireUser(ownerUserId);
    yearclock.ownerUserId = ownerUserId;
  }

  await putYearclock(yearclock);
  return yearclock;
}

async function deleteYearclock(yearclockId: string): Promise<void> {
  await requireYearclock(yearclockId);

  if (await yearclockHasTasks(yearclockId)) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_TASKS",
      "Delete the yearclock's tasks before deleting the yearclock.",
    );
  }

  if (await yearclockHasCategories(yearclockId)) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_CATEGORIES",
      "Delete the yearclock's categories before deleting the yearclock.",
    );
  }

  if (await yearclockHasMemberships(yearclockId)) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_MEMBERSHIPS",
      "Delete the yearclock's memberships before deleting the yearclock.",
    );
  }

  if (await yearclockHasTaskCompletions(yearclockId)) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_TASK_COMPLETIONS",
      "Delete the yearclock's task completions before deleting the yearclock.",
    );
  }

  await deleteYearclockRecord(yearclockId);
}
