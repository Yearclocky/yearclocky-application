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
  userHasTasks,
  userHasYearclocks,
  validateEmail,
  validateRequiredString,
} from "../api.js";

type CreateUserInput = {
  email: string;
  displayName: string;
};

type UpdateUserInput = {
  email?: string;
  displayName?: string;
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
  validateRequiredString(input.displayName, "displayName");
  validateEmail(input.email);

  const user: User = {
    id: createId("usr"),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
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

  if (input.displayName !== undefined) {
    validateRequiredString(input.displayName, "displayName");
    user.displayName = input.displayName.trim();
  }

  await putUser(user);
  return user;
}

async function deleteUser(userId: string): Promise<void> {
  await requireUser(userId);

  const hasOwnedYearclocks = await userHasYearclocks(userId);
  if (hasOwnedYearclocks) {
    throw new HttpError(
      409,
      "USER_HAS_YEARCLOCKS",
      "Delete the user's yearclocks before deleting the user.",
    );
  }

  const hasTasks = await userHasTasks(userId);
  if (hasTasks) {
    throw new HttpError(
      409,
      "USER_HAS_TASKS",
      "Delete the user's tasks before deleting the user.",
    );
  }

  await deleteUserRecord(userId);
}
