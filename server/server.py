import asyncio
import os

from autogen_core.models import UserMessage
from dotenv import load_dotenv
from grpc.aio import server as aio_server
import logging

import agents_pb2_grpc
import agents_pb2
from multi_agent.multi_agent import MultiAgent

load_dotenv()  # Load environment variables from .env


class AgentService(agents_pb2_grpc.AgentService):
    async def ProcessChatMessage(self, request, context):
        try:
            print("Processing chat message...", request.message)
            queue = asyncio.Queue()
            multi_agent = MultiAgent()
            await multi_agent.initialize(queue=queue)

            async def start_agent():
                await multi_agent.start(
                    UserMessage(content=request.message, source="user")
                )
                await queue.put(None)  # End of stream signal

            async def read_queue():
                while True:
                    update = await queue.get()
                    if update is None:  # End of stream signal
                        break
                    await context.write(
                        agents_pb2.ChatMessageProgress(
                            status=update.get("status", ""),
                            # filename might be there or not
                            filename=update.get("filename", ""),
                        )
                    )
            await asyncio.gather(start_agent(), read_queue())
        except Exception as e:
            logging.error(f"Error processing chat message: {e}")
            context.set_details(str(e))
            raise e


async def serve():
    server = aio_server()
    agents_pb2_grpc.add_AgentServiceServicer_to_server(AgentService(), server)
    server.add_insecure_port("[::]:50051")
    await server.start()
    print("Async gRPC Server running on port grpc://localhost:50051")
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())
