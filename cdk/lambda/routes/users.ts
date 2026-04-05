import {
  ApiResponse,
  HttpError,
  HttpMethod,
  User,
  createId,
  created,
  deleteUserRecord,
  listUsers,
  methodNotAllowed,
  noContent,
  nowIso,
  ok,
  parseJsonBody,
  putUser,
  requireUser,
  userHasMemberships,
  userHasTaskCompletions,
  userHasTasks,
  userHasYearclocks,
  validateEmail,
  validateRequiredString,
} from "../api.js";

type CreateUserInput = {
  email: string;
  name: string;
};

type UpdateUserInput = {
  email?: string;
  name?: string;
};

export async function users(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listUsers() });
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateUserInput>(rawBody);
      return created(await createUser(payload));
    }
  }

  if (segments.length === 2) {
    const userId = segments[1];

    if (method === "GET") {
      return ok(await requireUser(userId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateUserInput>(rawBody);
      return ok(await updateUser(userId, payload));
    }

    if (method === "DELETE") {
      await deleteUser(userId);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/users");
}

async function createUser(input: CreateUserInput): Promise<User> {
  validateRequiredString(input.email, "email");
  validateRequiredString(input.name, "name");
  validateEmail(input.email);

  const user: User = {
    id: createId("usr"),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    createdAt: nowIso(),
  };

  await putUser(user);
  return user;
}

async function updateUser(userId: string, input: UpdateUserInput): Promise<User> {
  const user = await requireUser(userId);

  if (input.email !== undefined) {
    validateRequiredString(input.email, "email");
    validateEmail(input.email);
    user.email = input.email.trim().toLowerCase();
  }

  if (input.name !== undefined) {
    validateRequiredString(input.name, "name");
    user.name = input.name.trim();
  }

  await putUser(user);
  return user;
}

async function deleteUser(userId: string): Promise<void> {
  await requireUser(userId);

  if (await userHasYearclocks(userId)) {
    throw new HttpError(
      409,
      "USER_HAS_YEARCLOCKS",
      "Delete the user's yearclocks before deleting the user.",
    );
  }

  if (await userHasMemberships(userId)) {
    throw new HttpError(
      409,
      "USER_HAS_MEMBERSHIPS",
      "Delete the user's memberships before deleting the user.",
    );
  }

  if (await userHasTasks(userId)) {
    throw new HttpError(
      409,
      "USER_HAS_TASKS",
      "Delete the user's tasks before deleting the user.",
    );
  }

  if (await userHasTaskCompletions(userId)) {
    throw new HttpError(
      409,
      "USER_HAS_TASK_COMPLETIONS",
      "Delete the user's task completions before deleting the user.",
    );
  }

  await deleteUserRecord(userId);
}
