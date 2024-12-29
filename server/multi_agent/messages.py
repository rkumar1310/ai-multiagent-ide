from pydantic import BaseModel
from autogen_core.models import UserMessage, AssistantMessage


class GroupChatMessage(BaseModel):
    body: UserMessage | AssistantMessage


class TaskMessage(BaseModel):
    description: str
    file_names: list[str]


class SingleTaskMessage(BaseModel):
    description: str
    file_name: str
    file_content: str
    full_path: str


class TaskCompletionMessage(BaseModel):
    file_name: str
    file_content: str
    completion: str
