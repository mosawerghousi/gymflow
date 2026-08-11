import { csvExportSchema } from "@/application/dto/report.dto";
import { requireActor } from "@/composition/auth";
import { useCases } from "@/composition/use-cases";
import { fileResponse, parseQuery, route } from "@/presentation/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const actor = await requireActor();
  const input = parseQuery(request, csvExportSchema);
  const file = await useCases.exportCsv(actor, input);

  return fileResponse(file.content, file.filename, "text/csv; charset=utf-8");
});
