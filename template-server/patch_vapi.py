# patch_vapi.py — render the VAPI template against business_config and PATCH
# the live assistant.
#
# Usage:
#     VAPI_API_KEY=...  \
#     VAPI_ASSISTANT_ID=... \
#     VAPI_WEBHOOK_URL=https://your-deploy.up.railway.app/webhook/vapi \
#         python patch_vapi.py
#
# Add --dry-run to print the rendered config without contacting VAPI.

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from app.render_vapi import render, RenderError


def load_env_file(path: Path) -> dict[str, str]:
    """Light-weight .env loader (mirrors what python-dotenv would do).

    Used only for the CLI — the running server uses pydantic-settings.
    """
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Render and PATCH VAPI assistant config.")
    parser.add_argument(
        "--template",
        default="vapi_assistant_config.example.json",
        help="Path to the VAPI template (default: vapi_assistant_config.example.json)",
    )
    parser.add_argument(
        "--business-config",
        default="app/business_config.json",
        help="Path to the tenant's business_config.json (default: app/business_config.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Render and print the config but don't PATCH VAPI.",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent

    # CLI-only convenience: pick up .env so the operator doesn't have to
    # `source .env` first.
    env_path = script_dir / ".env"
    file_env = load_env_file(env_path)
    for k, v in file_env.items():
        os.environ.setdefault(k, v)

    template_path = (script_dir / args.template).resolve()
    bc_path = (script_dir / args.business_config).resolve()

    if not template_path.exists():
        print(f"[ERROR] VAPI template not found at {template_path}")
        return 1
    if not bc_path.exists():
        print(f"[ERROR] business_config not found at {bc_path}")
        print(
            "        Copy app/business_config.example.json to app/business_config.json and fill it in."
        )
        return 1

    webhook_url = os.environ.get("VAPI_WEBHOOK_URL", "").strip()
    if not webhook_url:
        print("[ERROR] VAPI_WEBHOOK_URL not set (e.g. https://your-server.up.railway.app/webhook/vapi)")
        return 1

    business_config = json.loads(bc_path.read_text(encoding="utf-8"))

    try:
        config = render(
            template_path=template_path,
            business_config=business_config,
            webhook_url=webhook_url,
        )
    except RenderError as e:
        print(f"[ERROR] render failed: {e}")
        return 1

    if args.dry_run:
        print(json.dumps(config, indent=2))
        return 0

    api_key = os.environ.get("VAPI_API_KEY", "").strip()
    assistant_id = os.environ.get("VAPI_ASSISTANT_ID", "").strip()
    if not api_key:
        print("[ERROR] VAPI_API_KEY not set")
        return 1
    if not assistant_id:
        print("[ERROR] VAPI_ASSISTANT_ID not set")
        return 1

    model = dict(config["model"])
    model["tools"] = config["tools"]

    patch: dict = {
        "name": config["name"],
        "firstMessage": config.get("firstMessage", ""),
        "model": model,
        "voice": config["voice"],
    }
    if "backgroundSound" in config:
        patch["backgroundSound"] = config["backgroundSound"]
    if "analysisPlan" in config:
        patch["analysisPlan"] = config["analysisPlan"]

    payload = json.dumps(patch).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.vapi.ai/assistant/{assistant_id}",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "trackhq-vapi-patch/1.0",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(f"[OK] Assistant updated: {result.get('name')}")
            tools = result.get("model", {}).get("tools", [])
            tool_names = [t.get("function", {}).get("name") for t in tools]
            print(f"[OK] Tools: {tool_names}")
        return 0
    except urllib.error.HTTPError as e:
        print(f"[ERROR] HTTP {e.code}: {e.read().decode()}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
