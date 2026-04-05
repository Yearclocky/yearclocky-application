import {
  ApiGatewayEvent,
  ApiResponse,
  HttpError,
  getMethod,
  getPathSegments,
  getQueryParams,
  handleError,
  normalizePath,
  ok,
} from "./api.js";
import { categories } from "./routes/categories.js";
import { memberships } from "./routes/memberships.js";
import { taskCompletions } from "./routes/taskCompletions.js";
import { tasks } from "./routes/tasks.js";
import { users } from "./routes/users.js";
import { yearclocks } from "./routes/yearclocks.js";

export async function handler(event: ApiGatewayEvent): Promise<ApiResponse> {
  try {
    const method = getMethod(event);
    const path = normalizePath(event.rawPath);
    const segments = getPathSegments(path);
    const query = getQueryParams(event);

    if (segments.length === 0) {
      return ok({
        service: "yearclocky-api",
        functionName: "api-handler",
        routes: [
          "/categories",
          "/memberships",
          "/task-completions",
          "/tasks",
          "/yearclocks",
          "/users",
        ],
      });
    }

    const resource = segments[0];

    switch (resource) {
      case "categories":
        return await categories(method, segments, event.body);
      case "memberships":
        return await memberships(method, segments, event.body);
      case "task-completions":
        return await taskCompletions(method, segments, event.body);
      case "tasks":
        return await tasks(method, segments, query, event.body);
      case "yearclocks":
        return await yearclocks(method, segments, event.body);
      case "users":
        return await users(method, segments, event.body);
      default:
        throw new HttpError(404, "NOT_FOUND", `Route ${path} was not found.`);
    }
  } catch (error) {
    return handleError(error);
  }
}
