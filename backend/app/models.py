"""Pydantic models for request/response shapes."""

from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high", "urgent"]

VALID_COLOR_LABELS = {"red", "orange", "yellow", "green", "blue", "purple", "pink", "teal"}


class CardOut(BaseModel):
    id: str
    column_id: str
    title: str
    details: str | None
    position: int
    due_date: str | None = None
    priority: Priority | None = None
    color_label: str | None = None
    created_at: str
    updated_at: str


class ColumnOut(BaseModel):
    id: str
    board_id: str
    title: str
    position: int
    created_at: str
    cards: list[CardOut] = []


class BoardOut(BaseModel):
    id: str
    name: str
    columns: list[ColumnOut] = []


class BoardSummary(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str


class LoginIn(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class LoginOut(BaseModel):
    token: str


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=200)


class CreateBoardIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class RenameBoardIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CreateColumnIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ReorderColumnsIn(BaseModel):
    column_ids: list[str] = Field(min_length=1, max_length=50)


class RenameColumnIn(BaseModel):
    title: str = Field(max_length=200)


class CreateCardIn(BaseModel):
    title: str = Field(max_length=200)
    details: str | None = Field(default=None, max_length=10000)
    due_date: str | None = None
    priority: Priority | None = None
    color_label: str | None = None


class UpdateCardIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    details: str | None = Field(default=None, max_length=10000)
    due_date: str | None = None
    priority: Priority | None = None
    color_label: str | None = None


class MoveCardIn(BaseModel):
    column_id: str
    position: int


class ChatMessageIn(BaseModel):
    role: str = Field(max_length=20)
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    messages: list[ChatMessageIn] = Field(max_length=50)
    board_id: str


class KanbanOperation(BaseModel):
    action: Literal[
        "rename_column",
        "create_card",
        "update_card",
        "delete_card",
        "move_card",
    ]
    column_id: str | None = None
    card_id: str | None = None
    title: str | None = None
    details: str | None = None
    position: int | None = None


class KanbanUpdate(BaseModel):
    operations: list[KanbanOperation] = []


class ChatOut(BaseModel):
    reply: str
    kanban_update: KanbanUpdate | None = None
