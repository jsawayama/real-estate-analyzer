from __future__ import annotations

import gzip
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external"
CACHE_DIR = Path(".runtime-cache")
CACHE_TTL_SECONDS = int(os.environ.get("REINFOLIB_CACHE_TTL_SECONDS", "1800"))
API_KEY = os.environ.get("REINFOLIB_API_KEY", "").strip()


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api(parsed)
            return
        super().do_GET()

    def handle_api(self, parsed):
        try:
            if parsed.path == "/api/health":
                self.send_json({
                    "ok": True,
                    "apiKeyConfigured": bool(API_KEY),
                    "cacheTtlSeconds": CACHE_TTL_SECONDS,
                    "source": "国土交通省 不動産情報ライブラリ API",
                    "credit": "このサービスは、国土交通省の不動産情報ライブラリのAPI機能を使用していますが、提供情報の最新性、正確性、完全性等が保証されたものではありません"
                })
                return

            if not API_KEY:
                self.send_json({
                    "ok": False,
                    "error": "REINFOLIB_API_KEY が未設定です。API利用申請後、環境変数に設定してください。"
                }, status=503)
                return

            query = urllib.parse.parse_qs(parsed.query)
            if parsed.path == "/api/cities":
                data = self.proxy("XIT002", pick(query, {"area", "language"}))
                self.send_json({"ok": True, "data": data})
                return
            if parsed.path == "/api/transactions":
                params = pick(query, {"priceClassification", "year", "quarter", "area", "city", "station", "language"})
                data = self.proxy("XIT001", params)
                self.send_json({"ok": True, "data": normalize_records(data)})
                return
            if parsed.path == "/api/appraisals":
                params = pick(query, {"year", "area", "division", "language"})
                data = self.proxy("XCT001", params)
                self.send_json({"ok": True, "data": normalize_records(data)})
                return

            self.send_json({"ok": False, "error": "Unknown API endpoint"}, status=404)
        except UpstreamError as error:
            self.send_json({"ok": False, "error": str(error), "status": error.status}, status=502)
        except Exception as error:
            self.send_json({"ok": False, "error": f"Internal server error: {error}"}, status=500)

    def proxy(self, api_id, params):
        params = {key: value for key, value in params.items() if value}
        if api_id == "XIT001" and not any(params.get(key) for key in ("area", "city", "station")):
            raise UpstreamError("XIT001 は area/city/station のいずれかが必要です", 400)
        if api_id == "XCT001" and not all(params.get(key) for key in ("year", "area", "division")):
            raise UpstreamError("XCT001 は year/area/division が必要です", 400)
        if api_id == "XIT002" and not params.get("area"):
            raise UpstreamError("XIT002 は area が必要です", 400)

        encoded = urllib.parse.urlencode(params)
        url = f"{BASE_URL}/{api_id}?{encoded}"
        cache_key = hashlib.sha256(url.encode("utf-8")).hexdigest()
        cached = read_cache(cache_key)
        if cached is not None:
            return cached

        request = urllib.request.Request(url)
        request.add_header("Ocp-Apim-Subscription-Key", API_KEY)
        request.add_header("Accept", "application/json")
        request.add_header("Accept-Encoding", "gzip")

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
                encoding = (response.headers.get("Content-Encoding") or "").lower()
                if "gzip" in encoding:
                    body = gzip.decompress(body)
                text = body.decode("utf-8")
                data = json.loads(text) if text else []
                write_cache(cache_key, data)
                return data
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return []
            if error.code == 429:
                raise UpstreamError("APIのアクセス制限に達しました。少し時間を置いて再試行してください。", 429)
            raise UpstreamError(f"APIエラー: HTTP {error.code}", error.code)
        except urllib.error.URLError as error:
            raise UpstreamError(f"APIへ接続できません: {error.reason}", 503)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class UpstreamError(Exception):
    def __init__(self, message, status):
        super().__init__(message)
        self.status = status


def pick(query, allowed):
    return {key: query.get(key, [""])[0] for key in allowed}


def read_cache(cache_key):
    path = CACHE_DIR / f"{cache_key}.json"
    if not path.exists():
        return None
    if time.time() - path.stat().st_mtime > CACHE_TTL_SECONDS:
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_cache(cache_key, data):
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{cache_key}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def normalize_records(data):
    if isinstance(data, dict):
        for key in ("data", "result", "features"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    if isinstance(data, list):
        return data
    return []


def main():
    port = int(os.environ.get("PORT", "4175"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Real estate app listening on http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
