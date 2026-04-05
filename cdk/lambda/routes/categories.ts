import {
  ApiResponse,
  Category,
  HttpError,
  HttpMethod,
  createId,
  created,
  categoryHasTasks,
  deleteCategoryRecord,
  listCategories,
  methodNotAllowed,
  noContent,
  ok,
  parseJsonBody,
  putCategory,
  requireCategory,
  requireYearclock,
  validateBoolean,
  validateInteger,
  validateOptionalString,
  validateRequiredString,
} from "../api.js";

type CreateCategoryInput = {
  yearclockId: string;
  name: string;
  color: string;
  icon?: string;
  order?: number;
  archived?: boolean;
};

type UpdateCategoryInput = {
  name?: string;
  color?: string;
  icon?: string | null;
  order?: number;
  archived?: boolean;
};

export async function categories(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listCategories() });
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateCategoryInput>(rawBody);
      return created(await createCategory(payload));
    }
  }

  if (segments.length === 2) {
    const categoryId = segments[1];

    if (method === "GET") {
      return ok(await requireCategory(categoryId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateCategoryInput>(rawBody);
      return ok(await updateCategory(categoryId, payload));
    }

    if (method === "DELETE") {
      await deleteCategory(categoryId);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/categories");
}

async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const yearclockId = validateRequiredString(input.yearclockId, "yearclockId");
  validateRequiredString(input.name, "name");
  validateRequiredString(input.color, "color");
  await requireYearclock(yearclockId);

  if (input.order !== undefined) {
    validateInteger(input.order, "order");
  }

  if (input.archived !== undefined) {
    validateBoolean(input.archived, "archived");
  }

  const category: Category = {
    id: createId("cat"),
    yearclockId,
    name: input.name.trim(),
    color: input.color.trim(),
    icon: validateOptionalString(input.icon, "icon"),
    order: input.order ?? 0,
    archived: input.archived ?? false,
  };

  await putCategory(category);
  return category;
}

async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const category = await requireCategory(categoryId);

  if (input.name !== undefined) {
    validateRequiredString(input.name, "name");
    category.name = input.name.trim();
  }

  if (input.color !== undefined) {
    validateRequiredString(input.color, "color");
    category.color = input.color.trim();
  }

  if (input.icon !== undefined) {
    category.icon = input.icon?.trim() || undefined;
  }

  if (input.order !== undefined) {
    validateInteger(input.order, "order");
    category.order = input.order;
  }

  if (input.archived !== undefined) {
    validateBoolean(input.archived, "archived");
    category.archived = input.archived;
  }

  await putCategory(category);
  return category;
}

async function deleteCategory(categoryId: string): Promise<void> {
  const category = await requireCategory(categoryId);

  if (await categoryHasTasks(categoryId)) {
    throw new HttpError(
      409,
      "CATEGORY_HAS_TASKS",
      "Delete the category's tasks before deleting the category.",
    );
  }

  await deleteCategoryRecord(category);
}
