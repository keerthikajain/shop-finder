"""Authenticated same-origin proxy for Gnani Prisma V3 live STT segments.

Only raw PCM crosses browser -> Shop Finder -> Gnani. The Gnani API key stays on
the backend. This protocol emits completed VAD speech segments, not word-by-word
partial hypotheses. REST transcription remains available independently.
"""
import asyncio
import json
import os
import secrets
import time
from contextlib import suppress
from urllib.parse import urlsplit

import websockets
from fastapi import HTTPException, WebSocket, WebSocketDisconnect, WebSocketException

from .accounts import COOKIE, digest, enforce_rate
from .database import connect
from .services import voice
from .warehouse import rows as warehouse_rows

MAX_SECONDS = 28
MAX_BYTES = 16000 * 2 * MAX_SECONDS
FRAME_BYTES = 1024
ALLOWED_LANGUAGES = {'en-IN', 'hi-IN', 'hi-en', 'auto'}
ALLOWED_STYLES = {'verbatim', 'transcribe', 'codemix', 'transliterate'}
ALLOWED_COLLECTIONS = {'all', 'clothing', 'footwear', 'appliances', 'home', 'grocery'}


def same_origin(ws: WebSocket) -> bool:
    """Origin and Host must agree; do not trust browser-supplied query tokens."""
    origin = ws.headers.get('origin', '')
    host = ws.headers.get('host', '')
    try:
        parsed = urlsplit(origin)
        return parsed.scheme in ('https', 'http') and parsed.netloc == host and not parsed.path.rstrip('/') and not parsed.query
    except ValueError:
        return False


def authorize(ws: WebSocket, path) -> bool:
    if not same_origin(ws) or not ws.app.state.accounts_required:
        return False
    token = ws.cookies.get(COOKIE, '')
    if not token:
        return False
    with connect(path) as c:
        found = c.execute(
            """SELECT a.id FROM accounts a JOIN account_sessions s ON a.id=s.user_id
               WHERE s.digest=? AND s.expires>? AND a.active=1 LIMIT 1""",
            (digest(token), time.time()),
        ).fetchone()
    if not found:
        return False
    try:
        enforce_rate(path, found['id'], '/api/voice/live')
    except HTTPException:
        return False
    return True


def context_keywords(path, collection):
    words = []
    with connect(path) as c:
        records = warehouse_rows(c, collection)
    for item in records:
        for word in (item['name'], item.get('brand', ''), *item.get('aliases', [])):
            word = str(word).strip()
            if 1 <= len(word) <= 100 and word not in words and '<|' not in word and '|>' not in word:
                words.append(word)
            if len(words) >= 80:
                return words
    return words


def provider_headers(language, style, enhanced, keywords):
    if voice.stt_model() != 'prisma-v3.0':
        raise ValueError('Live streaming requires Prisma V3.0.')
    auto = language in ('auto', 'hi-en')
    headers = {
        'x-api-key-id': os.environ['GNANI_API_KEY'],
        'lang_code': 'indic-auto' if auto else language,
        'x-sample-rate': '16000',
        'x-model': 'prisma-v3.0',
        'x-format': style,
        'x-api-request-id': secrets.token_hex(12),
    }
    if auto and enhanced:
        headers['x-language-candidates'] = 'hi-IN,en-IN'
    if keywords:
        # WebSocket handshake headers have tighter proxy limits than REST bodies.
        # Keep the same verified names, but cap encoded keyword hints at ~3 KiB.
        selected = []
        for word in keywords:
            trial = json.dumps([*selected, word], ensure_ascii=True)
            if len(trial.encode('ascii')) > 3072:
                break
            selected.append(word)
        if selected:
            headers['x-keywords'] = json.dumps(selected, ensure_ascii=True)
    return headers


def install_streaming(app, path):
    @app.websocket('/api/voice/live')
    async def live(ws: WebSocket):
        if not authorize(ws, path):
            await ws.close(code=1008)
            return
        if not voice.ready() or voice.stt_model() != 'prisma-v3.0':
            await ws.close(code=1013)
            return
        p = ws.query_params
        language = p.get('language', 'en-IN')
        style = p.get('style', 'transcribe')
        collection = p.get('collection', 'all')
        enhanced = p.get('enhanced', 'true') == 'true'
        if language not in ALLOWED_LANGUAGES or style not in ALLOWED_STYLES or collection not in ALLOWED_COLLECTIONS:
            await ws.close(code=1008)
            return
        await ws.accept()
        provider = None
        reader = None
        texts = []
        detected = None
        frame_count = 0
        closed = False

        async def forward():
            nonlocal detected, closed
            try:
                async for raw in provider:
                    if not isinstance(raw, str):
                        continue
                    event = json.loads(raw)
                    kind = event.get('type')
                    if kind == 'transcript':
                        text = event.get('text', '')
                        if isinstance(text, str) and text.strip():
                            # A segment is finalized by provider VAD; do not invent partial results.
                            if len(text) > 5000:
                                continue
                            texts.append(text.strip())
                            if event.get('detected_language_code') in ('hi-IN', 'en-IN'):
                                detected = event['detected_language_code']
                            await ws.send_json({'type': 'segment', 'text': text.strip(),
                                                'detected_language_code': detected})
                    elif kind == 'error':
                        await ws.send_json({'type': 'error',
                                            'message': 'Gnani streaming could not transcribe. Use recorded voice or text search.'})
                        closed = True
                        return
            except Exception:
                # Provider disconnects, invalid event frames or browser closure
                # must not surface credentials or crash the live session.
                closed = True

        try:
            from websockets.asyncio.client import connect as upstream_connect
            headers = provider_headers(language, style, enhanced, context_keywords(path, collection))
            async with asyncio.timeout(MAX_SECONDS + 15):
                async with upstream_connect(
                    'wss://api.vachana.ai/stt/v3/stream',
                    additional_headers=headers, open_timeout=10, close_timeout=5,
                    max_size=65536, ping_interval=20, ping_timeout=15,
                ) as provider:
                    opening = await asyncio.wait_for(provider.recv(), timeout=10)
                    opening = json.loads(opening)
                    if opening.get('type') != 'connected':
                        raise ValueError('Provider did not acknowledge live audio')
                    await ws.send_json({'type': 'ready'})
                    reader = asyncio.create_task(forward())
                    while not closed:
                        incoming = await asyncio.wait_for(ws.receive(), timeout=35)
                        if incoming.get('type') == 'websocket.disconnect':
                            return
                        data = incoming.get('bytes')
                        if data is not None:
                            if len(data) != FRAME_BYTES or (frame_count + 1) * FRAME_BYTES > MAX_BYTES + FRAME_BYTES:
                                await ws.send_json({'type': 'error', 'message': 'Invalid or excessive audio frame.'})
                                return
                            frame_count += 1
                            await provider.send(data)
                            continue
                        try:
                            control = json.loads(incoming.get('text') or '')
                        except (TypeError, ValueError):
                            await ws.send_json({'type': 'error', 'message': 'Invalid audio control.'})
                            return
                        if control.get('type') == 'cancel':
                            return
                        if control.get('type') != 'stop':
                            await ws.send_json({'type': 'error', 'message': 'Invalid audio control.'})
                            return
                        # Flush VAD with one second of real-time silence before collecting
                        # the last segment; provider does not promise word-by-word partials.
                        for _ in range(32):
                            await provider.send(bytes(FRAME_BYTES))
                            await asyncio.sleep(0.032)
                        await asyncio.sleep(2)
                        if reader and not reader.done():
                            await asyncio.sleep(0.5)
                        transcript = ' '.join(texts).strip()
                        if not closed:
                            if transcript:
                                await ws.send_json({
                                    'type': 'complete', 'transcript': transcript,
                                    'search_language': (detected or 'hi-en') if language == 'auto' else language,
                                    'detected_language_code': detected,
                                })
                            else:
                                await ws.send_json({'type': 'error',
                                                    'message': 'No speech recognized. Retry or use recorded voice.'})
                        return
        except (OSError, TimeoutError, ValueError, websockets.WebSocketException):
            with suppress(Exception):
                await ws.send_json({'type': 'error', 'message': 'Live voice unavailable. Use recorded voice or text search.'})
        except WebSocketDisconnect:
            pass
        finally:
            if reader:
                reader.cancel()
                with suppress(asyncio.CancelledError):
                    await reader
            with suppress(Exception):
                await ws.close()
