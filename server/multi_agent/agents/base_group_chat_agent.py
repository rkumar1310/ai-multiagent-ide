from typing import List

from autogen_core import MessageContext
from autogen_core import (
    RoutedAgent,
    message_handler,
)
from autogen_core.models import (
    ChatCompletionClient,
    LLMMessage,
    SystemMessage,
    UserMessage,
)
from multi_agent.messages import GroupChatMessage


class BaseGroupChatAgent(RoutedAgent):
    """A group chat participant using an LLM."""

    def __init__(
        self,
        description: str,
        group_chat_topic_type: str,
        model_client: ChatCompletionClient,
        system_message: str,
    ) -> None:
        super().__init__(description=description)
        self._group_chat_topic_type = group_chat_topic_type
        self._model_client = model_client
        self._system_message = SystemMessage(content=system_message)
        self._chat_history: List[LLMMessage] = []

    @message_handler
    async def handle_message(
        self, message: GroupChatMessage, ctx: MessageContext
    ) -> None:
        print(f"group chat agent received message: {message}")

    # @message_handler
    # async def handle_request_to_speak(
    #     self, message: RequestToSpeak, ctx: MessageContext
    # ) -> None:
    #     # print(f"\n{'-'*80}\n{self.id.type}:", flush=True)
    #     print("requesting answer at ", time.time() - self.client.audio_capture_time)
    #     Console().print(Markdown(f"### {self.id.type}: "))
    #     self._chat_history.append(
    #         UserMessage(
    #             content=f"Transferred to {self.id.type}, adopt the persona immediately.",
    #             source="system",
    #         )
    #     )

    #     has_received_first_chunk = False
    #     # async generator
    #     async for item in self._model_client.create_stream(
    #         [self._system_message] + self._chat_history
    #     ):
    #         if isinstance(item, CreateResult):
    #             completion = item
    #         else:
    #             if not has_received_first_chunk:
    #                 has_received_first_chunk = True
    #                 print(
    #                     "received first chunk at ",
    #                     time.time() - self.client.audio_capture_time,
    #                 )

    #     assert isinstance(completion.content, str)
    #     self._chat_history.append(
    #         AssistantMessage(content=completion.content, source=self.id.type)
    #     )
    #     print(
    #         "time taken to get chat answer response",
    #         time.time() - self.client.audio_capture_time,
    #     )
    #     Console().print(Markdown(completion.content))
    #     # print(completion.content, flush=True)
    #     await self.publish_message(
    #         GroupChatMessage(
    #             body=AssistantMessage(content=completion.content, source=self.id.type)
    #         ),
    #         topic_id=DefaultTopicId(type=self._group_chat_topic_type),
    #     )
