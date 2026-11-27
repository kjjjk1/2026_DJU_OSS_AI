"""DataClinic local UI and optional Gemini explanation service (Python 3.9+)."""
import argparse
import getpass
import json
import math
import os
import re
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
ASSETS = {
    "/": ("index.html", "text/html"),
    "/index.html": ("index.html", "text/html"),
    "/experiments.js": ("experiments.js", "text/javascript"),
    "/models.js": ("models.js", "text/javascript"),
    "/integration.js": ("integration.js", "text/javascript"),
    "/nhis-codes.js": ("nhis-codes.js", "text/javascript"),
}
FIELDS = {
    "cleaning": {"rows", "missing", "originalSd", "meanSd", "medianSd"},
    "merge": {"rows", "matched", "unknown", "blank"},
    "medical": {"peopleWithReport", "oneDate", "conflicts"},
}
PARTS = ("meaning", "limit", "check")
PROMPT = """한국어로 집계된 데이터 품질 지표를 설명한다. 원자료나 임상적 맥락은 없다.
meaning은 관측한 변화와 가능한 정제 선택의 이유, limit은 해석의 한계, check는 사용자가 확인할 사항이다.
cleaning은 수치 열의 결측 행 삭제와 평균·중앙값 대체 비교이다. Sd는 표본 표준편차이다.
merge는 공단 검진코드 정확 일치 결과로 unknown은 미등록, blank는 빈 코드다.
medical은 가상 사건 기록의 서로 다른 사망일 개수를 검토한다. 실제 사망일을 추정하지 않는다.
각 항목은 한두 문장으로 작성한다. 수치는 화면에 따로 표시하므로 숫자, 퍼센트, 외부 사실을 추가하지 않는다.
자료의 한계를 고려하고 방법을 강요하지 않는다. 임상 진단이나 치료 권고를 하지 않는다."""


def validate_summary(data):
    if not isinstance(data, dict) or set(data) != {"kind", "metrics"}:
        raise ValueError
    kind, metrics = data["kind"], data["metrics"]
    if not isinstance(kind, str) or kind not in FIELDS or not isinstance(metrics, dict) or set(metrics) != FIELDS[kind]:
        raise ValueError
    for name, value in metrics.items():
        if name.endswith("Sd"):
            if value is not None and (type(value) not in (float, int) or value < 0 or not math.isfinite(value)):
                raise ValueError
        elif type(value) is not int or not 0 <= value <= 1_000_000_000:
            raise ValueError
    if kind == "merge" and metrics["rows"] != sum(metrics[k] for k in ("matched", "unknown", "blank")):
        raise ValueError
    if kind == "cleaning" and not 0 < metrics["missing"] < metrics["rows"]:
        raise ValueError
    if kind == "medical" and metrics["peopleWithReport"] != metrics["oneDate"] + metrics["conflicts"]:
        raise ValueError
    return data


def explain(summary, key, model):
    payload = {
        "systemInstruction": {"parts": [{"text": PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(summary)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {"type": "OBJECT", "properties": {k: {"type": "STRING"} for k in PARTS}, "required": list(PARTS)},
        },
    }
    req = Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                  data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urlopen(req, timeout=25) as response:
        candidate = json.load(response)["candidates"][0]
    if candidate.get("finishReason") != "STOP":
        raise ValueError
    text = "".join(p.get("text", "") for p in candidate["content"]["parts"] if not p.get("thought"))
    result = json.loads(text)
    if not isinstance(result, dict) or set(result) != set(PARTS):
        raise ValueError
    for value in result.values():
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 600 or re.search(r"[0-9]", value):
            raise ValueError
    return result


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, status, content, mime):
        self.send_response(status)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def reply(self, status, payload):
        self.send_bytes(status, json.dumps(payload, ensure_ascii=False).encode(), "application/json")

    def local_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def do_GET(self):
        if not self.local_host():
            return self.reply(403, {"error": "origin"})
        if self.path == "/api/status":
            return self.reply(200, {"configured": bool(self.server.gemini_key)})
        asset = ASSETS.get(self.path)
        if not asset:
            return self.reply(404, {"error": "missing"})
        self.send_bytes(200, (ROOT / asset[0]).read_bytes(), asset[1])

    def do_POST(self):
        if self.path != "/api/explain":
            return self.reply(404, {"error": "missing"})
        if not self.local_host() or self.headers.get("Origin") != "http://" + self.headers["Host"]:
            return self.reply(403, {"error": "origin"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 2048 or self.headers.get_content_type() != "application/json":
                raise ValueError
            summary = validate_summary(json.loads(self.rfile.read(size)))
        except (ValueError, TypeError, OverflowError):
            return self.reply(400, {"error": "invalid_summary"})
        if not self.server.gemini_key:
            return self.reply(503, {"error": "no_key"})
        try:
            result = explain(summary, self.server.gemini_key, self.server.model)
        except HTTPError as exc:
            error = {400: "model_or_key", 401: "model_or_key", 403: "model_or_key", 404: "model_or_key", 429: "quota"}.get(exc.code, "upstream")
            return self.reply(502, {"error": error})
        except (URLError, OSError, ValueError, KeyError, IndexError, TypeError, AttributeError):
            return self.reply(502, {"error": "upstream"})
        self.reply(200, {"source": "gemini", "explanation": result})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--open", action="store_true")
    parser.add_argument("--ask-key", action="store_true")
    parser.add_argument("--port", default=0, type=int)
    args = parser.parse_args()
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
    if not key and args.ask_key:
        key = getpass.getpass("Gemini API 키 (생략하려면 Enter): ").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", model):
        sys.exit("GEMINI_MODEL 값을 확인하세요.")
    with ThreadingHTTPServer(("127.0.0.1", args.port), Handler) as httpd:
        httpd.gemini_key, httpd.model = key, model
        url = f"http://127.0.0.1:{httpd.server_port}/"
        print("DataClinic", url, flush=True)
        if args.open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

