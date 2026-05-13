"""Render the VAPI assistant config template against a tenant's business_config.

Substitutes `${field}` placeholders in vapi_assistant_config.example.json with
values from `business_config["vapi"]` plus extras (webhook URL from env).

`${...}` is single-brace by design: VAPI's own runtime template syntax uses
`{{ ... }}`, which we leave untouched.

Usage from another module:
    from app.render_vapi import render

    rendered = render(
        template_path=Path("vapi_assistant_config.example.json"),
        business_config=loaded_business_config,
        webhook_url="https://acme-receptionist.up.railway.app/webhook/vapi",
    )
    # rendered is a dict ready to POST/PATCH to VAPI
"""
import json
import re
from pathlib import Path
from typing import Optional


class RenderError(ValueError):
    pass


PLACEHOLDER_PATTERN = re.compile(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def render(
    template_path: Path,
    business_config: dict,
    webhook_url: Optional[str] = None,
) -> dict:
    raw = template_path.read_text(encoding="utf-8")

    vapi_section = business_config.get("vapi", {})
    if not isinstance(vapi_section, dict):
        raise RenderError("business_config['vapi'] must be an object")

    subs: dict[str, str] = {}
    for key, val in vapi_section.items():
        if isinstance(val, str):
            subs[key] = val

    if webhook_url is not None:
        subs["webhook_url"] = webhook_url

    missing: list[str] = []

    def replace(match: re.Match[str]) -> str:
        field = match.group(1)
        if field not in subs:
            missing.append(field)
            return match.group(0)  # leave the placeholder so the error message includes it
        # JSON-escape the value so embedded quotes/newlines stay valid inside the
        # surrounding JSON string. dumps wraps in quotes; strip them since the
        # placeholder already sits inside a quoted JSON string.
        encoded = json.dumps(subs[field])
        return encoded[1:-1]

    rendered_text = PLACEHOLDER_PATTERN.sub(replace, raw)

    if missing:
        unique = sorted(set(missing))
        raise RenderError(
            f"missing placeholder values for: {', '.join(unique)}. "
            f"Add them under `vapi` in business_config.json (or pass via render's kwargs)."
        )

    try:
        return json.loads(rendered_text)
    except json.JSONDecodeError as e:
        # A bad placeholder value can produce invalid JSON; surface the spot.
        raise RenderError(
            f"rendered config is not valid JSON ({e.msg} at line {e.lineno}, col {e.colno}). "
            "Check that placeholder values don't contain unescaped control characters."
        ) from e
