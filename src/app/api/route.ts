import { type NextRequest, NextResponse } from "next/server";
import {
  loadPackageDefinition,
  credentials,
  ServiceClientConstructor,
} from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";

const PROTO_PATH = process.cwd() + "/src/app/api/agents.proto";
console.log(process.cwd());
const packageDefinition = loadSync(PROTO_PATH, {});
const proto = loadPackageDefinition(packageDefinition)
  .AgentService as ServiceClientConstructor;
const client = new proto("localhost:50051", credentials.createInsecure());

export async function POST(request: NextRequest) {
  const json = await request.json();

  const stream = new ReadableStream({
    start(controller) {
      const call = client.ProcessChatMessage({ message: json.message });

      call.on("data", (response: { status: string; filename: string }) => {
        const chunk = new TextEncoder().encode(
          `data: ${JSON.stringify(response)}\n\n`
        );
        controller.enqueue(chunk);
      });

      call.on("end", () => {
          controller.close();
      });

      call.on("error", (err: Error) => {
        controller.error(err);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
