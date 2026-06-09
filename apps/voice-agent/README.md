# KentOS AI — Sesli Asistan (LiveKit Voice Agent)

Vatandaşın sesli/yazılı konuştuğu, Türkçe çalışan belediye asistanı.
Pipeline: **Deepgram STT (tr) → OpenAI LLM → OpenAI TTS**, LiveKit üzerinden.
Function calling ile KentOS public API'sine bağlanır.

## Araçlar (`tools.py` → `KentosTools`)

| Araç | KentOS ucu | İşlev |
|------|------------|-------|
| `ticket_olustur` | `POST /public/{slug}/tickets` | Şikayet/talep kaydı, takip kodu döner |
| `talep_sorgula` | `GET /public/{slug}/tickets/{token}` | Başvuru durumu sorgulama |
| `musait_randevular` | `GET /public/{slug}/appointment-slots` | Müsait randevu slotları |
| `randevu_al` | `POST /public/{slug}/appointments` | Randevu oluşturma |
| `bilgi_ver` | `GET /public/{slug}/faq` | Genel bilgi (çöp, imar, SSS) |

## Kurulum

```bash
cd apps/voice-agent
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # değerleri doldurun
```

## Çalıştırma

```bash
python agent.py dev      # geliştirme modu
python agent.py start    # üretim worker
```

Tenant bilgisi (tenantSlug, belediyeAdi) LiveKit room metadata'sından okunur;
widget bağlanırken JSON olarak gönderir. Yoksa `DEFAULT_TENANT_SLUG` kullanılır.
