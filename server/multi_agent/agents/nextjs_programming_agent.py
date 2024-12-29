import os
from multi_agent.agents.base_group_chat_agent import BaseGroupChatAgent
from autogen_core import MessageContext

from autogen_core.models import (
    ChatCompletionClient,
    UserMessage,
    AssistantMessage,
    SystemMessage,
    CreateResult,
)
from autogen_core import (
    DefaultTopicId,
    message_handler,
)

from multi_agent.messages import (
    GroupChatMessage,
    SingleTaskMessage,
    TaskCompletionMessage,
)

from rich.console import Console
from rich.markdown import Markdown


class NextJSProgrammingAgent(BaseGroupChatAgent):

    def __init__(
        self,
        description: str,
        group_chat_topic_type: str,
        model_client: ChatCompletionClient,
    ) -> None:
        super().__init__(
            description=description,
            group_chat_topic_type=group_chat_topic_type,
            model_client=model_client,
            system_message="""
            You are a highly skilled Next.js developer highly proficient in writing the functionality fo the nextjs application. You are here to write code to solve a given problem. You will get the request in following format:
            - Request: "Add a button to this login page."
            - Filename: "login.tsx"
            - Current file content: "<the contents of the existing file>" or empty if the file is a new file.
            You can only respond with content that you want inside the given file.
            You can not write to any other file.
            You can not use markdown in your response.
            Only code content is allowed in your response.
            """,
        )

    @message_handler
    async def handle_request_to_code(
        self, message: SingleTaskMessage, ctx: MessageContext
    ) -> None:
        # print(f"\n{'-'*80}\n{self.id.type}:", flush=True)

        print("writing the file {}".format(message.file_name))
        self._chat_history.append(
            UserMessage(
                content=f"""
                Request: {message.description}
                Filename: {message.file_name}
                Current file content: {message.file_content}
                """,
                source="system",
            )
        )
        file_content = ""
        # async generator
        async for item in self._model_client.create_stream(
            [self._system_message] + self._chat_history
        ):
            if isinstance(item, CreateResult):
                completion = item
            else:
                # print(item, flush=True)
                # write to the disk
                file_content += item
                self._write_to_disk(
                    file_name=message.full_path, file_content=file_content
                )

        assert isinstance(completion.content, str)
        Console().print(Markdown(completion.content))
        # print(completion.content, flush=True)
        await self.publish_message(
            TaskCompletionMessage(
                file_name=message.file_name,
                file_content=completion.content,
                completion="code",
            ),
            topic_id=DefaultTopicId(type=self._group_chat_topic_type),
        )

    def _write_to_disk(self, file_name: str, file_content: str):
        # if the file parent directory does not exist, create it
        if not os.path.exists(os.path.dirname(file_name)):
            os.makedirs(os.path.dirname(file_name))

        with open(file_name, "w") as f:
            f.write(file_content)
        print(f"File written to disk: {file_name}")
        return True
