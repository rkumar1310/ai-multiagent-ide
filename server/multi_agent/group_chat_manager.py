import asyncio
from asyncio import subprocess
import os
import string
from typing import List

from autogen_core import AgentId, MessageContext
from autogen_core import (
    RoutedAgent,
    message_handler,
)
from autogen_core.models import (
    ChatCompletionClient,
    SystemMessage,
    UserMessage,
    CreateResult,
    LLMMessage,
)
from autogen_core import TopicId

import tiktoken
from autogen_core.tool_agent import ToolAgent, tool_agent_caller_loop
from autogen_core.tools import FunctionTool, Tool, ToolSchema
from multi_agent.messages import (
    GroupChatMessage,
    TaskCompletionMessage,
    TaskMessage,
    SingleTaskMessage,
)
from rich.console import Console
from rich.markdown import Markdown


class GroupChatManager(RoutedAgent):
    tasks: List[TaskMessage] = []
    current_task: TaskMessage | None = None
    current_file_index: int = 0

    def __init__(
        self,
        worker_topic_types: List[str],
        model_client: ChatCompletionClient,
        tool_schema: List[ToolSchema],
        worker_descriptions: List[str],
        chat_stopped: bool = False,
        queue: asyncio.Queue = None,
    ) -> None:
        super().__init__("Group chat manager")
        self._model_client = model_client
        self._worker_topic_types = worker_topic_types
        self._chat_history: List[UserMessage] = []
        self._worker_description = worker_descriptions
        self._previous_participant_topic_type: str | None = None
        self._chat_stopped = chat_stopped
        self._tool_agent_id = AgentId("tool_executor_agent", self.id.key)
        self._tool_schema = tool_schema
        cwd_directory = os.path.dirname(__file__)
        self._project_directory = os.path.join(
            cwd_directory, "../../code-server/workspace"
        )
        self._queue = queue

    @message_handler
    async def handle_message(
        self, message: GroupChatMessage, ctx: MessageContext
    ) -> None:
        if self._chat_stopped:
            Console().print(Markdown(f"### System: \nChat is stopped."))
            return

        print(f"group chat manager received message: {message}")

        # start the task planning process
        print("Starting task planning process")
        await self._queue.put({"status": "planning"})
        project_content = self.list_files_with_content()

        system_message = SystemMessage(
            content="""You are a manager with deep technical insights. Based on the user's message and looking at the project content, you need to assign tasks to NextJS experts. These tasks are executed in parallel so there should be no dependencies between them at all. If there is a dependency combine the tasks. You need to provide a detailed description of the task, what needs to be done, and the expected outcome.
            here is the message from the user: \n\n
            {message} \n\n
            Here is the project content: \n\n
            {project_content} \n\n
            when creating the tasks make sure that each task only modified only one file. If the task modifies multiple files,
            split the task into multiple tasks.
            don't modify package.json or .env files.
            don't install any new packages.
            """.format(
                message=message.body.content, project_content=project_content
            )
        )

        session: List[LLMMessage] = [system_message]

        await tool_agent_caller_loop(
            self,
            tool_agent_id=self._tool_agent_id,
            model_client=self._model_client,
            input_messages=session,
            tool_schema=self._tool_schema,
            cancellation_token=ctx.cancellation_token,
        )

    def list_files_with_content(self):
        print(f"Directory - {self._project_directory}")
        ignore_dirs = ["node_modules", ".git", ".next"]
        ignore_files = ["package-lock.json", ".env"]

        project_content = ""

        for root, dirs, files in os.walk(self._project_directory):
            # Modify the dirs list in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]

            for file in files:
                if file in ignore_files:
                    continue
                filepath = os.path.join(root, file)
                relative_path = os.path.relpath(filepath, self._project_directory)
                project_content += f"Filepath - {relative_path}\n"
                project_content += "Content\n"
                project_content += "---------------------------\n"
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        project_content += content + "\n"
                        print(f"Filepath - {relative_path} - size - {len(content)}")

                except Exception as e:
                    project_content += f"Error reading file: {e} \n"
                project_content += "---------------------------\n"

        print(len(project_content))
        enc = tiktoken.encoding_for_model("gpt-4o")
        print(len(enc.encode(project_content)))

        return project_content

    @message_handler
    async def handle_task_message(
        self, message: TaskMessage, ctx: MessageContext
    ) -> None:
        print(f"Task message received: {message}")
        self.tasks.append(message)

        if self.current_task is None:
            self.current_task = self.tasks.pop(0)
            self.current_file_index = 0
            print(f"Current task: {self.current_task}")
            await self.assign_task_to_worker()
        # time to assign the tasks based on each file

    @message_handler
    async def handle_task_completion_message(
        self, message: TaskCompletionMessage, ctx: MessageContext
    ) -> None:
        self.current_file_index += 1
        if self.current_file_index < len(self.current_task.file_names):
            await self.assign_task_to_worker()
        else:
            if len(self.tasks) > 0:
                self.current_task = self.tasks.pop(0)
                self.current_file_index = 0
                await self.assign_task_to_worker()
            else:
                await self.run_npm_install()
                await self._queue.put({"status": "completed"})
                print("All tasks completed.")
                
    async def run_npm_install(self):
        # cd to the workspace directory and run npm install
        os.chdir(self._project_directory)
        process = await asyncio.create_subprocess_exec(
            'npm', 'install',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            # Handle the error
            print(f"npm install failed: {stderr.decode()}")
        else:
            print("npm install succeeded")
        

    async def assign_task_to_worker(self):
        if self.current_task is None:
            return

        # pick a worker for now the first worker
        worker_topic_type = self._worker_topic_types[0]

        print("Assigning to ", worker_topic_type, self.id.key)
        filename = self.current_task.file_names[self.current_file_index]
        # assign the task to the worker
        await self._queue.put({"status": "writing_code", "filename": filename})
        await self.runtime.publish_message(
            SingleTaskMessage(
                description=self.current_task.description,
                file_name=filename,
                file_content=self.get_file_content(filename),
                full_path=os.path.join(self._project_directory, filename),
            ),
            TopicId(type=worker_topic_type, source=self.id.key),
        )

    def get_file_content(self, file_name: str):
        filepath = os.path.join(self._project_directory, file_name)
        # if file does not exist, return empty string
        if not os.path.exists(filepath):
            return ""
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
