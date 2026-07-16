import type { NextRequest } from "next/server";

export function requestIp(request: NextRequest) { return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
export async function requestData(request: NextRequest): Promise<Record<string, unknown>> { const type = request.headers.get("content-type") || ""; if (type.includes("application/json")) return await request.json() as Record<string, unknown>; const data = await request.formData(); return Object.fromEntries(data.entries()); }
