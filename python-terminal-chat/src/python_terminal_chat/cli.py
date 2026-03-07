from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

try:
    from twentyfirst_sdk import AgentClient
except ImportError as exc:  # pragma: no cover - user-facing import guard
    raise SystemExit(
        "twentyfirst_sdk is not installed. Install 21st-sdk first, or use the local "
        "package from /Users/daniil/Work/21st/packages/an-sdk/python."
    ) from exc


EXIT_COMMANDS = {"exit", "quit", "/exit", "/quit"}
NEW_THREAD_COMMANDS = {"/new", "/thread"}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def make_message(role: str, text: str) -> Dict[str, Any]:
    return {
        "role": role,
        "parts": [{"type": "text", "text": text}],
    }


def iter_sse_events(response: Any) -> Iterable[Dict[str, Any]]:
    for raw_line in response.iter_lines(decode_unicode=True):
        if not raw_line:
            continue

        line = raw_line.strip()
        if not line or line.startswith(":") or not line.startswith("data: "):
            continue

        payload = line[6:]
        if payload == "[DONE]":
            break

        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue

        if isinstance(event, dict):
            yield event


def stream_assistant_response(response: Any) -> tuple[str, Optional[Dict[str, Any]]]:
    assistant_text_parts: list[str] = []
    metadata: Optional[Dict[str, Any]] = None
    assistant_started = False

    try:
        for event in iter_sse_events(response):
            event_type = event.get("type")

            if event_type == "text-delta":
                if not assistant_started:
                    print("assistant> ", end="", flush=True)
                    assistant_started = True

                delta = event.get("delta") or ""
                assistant_text_parts.append(delta)
                print(delta, end="", flush=True)
                continue

            if event_type == "tool-input-start":
                if assistant_started:
                    print()
                    assistant_started = False
                tool_name = event.get("toolName") or "unknown"
                print(f"[tool] {tool_name}")
                continue

            if event_type == "message-metadata":
                metadata = event.get("messageMetadata")
                continue

            if event_type == "error":
                if assistant_started:
                    print()
                error_text = event.get("errorText") or event.get("error") or "Unknown error"
                raise RuntimeError(str(error_text))
    finally:
        response.close()

    if assistant_started:
        print()

    return "".join(assistant_text_parts), metadata


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Minimal terminal chat for a deployed 21st agent."
    )
    parser.add_argument(
        "--agent",
        default=os.getenv("AGENT_SLUG"),
        help="Deployed agent slug. Defaults to AGENT_SLUG.",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("API_KEY_21ST"),
        help="21st API key. Defaults to API_KEY_21ST.",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("RELAY_BASE_URL", "https://relay.an.dev"),
        help="Relay base URL. Defaults to RELAY_BASE_URL or https://relay.an.dev.",
    )
    return parser


def main() -> int:
    load_dotenv(Path(".env"))
    args = build_parser().parse_args()

    if not args.api_key:
        print("Missing API key. Set API_KEY_21ST or pass --api-key.", file=sys.stderr)
        return 1

    if not args.agent:
        print("Missing agent slug. Set AGENT_SLUG or pass --agent.", file=sys.stderr)
        return 1

    client = AgentClient(api_key=args.api_key, base_url=args.base_url)
    messages: list[Dict[str, Any]] = []

    try:
        sandbox = client.sandboxes.create(agent=args.agent)
        thread = client.threads.create(sandbox_id=sandbox.id, name="Terminal chat")

        print(f"Connected to agent: {args.agent}")
        print(f"Sandbox: {sandbox.id}")
        print(f"Thread: {thread.id}")
        print("Type /new for a fresh thread or /exit to quit.")
        print()

        while True:
            try:
                prompt = input("you> ").strip()
            except EOFError:
                print()
                break
            except KeyboardInterrupt:
                print()
                break

            if not prompt:
                continue

            if prompt.lower() in EXIT_COMMANDS:
                break

            if prompt.lower() in NEW_THREAD_COMMANDS:
                thread = client.threads.create(sandbox_id=sandbox.id, name="Terminal chat")
                messages = []
                print(f"Started a new thread: {thread.id}")
                print()
                continue

            messages.append(make_message("user", prompt))
            result = client.threads.run(
                agent=args.agent,
                messages=messages,
                sandbox_id=sandbox.id,
                thread_id=thread.id,
            )

            try:
                assistant_text, metadata = stream_assistant_response(result.response)
            except Exception as exc:
                print(f"error> {exc}", file=sys.stderr)
                continue

            if assistant_text:
                messages.append(make_message("assistant", assistant_text))

            if metadata:
                session_id = metadata.get("sessionId")
                total_cost = metadata.get("totalCostUsd")
                duration_ms = metadata.get("durationMs")
                extras = []
                if session_id:
                    extras.append(f"session={session_id}")
                if duration_ms is not None:
                    extras.append(f"duration={duration_ms}ms")
                if total_cost is not None:
                    extras.append(f"cost=${total_cost}")
                if extras:
                    print(f"[meta] {' | '.join(extras)}")

            print()

    finally:
        client.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
