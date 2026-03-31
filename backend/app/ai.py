import os
import json

from openai import APITimeoutError, OpenAI

from app.models import ChatOut

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-oss-120b"


SYSTEM_PROMPT = """
You are a project management assistant for a Kanban board.
You MUST return strict JSON with this exact shape:
{
    "reply": "string",
    "kanban_update": null | {
        "operations": [
            {
                "action": "rename_column" | "create_card" | "update_card" | "delete_card" | "move_card",
                "column_id": "string|null",
                "card_id": "string|null",
                "title": "string|null",
                "details": "string|null",
                "position": "number|null"
            }
        ]
    }
}

Only include operations that are clearly requested.
If no board change is needed, set kanban_update to null.
Do not include any text outside JSON.
""".strip()


def get_client() -> OpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable not set")
    return OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)


def _extract_json(text: str) -> dict:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        candidate = candidate.replace("json", "", 1).strip()
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"AI response was not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("AI response JSON must be an object")
    return parsed


def chat(board: dict, messages: list[dict]) -> dict:
    """Send board + conversation and return structured AI output."""
    client = get_client()
    payload = {
        "board": board,
        "conversation": messages,
    }
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=True),
                },
            ],
            timeout=30,
        )
    except APITimeoutError as exc:
        raise RuntimeError("AI request timed out") from exc
    content = response.choices[0].message.content or "{}"
    parsed = _extract_json(content)
    validated = ChatOut.model_validate(parsed)
    return validated.model_dump()
