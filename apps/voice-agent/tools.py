"""
KentOS AI — Sesli Asistan Araçları (Function Tools)

agent.py içindeki LiveKit voice agent'ının çağırdığı fonksiyonlar.
Her araç KentOS public API'sine (kimlik gerektirmeyen vatandaş uçları) HTTP
isteği atar:

  - ticket_olustur     -> POST /public/{slug}/tickets
  - talep_sorgula      -> GET  /public/{slug}/tickets/{trackingToken}
  - musait_randevular  -> GET  /public/{slug}/appointment-slots
  - randevu_al         -> POST /public/{slug}/appointments
  - bilgi_ver          -> GET  /public/{slug}/faq

Araçlar @function_tool ile sarmalanmış kapanış (closure) fonksiyonlarıdır;
böylece JSON şeması parametre tip işaretlerinden türetilir ve `self` şemaya
sızmaz, durum (httpx istemcisi, tenant) kapanışla taşınır.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from livekit.agents import llm
from livekit.agents.llm import function_tool

logger = logging.getLogger("kentos-voice-agent.tools")

# Public ticket DTO yalnızca bu kanal değerlerini kabul ediyor; sesli asistan
# web sohbet widget'ı üzerinden bağlandığı için WEB_CHAT kullanılıyor.
DEFAULT_CHANNEL = "WEB_CHAT"


class KentosTools:
    """KentOS public API'sine bağlanan sesli asistan araç kümesi."""

    def __init__(self, api_base_url: str, internal_api_key: str, tenant_slug: str) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.internal_api_key = internal_api_key
        self.tenant_slug = tenant_slug
        self._client = httpx.AsyncClient(timeout=15.0, headers=self._default_headers())

    # ── Altyapı ────────────────────────────────────────────────────────────

    def _default_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        # Public uçlar anahtar istemiyor; tanımlıysa zararsızca eklenir.
        if self.internal_api_key:
            headers["x-internal-api-key"] = self.internal_api_key
        return headers

    def _url(self, path: str) -> str:
        return f"{self.api_base_url}/public/{self.tenant_slug}{path}"

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> tuple[Optional[Any], Optional[str]]:
        """HTTP isteği atar. (veri, hata_mesajı) döner — hata varsa veri None."""
        try:
            response = await self._client.request(method, self._url(path), **kwargs)
        except httpx.HTTPError as exc:
            logger.warning("KentOS API ulaşılamadı (%s %s): %s", method, path, exc)
            return None, "Sisteme şu an ulaşamıyorum, lütfen birazdan tekrar deneyin."

        if response.status_code == 404:
            return None, "Aradığınız kayıt bulunamadı."
        if response.status_code == 429:
            return None, "Çok fazla istek alındı, lütfen biraz sonra tekrar deneyin."
        if response.status_code >= 400:
            logger.warning("KentOS API hata %s (%s %s): %s", response.status_code, method, path, response.text[:200])
            return None, "İşlem sırasında bir hata oluştu, lütfen tekrar deneyin."

        try:
            return response.json(), None
        except ValueError:
            return None, "Sunucudan beklenmeyen bir yanıt geldi."

    # ── İş mantığı (HTTP) ────────────────────────────────────────────────────

    async def _create_ticket(
        self,
        description: str,
        address: Optional[str],
        citizen_name: Optional[str],
        phone: Optional[str],
    ) -> str:
        body: dict[str, Any] = {"description": description, "channel": DEFAULT_CHANNEL}
        if address:
            body["addressText"] = address
        if citizen_name:
            body["displayName"] = citizen_name
        if phone:
            body["phone"] = phone

        data, error = await self._request("POST", "/tickets", json=body)
        if error:
            return error

        token = data.get("trackingToken")
        department = data.get("departmentName")
        if not token:
            return "Başvurunuz alındı ancak takip kodu üretilemedi, lütfen yetkili birime danışın."

        suffix = f" Talebiniz {department} birimine yönlendirildi." if department else ""
        return (
            f"Başvurunuz başarıyla alındı. Takip kodunuz: {token}."
            f"{suffix} Bu kodu durumu sorgulamak için saklayın."
        )

    async def _get_ticket_status(self, tracking_token: str) -> str:
        token = tracking_token.strip().upper()
        data, error = await self._request("GET", f"/tickets/{token}")
        if error:
            return error

        status = data.get("status", "bilinmiyor")
        title = data.get("title") or "başvurunuz"
        department = data.get("departmentName")
        status_tr = _STATUS_TR.get(str(status), str(status))

        parts = [f"{token} numaralı başvurunuzun ({title}) durumu: {status_tr}."]
        if department:
            parts.append(f"İlgili birim: {department}.")
        messages = data.get("publicMessages") or []
        last_muni = next((m for m in reversed(messages) if m.get("author") == "municipality"), None)
        if last_muni and last_muni.get("body"):
            parts.append(f"Belediyenin son notu: {last_muni['body']}")
        return " ".join(parts)

    async def _list_slots(self) -> str:
        data, error = await self._request("GET", "/appointment-slots")
        if error:
            return error
        if not data:
            return "Şu anda müsait randevu bulunmuyor. Lütfen daha sonra tekrar deneyin."

        lines = []
        for slot in data[:5]:
            when = _format_when(slot.get("startsAt"))
            dept = slot.get("departmentName") or "Genel"
            lines.append(f"{dept} — {when} (kod: {slot.get('id')})")
        return "Müsait randevular: " + "; ".join(lines) + ". Hangisini istersiniz?"

    async def _book_appointment(
        self,
        slot_id: str,
        citizen_name: str,
        phone: Optional[str],
        note: Optional[str],
    ) -> str:
        body: dict[str, Any] = {"slotId": slot_id, "citizenName": citizen_name}
        if phone:
            body["citizenPhone"] = phone
        if note:
            body["note"] = note

        data, error = await self._request("POST", "/appointments", json=body)
        if error:
            return error

        appt_id = data.get("id")
        return (
            f"Randevunuz oluşturuldu. Randevu numaranız: {appt_id}. "
            "Onay için belediye sizinle iletişime geçecektir."
        )

    async def _answer_from_faq(self, topic: Optional[str]) -> str:
        data, error = await self._request("GET", "/faq", params={"lang": "tr"})
        if error:
            return error
        if not data:
            return "Bu konuda kayıtlı bir bilgi bulamadım. Sizi yetkili birime yönlendirebilirim."

        articles = data if isinstance(data, list) else data.get("items", [])
        if topic:
            needle = topic.lower()
            matches = [a for a in articles if needle in (a.get("title", "") + a.get("body", "")).lower()]
            articles = matches or articles

        if not articles:
            return "Bu konuda kayıtlı bir bilgi bulamadım. Sizi yetkili birime yönlendirebilirim."

        top = articles[0]
        body = (top.get("body") or "").strip()
        # Sesli yanıt için kısa tut.
        if len(body) > 400:
            body = body[:400].rsplit(" ", 1)[0] + "..."
        return f"{top.get('title', 'Bilgi')}: {body}"

    # ── LiveKit function tools ───────────────────────────────────────────────

    def get_all_tools(self) -> list[llm.FunctionTool]:
        """agent.py'nin Agent(tools=...) için kullandığı araç listesini döner."""
        kentos = self

        @function_tool
        async def ticket_olustur(
            description: str,
            address: Optional[str] = None,
            citizen_name: Optional[str] = None,
            phone: Optional[str] = None,
        ) -> str:
            """Vatandaşın şikayet veya talebini KentOS'a kaydeder, takip kodu döner.

            Args:
                description: Vatandaşın bildirdiği sorun/talep, en az 10 karakter.
                address: Sorunun olduğu adres veya konum.
                citizen_name: Vatandaşın adı soyadı.
                phone: Vatandaşın telefon numarası.
            """
            return await kentos._create_ticket(description, address, citizen_name, phone)

        @function_tool
        async def talep_sorgula(tracking_token: str) -> str:
            """Takip kodu (TK...) ile mevcut bir başvurunun durumunu sorgular.

            Args:
                tracking_token: Vatandaşa daha önce verilen takip kodu.
            """
            return await kentos._get_ticket_status(tracking_token)

        @function_tool
        async def musait_randevular() -> str:
            """Önümüzdeki günler için müsait randevu slotlarını listeler."""
            return await kentos._list_slots()

        @function_tool
        async def randevu_al(
            slot_id: str,
            citizen_name: str,
            phone: Optional[str] = None,
            note: Optional[str] = None,
        ) -> str:
            """Seçilen müsait slot için randevu oluşturur.

            Args:
                slot_id: musait_randevular ile dönen randevu slot kodu.
                citizen_name: Randevuyu alan vatandaşın adı soyadı.
                phone: İletişim için telefon numarası.
                note: Randevu ile ilgili kısa açıklama.
            """
            return await kentos._book_appointment(slot_id, citizen_name, phone, note)

        @function_tool
        async def bilgi_ver(topic: Optional[str] = None) -> str:
            """Çöp toplama, imar, SSS gibi genel belediye bilgilerini FAQ'tan getirir.

            Args:
                topic: Bilgi istenen konu (ör. 'çöp toplama', 'imar').
            """
            return await kentos._answer_from_faq(topic)

        return [ticket_olustur, talep_sorgula, musait_randevular, randevu_al, bilgi_ver]


# Ticket durum kodlarının Türkçe karşılıkları (sesli yanıt için).
_STATUS_TR = {
    "NEW": "yeni alındı",
    "OPEN": "açık / değerlendiriliyor",
    "IN_PROGRESS": "işleme alındı",
    "PENDING": "beklemede",
    "RESOLVED": "çözüldü",
    "CLOSED": "kapatıldı",
    "REJECTED": "reddedildi",
}


def _format_when(value: Any) -> str:
    """ISO tarih dizgesini sesli okumaya uygun kısa biçime çevirir."""
    if not value:
        return "tarih belirsiz"
    text = str(value)
    # 2026-05-30T14:00:00.000Z -> 2026-05-30 14:00
    text = text.replace("T", " ")
    if "." in text:
        text = text.split(".", 1)[0]
    elif "Z" in text:
        text = text.replace("Z", "")
    return text.strip()[:16]
