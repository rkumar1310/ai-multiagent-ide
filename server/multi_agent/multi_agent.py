import asyncio
import os
import uuid

from autogen_core import SingleThreadedAgentRuntime
from autogen_core import TopicId
from autogen_core import (
    TypeSubscription,
)
from autogen_ext.models.openai import OpenAIChatCompletionClient

from multi_agent.agents.nextjs_programming_agent import NextJSProgrammingAgent
from multi_agent.group_chat_manager import GroupChatManager
from multi_agent.messages import GroupChatMessage, TaskMessage
from autogen_core.models import UserMessage, AssistantMessage
from autogen_core.tool_agent import ToolAgent, tool_agent_caller_loop
from autogen_core.tools import FunctionTool, Tool, ToolSchema


worker_1_topic_type = "worker_1"
worker_2_topic_type = "worker_2"
group_chat_topic_type = "group_chat"
worker_description = "Worker agent for writing nextjs code."


class MultiAgent:
    def add_listener(self, listener):
        self.message_listeners.append(listener)

    def remove_listener(self, listener):
        self.message_listeners.remove(listener)

    async def on_message_output(self, message, ctx):
        for listener in self.message_listeners:
            await listener(message, ctx)

    async def on_transcription(self, transcription):
        for listener in self.transcription_listeners:
            await listener(transcription)

    async def assign_tasks(
        self,
        description: str,
        file_names: list[str],
        task_id: str,
        parent_task_id: str | None = None,
    ):
        print(
            f"\n\n\n\nAssigning task: {description} to {file_names} with task_id: {task_id} and parent_task_id: {parent_task_id}\n\n\n\n"
        )
        # dispatch the TaskMessage so the manager can handle whatever is needed
        await self.runtime.publish_message(
            TaskMessage(
                description=description,
                file_names=file_names,
            ),
            TopicId(type=group_chat_topic_type, source=self.session_id),
        )
        return "Task assigned successfully."

    async def initialize(self, queue, **kwargs):
        print(kwargs)
        self.session_id = str(uuid.uuid4())
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            api_key = kwargs.get("openai_key")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set.")
        self.runtime = SingleThreadedAgentRuntime()
        worker_1_agent_type = await NextJSProgrammingAgent.register(
            self.runtime,
            worker_1_topic_type,  # Using topic type as the agent type.
            lambda: NextJSProgrammingAgent(
                description=worker_description,
                group_chat_topic_type=group_chat_topic_type,
                model_client=OpenAIChatCompletionClient(
                    model="gpt-4o",
                    api_key=api_key,
                ),
            ),
        )
        await self.runtime.add_subscription(
            TypeSubscription(
                topic_type=worker_1_topic_type, agent_type=worker_1_agent_type.type
            )
        )
        await self.runtime.add_subscription(
            TypeSubscription(
                topic_type=group_chat_topic_type, agent_type=worker_1_agent_type.type
            )
        )

        worker_2_agent_type = await NextJSProgrammingAgent.register(
            self.runtime,
            worker_2_topic_type,  # Using topic type as the agent type.
            lambda: NextJSProgrammingAgent(
                description=worker_description,
                group_chat_topic_type=group_chat_topic_type,
                model_client=OpenAIChatCompletionClient(
                    model="gpt-4o",
                    api_key=api_key,
                ),
            ),
        )
        await self.runtime.add_subscription(
            TypeSubscription(
                topic_type=worker_2_topic_type, agent_type=worker_2_agent_type.type
            )
        )
        await self.runtime.add_subscription(
            TypeSubscription(
                topic_type=group_chat_topic_type, agent_type=worker_2_agent_type.type
            )
        )

        tools = [
            FunctionTool(
                self.assign_tasks,
                description="Assign a task to a NextJS expert based on the user's message and project structure. You need to provide a detailed description of the task, what needs to be done, and the expected outcome. Make sure that two different tasks do not modify the same file. Come up with some basic task id, to keep track of dependency. If one task depends on another, then mention the task_parent_id.",
            )
        ]

        await ToolAgent.register(
            self.runtime,
            "tool_executor_agent",
            lambda: ToolAgent("tool executor agent", tools),
        )

        group_chat_manager_type = await GroupChatManager.register(
            self.runtime,
            "group_chat_manager",
            lambda: GroupChatManager(
                model_client=OpenAIChatCompletionClient(
                    model="gpt-4o",
                    api_key=api_key,
                ),
                tool_schema=[tool.schema for tool in tools],
                worker_topic_types=[worker_1_topic_type, worker_2_topic_type],
                worker_descriptions=[worker_description, worker_description],
                queue=queue,
            ),
        )
        await self.runtime.add_subscription(
            TypeSubscription(
                topic_type=group_chat_topic_type,
                agent_type=group_chat_manager_type.type,
            )
        )

    async def start(self, message: UserMessage):
        print("Starting the runtime")
        self.runtime.start()
        print("publishing message")
        print(GroupChatMessage(body=message))
        await self.runtime.publish_message(
            GroupChatMessage(body=message),
            TopicId(type=group_chat_topic_type, source=self.session_id),
        )

        await self.runtime.stop_when_idle()
        print("Runtime stopped")

    async def stop(self):
        await self.runtime.stop()
