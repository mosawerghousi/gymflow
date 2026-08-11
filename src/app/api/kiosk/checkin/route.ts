import { kioskCheckInSchema } from "@/application/dto/checkin.dto";
import { useCases } from "@/composition/use-cases";
import { created, parseBody, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

/**
 * The only unauthenticated write in the app.
 *
 * There is no user session at a kiosk — the device proves itself with the
 * `x-kiosk-token` header, and this path can do nothing but create a check-in.
 */
export const POST = route(async (request: Request) => {
  const deviceToken = request.headers.get("x-kiosk-token") ?? "";
  const input = await parseBody(request, kioskCheckInSchema);

  return created(await useCases.kioskCheckIn(deviceToken, input));
});
