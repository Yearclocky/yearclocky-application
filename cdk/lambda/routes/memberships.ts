import {
  ApiResponse,
  HttpMethod,
  Membership,
  created,
  deleteMembershipRecord,
  listMemberships,
  methodNotAllowed,
  noContent,
  nowIso,
  ok,
  parseJsonBody,
  putMembership,
  requireMembership,
  requireUser,
  requireYearclock,
  validateRole,
  validateRequiredString,
} from "../api.js";

type CreateMembershipInput = {
  userId: string;
  yearclockId: string;
  role?: Membership["role"];
};

type UpdateMembershipInput = {
  role?: Membership["role"];
};

export async function memberships(
  method: HttpMethod,
  segments: string[],
  rawBody?: string | null,
): Promise<ApiResponse> {
  if (segments.length === 1) {
    if (method === "GET") {
      return ok({ items: await listMemberships() });
    }

    if (method === "POST") {
      const payload = parseJsonBody<CreateMembershipInput>(rawBody);
      return created(await createMembership(payload));
    }
  }

  if (segments.length === 3) {
    const yearclockId = segments[1];
    const userId = segments[2];

    if (method === "GET") {
      return ok(await requireMembership(yearclockId, userId));
    }

    if (method === "PATCH") {
      const payload = parseJsonBody<UpdateMembershipInput>(rawBody);
      return ok(await updateMembership(yearclockId, userId, payload));
    }

    if (method === "DELETE") {
      await requireMembership(yearclockId, userId);
      await deleteMembershipRecord(yearclockId, userId);
      return noContent();
    }
  }

  throw methodNotAllowed(method, "/memberships");
}

async function createMembership(
  input: CreateMembershipInput,
): Promise<Membership> {
  const userId = validateRequiredString(input.userId, "userId");
  const yearclockId = validateRequiredString(input.yearclockId, "yearclockId");
  await requireUser(userId);
  await requireYearclock(yearclockId);

  const membership: Membership = {
    userId,
    yearclockId,
    role: input.role ? validateRole(input.role) : "member",
    joinedAt: nowIso(),
  };

  await putMembership(membership);
  return membership;
}

async function updateMembership(
  yearclockId: string,
  userId: string,
  input: UpdateMembershipInput,
): Promise<Membership> {
  const membership = await requireMembership(yearclockId, userId);

  if (input.role !== undefined) {
    membership.role = validateRole(input.role);
  }

  await putMembership(membership);
  return membership;
}
