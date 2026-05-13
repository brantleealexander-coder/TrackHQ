# patch_vapi.py — Push updated tools + system prompt to VAPI assistant
import json
import os
import urllib.request
import urllib.error

ASSISTANT_ID = "23279f4d-fa14-446a-97a9-a5e001d99004"

# Load API key from .env
api_key = ""
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith("VAPI_API_KEY="):
                api_key = line.strip().split("=", 1)[1].strip().strip('"').strip("'")

if not api_key:
    print("[ERROR] VAPI_API_KEY not found in .env")
    raise SystemExit(1)

config_path = os.path.join(os.path.dirname(__file__), "vapi_assistant_config.json")
with open(config_path, encoding="utf-8") as f:
    config = json.load(f)

model = config["model"].copy()
model["tools"] = config["tools"]

patch = {
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
    f"https://api.vapi.ai/assistant/{ASSISTANT_ID}",
    data=payload,
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "python-vapi-patch/1.0",
    },
    method="PATCH",
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
        print(f"[OK] Assistant updated: {result.get('name')}")
        model_out = result.get("model", {})
        tools_in_model = model_out.get("tools", [])
        top_tools = result.get("tools", [])
        print(f"[DEBUG] model.tools count: {len(tools_in_model)}")
        print(f"[DEBUG] top-level tools count: {len(top_tools)}")
        print(f"[DEBUG] model keys: {list(model_out.keys())}")
        if tools_in_model:
            print(f"[OK] Tools: {[t.get('function', {}).get('name') for t in tools_in_model]}")
        else:
            print("[WARN] No tools found in response — printing full model:")
            print(json.dumps(model_out, indent=2))
except urllib.error.HTTPError as e:
    print(f"[ERROR] HTTP {e.code}: {e.read().decode()}")
    raise SystemExit(1)
