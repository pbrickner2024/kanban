"""Pydantic models for request/response shapes."""

from typing import Literal

from pydantic import BaseModel, Field


class CardOut(BaseModel):
    id: str
    column_id: str
    title: str
    details: str | None
    position: int
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


class LoginIn(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class LoginOut(BaseModel):
    token: str


class RenameColumnIn(BaseModel):
    title: str = Field(max_length=200)


class CreateCardIn(BaseModel):
    title: str = Field(max_length=200)
    details: str | None = Field(default=None, max_length=10000)


class UpdateCardIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    details: str | None = Field(default=None, max_length=10000)


class MoveCardIn(BaseModel):
    column_id: str
    position: int


class ChatMessageIn(BaseModel):
    role: str = Field(max_length=20)
    content: str = Field(max_length=4000)


class ChatIn(BaseModel):
    messages: list[ChatMessageIn] = Field(max_length=50)


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
