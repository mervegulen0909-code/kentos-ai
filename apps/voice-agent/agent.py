"""
KentOS AI Belediye Sesli Asistan — LiveKit Voice Agent

Vatandaş sesli/yazılı konuşur → Deepgram STT (Türkçe) → LLM → TTS → ses yanıt.
Function calling ile KentOS API'sine bağlanarak ticket oluşturur, sorgular, randevu alır.
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    WorkerOptions,
    WorkerType,
    cli,
    llm,
)
from livekit.agents.voice import VoiceSession
from livekit.plugins import deepgram, openai, silero

from tools import KentosTools

load_dotenv()

logger = logging.getLogger("kentos-voice-agent")
logger.setLevel(logging.INFO)

# Tenant-specific config (room metadata'dan gelir)
DEFAULT_TENANT_SLUG = os.getenv("DEFAULT_TENANT_SLUG", "demo-belediye")
API_BASE_URL = os.getenv("KENTOS_API_BASE_URL", "https://api.xn--izmirusul-y9a.com/api/v1")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

# Agent system prompt
SYSTEM_PROMPT = """Sen {belediye_adi} belediyesinin yapay zeka sesli asistanisın.
Vatandaşlara Türkçe yardım ediyorsun. Kısa, net ve nazik cevaplar ver.

Yapabileceğin işlemler:
1. **Şikayet/talep kaydı oluşturma** — Vatandaş bir sorun bildirdiğinde ticket_olustur aracını kullan.
   Önce sorunu ve konumu sor, sonra kaydet. Takip kodunu söyle.
2. **Başvuru durumu sorgulama** — Vatandaş TK kodu verirse talep_sorgula ile durumu bul ve bildir.
3. **E-randevu alma** — Vatandaş randevu isterse müsait slotları kontrol et ve randevu_al ile kaydet.
4. **Genel bilgi verme** — Çöp toplama günleri, imar sorguları gibi sorularda bilgi_ver aracını kullan.

Kurallar:
- Her zaman Türkçe konuş.
- Kısa ve öz cevaplar ver (sesli konuşma olduğu için uzun cümlelerden kaçın).
- Emin olmadığın konularda "Bu konuda sizi yetkili birime yönlendireyim" de.
- Acil durumları (yangın, sel, yaralanma) hemen belirt ve 112'ye yönlendir.
- Başvuru oluşturduktan sonra takip kodunu yavaş ve net söyle.
"""


class MunicipalityVoiceAgent:
    """Belediye sesli asistan agent'ı."""

    def __init__(self, tenant_slug: str = DEFAULT_TENANT_SLUG, belediye_adi: str = "Demo Belediyesi"):
        self.tenant_slug = tenant_slug
        self.belediye_adi = belediye_adi
        self.tools = KentosTools(
            api_base_url=API_BASE_URL,
            internal_api_key=INTERNAL_API_KEY,
            tenant_slug=tenant_slug,
        )

    def get_system_prompt(self) -> str:
        return SYSTEM_PROMPT.format(belediye_adi=self.belediye_adi)

    def get_tools(self) -> list[llm.FunctionTool]:
        return self.tools.get_all_tools()


async def entrypoint(ctx: AgentSession):
    """LiveKit agent entrypoint — her yeni room/katılımcı için çağrılır."""

    # Room metadata'dan tenant bilgisi al (widget bağlanırken gönderir)
    room = ctx.room
    metadata = room.metadata or "{}"

    # Parse tenant info from room metadata
    import json
    try:
        meta = json.loads(metadata)
    except (json.JSONDecodeError, TypeError):
        meta = {}

    tenant_slug = meta.get("tenantSlug", DEFAULT_TENANT_SLUG)
    belediye_adi = meta.get("belediyeAdi", "Demo Belediyesi")

    logger.info(f"Voice session starting for tenant={tenant_slug}, belediye={belediye_adi}")

    municipality = MunicipalityVoiceAgent(tenant_slug=tenant_slug, belediye_adi=belediye_adi)

    # Agent oluştur
    agent = Agent(
        instructions=municipality.get_system_prompt(),
        tools=municipality.get_tools(),
    )

    # Voice session oluştur (STT + LLM + TTS pipeline)
    session = VoiceSession(
        agent=agent,
        stt=deepgram.STT(
            model="nova-3",
            language="tr",
        ),
        llm=openai.LLM(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            temperature=0.3,
        ),
        tts=openai.TTS(
            model="gpt-4o-mini-tts",
            voice="coral",
        ),
        vad=silero.VAD.load(),
    )

    # Oturumu başlat
    await session.start(room=room)

    # Karşılama mesajı
    await session.say(
        f"Merhaba, {belediye_adi} sesli asistanına hoş geldiniz. "
        "Size nasıl yardımcı olabilirim?",
        allow_interruptions=True,
    )

    logger.info(f"Voice session active for tenant={tenant_slug}")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            auto_subscribe=AutoSubscribe.AUDIO_ONLY,
        ),
    )
