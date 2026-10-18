import { publicDataResponse } from "../../../../../lib/public-data.server";

type Context = { params: Promise<{ table: string }> };
export async function GET(request: Request, context: Context) {
  return publicDataResponse(request, (await context.params).table);
}
export const HEAD = GET;
