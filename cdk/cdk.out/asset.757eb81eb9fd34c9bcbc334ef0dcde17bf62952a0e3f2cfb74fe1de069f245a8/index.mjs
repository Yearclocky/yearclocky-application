// packages/app/src/index.ts
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
var users = /* @__PURE__ */ new Map();
var yearclocks = /* @__PURE__ */ new Map();
var tasks = /* @__PURE__ */ new Map();
seedData();
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
        return routeTasks(method, segments, event.body);
      case "yearclocks":
        return routeYearclocks(method, segments, event.body);
      case "users":
        return routeUsers(method, segments, event.body);
      default:
        throw new HttpError(404, "NOT_FOUND", `Route ${path} was not found.`);
    }
  } catch (error) {
    return handleError(error);
  }
}
function routeTasks(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: [...tasks.values()] });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      const task = createTask(payload);
      return created(task);
    }
  }
  if (segments.length === 2) {
    const taskId = segments[1];
    if (method === "GET") {
      return ok(requireTask(taskId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      const task = updateTask(taskId, payload);
      return ok(task);
    }
    if (method === "DELETE") {
      deleteTask(taskId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/tasks");
}
function routeYearclocks(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: [...yearclocks.values()] });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      const yearclock = createYearclock(payload);
      return created(yearclock);
    }
  }
  if (segments.length === 2) {
    const yearclockId = segments[1];
    if (method === "GET") {
      return ok(requireYearclock(yearclockId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      const yearclock = updateYearclock(yearclockId, payload);
      return ok(yearclock);
    }
    if (method === "DELETE") {
      deleteYearclock(yearclockId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/yearclocks");
}
function routeUsers(method, segments, rawBody) {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: [...users.values()] });
    }
    if (method === "POST") {
      const payload = parseJsonBody(rawBody);
      const user = createUser(payload);
      return created(user);
    }
  }
  if (segments.length === 2) {
    const userId = segments[1];
    if (method === "GET") {
      return ok(requireUser(userId));
    }
    if (method === "PATCH") {
      const payload = parseJsonBody(rawBody);
      const user = updateUser(userId, payload);
      return ok(user);
    }
    if (method === "DELETE") {
      deleteUser(userId);
      return noContent();
    }
  }
  throw methodNotAllowed(method, "/users");
}
function createUser(input) {
  validateRequiredString(input.email, "email");
  validateRequiredString(input.displayName, "displayName");
  validateEmail(input.email);
  const user = {
    id: createId("usr"),
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    createdAt: nowIso()
  };
  users.set(user.id, user);
  return user;
}
function updateUser(userId, input) {
  const user = requireUser(userId);
  if (input.email !== void 0) {
    validateRequiredString(input.email, "email");
    validateEmail(input.email);
    user.email = input.email.trim().toLowerCase();
  }
  if (input.displayName !== void 0) {
    validateRequiredString(input.displayName, "displayName");
    user.displayName = input.displayName.trim();
  }
  users.set(user.id, user);
  return user;
}
function deleteUser(userId) {
  requireUser(userId);
  const hasOwnedYearclocks = [...yearclocks.values()].some(
    (yearclock) => yearclock.ownerId === userId
  );
  if (hasOwnedYearclocks) {
    throw new HttpError(
      409,
      "USER_HAS_YEARCLOCKS",
      "Delete the user's yearclocks before deleting the user."
    );
  }
  const hasTasks = [...tasks.values()].some((task) => task.userId === userId);
  if (hasTasks) {
    throw new HttpError(
      409,
      "USER_HAS_TASKS",
      "Delete the user's tasks before deleting the user."
    );
  }
  users.delete(userId);
}
function createYearclock(input) {
  validateRequiredString(input.title, "title");
  validateYear(input.year, "year");
  requireUser(validateRequiredString(input.ownerId, "ownerId"));
  const yearclock = {
    id: createId("ycl"),
    title: input.title.trim(),
    year: input.year,
    ownerId: input.ownerId.trim(),
    createdAt: nowIso()
  };
  yearclocks.set(yearclock.id, yearclock);
  return yearclock;
}
function updateYearclock(yearclockId, input) {
  const yearclock = requireYearclock(yearclockId);
  if (input.title !== void 0) {
    validateRequiredString(input.title, "title");
    yearclock.title = input.title.trim();
  }
  if (input.year !== void 0) {
    validateYear(input.year, "year");
    yearclock.year = input.year;
  }
  if (input.ownerId !== void 0) {
    requireUser(validateRequiredString(input.ownerId, "ownerId"));
    yearclock.ownerId = input.ownerId.trim();
  }
  yearclocks.set(yearclock.id, yearclock);
  return yearclock;
}
function deleteYearclock(yearclockId) {
  requireYearclock(yearclockId);
  const hasTasks = [...tasks.values()].some(
    (task) => task.yearclockId === yearclockId
  );
  if (hasTasks) {
    throw new HttpError(
      409,
      "YEARCLOCK_HAS_TASKS",
      "Delete the yearclock's tasks before deleting the yearclock."
    );
  }
  yearclocks.delete(yearclockId);
}
function createTask(input) {
  validateRequiredString(input.title, "title");
  const status = validateTaskStatus(input.status ?? "todo");
  const dueDate = validateOptionalDate(input.dueDate, "dueDate");
  requireUser(validateRequiredString(input.userId, "userId"));
  requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));
  const task = {
    id: createId("tsk"),
    title: input.title.trim(),
    status,
    dueDate,
    userId: input.userId.trim(),
    yearclockId: input.yearclockId.trim(),
    createdAt: nowIso()
  };
  tasks.set(task.id, task);
  return task;
}
function updateTask(taskId, input) {
  const task = requireTask(taskId);
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
    requireUser(validateRequiredString(input.userId, "userId"));
    task.userId = input.userId.trim();
  }
  if (input.yearclockId !== void 0) {
    requireYearclock(validateRequiredString(input.yearclockId, "yearclockId"));
    task.yearclockId = input.yearclockId.trim();
  }
  tasks.set(task.id, task);
  return task;
}
function deleteTask(taskId) {
  requireTask(taskId);
  tasks.delete(taskId);
}
function requireUser(userId) {
  const user = users.get(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", `User ${userId} was not found.`);
  }
  return user;
}
function requireYearclock(yearclockId) {
  const yearclock = yearclocks.get(yearclockId);
  if (!yearclock) {
    throw new HttpError(
      404,
      "YEARCLOCK_NOT_FOUND",
      `Yearclock ${yearclockId} was not found.`
    );
  }
  return yearclock;
}
function requireTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) {
    throw new HttpError(404, "TASK_NOT_FOUND", `Task ${taskId} was not found.`);
  }
  return task;
}
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
function seedData() {
  const createdAt = nowIso();
  const seededUser = {
    id: "usr_demo",
    email: "demo@yearclocky.app",
    displayName: "Demo User",
    createdAt
  };
  users.set(seededUser.id, seededUser);
  const seededYearclock = {
    id: "ycl_demo",
    title: "2026 Goals",
    year: 2026,
    ownerId: seededUser.id,
    createdAt
  };
  yearclocks.set(seededYearclock.id, seededYearclock);
  const seededTask = {
    id: "tsk_demo",
    title: "Launch api-handler",
    status: "in_progress",
    dueDate: "2026-04-15",
    userId: seededUser.id,
    yearclockId: seededYearclock.id,
    createdAt
  };
  tasks.set(seededTask.id, seededTask);
}
export {
  handler
};
