# KentOS AI — tanıtım filmi montaj scripti (FFmpeg) — 16:9 yatay, diyaloglu
# Veo 3 ile üretilen 6 yatay (1280x720) diyaloglu klibi birleştirir.
# - Sahne 1-5: Türkçe diyalog sesleri + markalı alt-başlık overlay
# - Sahne 6: kapanış (narrator + orkestral müzik), overlay yok
# - Intro/Outro kartları: kapanış sahnesinin müziğinden türetilen fon (afade)
# - Crossfade geçişler, diyalog sesleri korunur
#
# Önkoşul: video-cards/*.png (landscape) üretilmiş; videos/ içinde 6 mp4.
# Çalıştırma: powershell -ExecutionPolicy Bypass -File tools/build-promo-video.ps1

$ErrorActionPreference = 'Continue'
$root = 'C:\Users\Shadow\Desktop\kentos-tanitim'
$vid  = Join-Path $root 'videos'
$card = Join-Path $root 'video-cards'
$tmp  = Join-Path $root 'video-tmp'
$out  = Join-Path $root 'KentOS-AI-Tanitim-Video.mp4'

New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$W = 1280; $H = 720; $FPS = 24; $XF = 0.5  # 16:9, crossfade süresi (sn)

# ── SAHNE SIRASI ─────────────────────────────────────────────────
# v = video dosya adı (videos/ içinde), ov = overlay (yoksa $null), dur = süre
# NOT: Videolar Flow'dan gelince 'v' alanlarını gerçek dosya adlarıyla güncelle.
$scenes = @(
  @{ v = '1_sorun.mp4';   ov = 'ov_1_sorun.png';   dur = 10 },
  @{ v = '2_basvuru.mp4'; ov = 'ov_2_basvuru.png'; dur = 10 },
  @{ v = '3_ai.mp4';      ov = 'ov_3_ai.png';      dur = 10 },
  @{ v = '4_yonetici.mp4';ov = 'ov_4_hizli.png';   dur = 10 },
  @{ v = '5_cozum.mp4';   ov = 'ov_5_cozum.png';   dur = 10 },
  @{ v = '6_kapanis.mp4'; ov = $null;              dur = 10 }   # kapanış, overlay yok
)

function Assert-Ok($label) {
  if ($LASTEXITCODE -ne 0) { Write-Host "  [HATA] $label (exit $LASTEXITCODE)"; exit 1 }
}

# Eksik video kontrolü
$missing = $scenes | Where-Object { -not (Test-Path (Join-Path $vid $_.v)) }
if ($missing) {
  Write-Host "[BEKLE] Su video dosyalari videos/ icinde yok:"
  $missing | ForEach-Object { Write-Host "   - $($_.v)" }
  Write-Host "`nFlow'dan inen videolari su isimlerle videos/ klasorune koy, sonra tekrar calistir."
  exit 2
}

Write-Host "=== Asama 0: Intro/Outro muzigi kapanis sahnesinden cikariliyor ==="
$musicSrc = Join-Path $tmp 'music_src.m4a'
$closing = Join-Path $vid ($scenes[-1].v)
& ffmpeg -y -loglevel error -nostats -i $closing -vn -c:a aac -b:a 192k $musicSrc 2>$null
Assert-Ok 'muzik cikarma'

Write-Host "=== Asama 1: Segmentler normalize ediliyor ==="

# Intro: PNG + kapanis muziginin ilk 2.5sn (fade-in)
$introMp4 = Join-Path $tmp 'seg_00_intro.mp4'
& ffmpeg -y -loglevel error -nostats -loop 1 -i (Join-Path $card 'intro.png') -i $musicSrc `
  -t 2.5 -r $FPS `
  -filter_complex "[0:v]scale=${W}:${H},format=yuv420p[v];[1:a]atrim=0:2.5,afade=t=in:st=0:d=0.6,afade=t=out:st=2:d=0.5[a]" `
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 $introMp4 2>$null
Assert-Ok 'intro'
Write-Host "  intro -> seg_00_intro.mp4"

# Sahne segmentleri: video + (varsa) overlay; diyalog sesi korunur
$i = 1
foreach ($s in $scenes) {
  $seg = Join-Path $tmp ("seg_{0:D2}.mp4" -f $i)
  if ($s.ov) {
    & ffmpeg -y -loglevel error -nostats -i (Join-Path $vid $s.v) -i (Join-Path $card $s.ov) `
      -filter_complex "[0:v]scale=${W}:${H},fps=${FPS},setsar=1[bg];[bg][1:v]overlay=0:0:format=auto[v]" `
      -map "[v]" -map 0:a `
      -t $s.dur -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 $seg 2>$null
  } else {
    & ffmpeg -y -loglevel error -nostats -i (Join-Path $vid $s.v) `
      -vf "scale=${W}:${H},fps=${FPS},setsar=1" `
      -t $s.dur -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 $seg 2>$null
  }
  Assert-Ok ("segment $i")
  Write-Host ("  sahne {0} -> seg_{0:D2}.mp4" -f $i)
  $i++
}

# Outro: PNG + kapanis muziginin son bolumu (fade-out)
$outroMp4 = Join-Path $tmp 'seg_99_outro.mp4'
& ffmpeg -y -loglevel error -nostats -loop 1 -i (Join-Path $card 'outro.png') -i $musicSrc `
  -t 3.5 -r $FPS `
  -filter_complex "[0:v]scale=${W}:${H},format=yuv420p[v];[1:a]atrim=4:7.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=2.7:d=0.8[a]" `
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac -ar 48000 -ac 2 $outroMp4 2>$null
Assert-Ok 'outro'
Write-Host "  outro -> seg_99_outro.mp4"

# ── Segment listesi (sıralı) ──
$segs = @($introMp4)
for ($k = 1; $k -le $scenes.Count; $k++) { $segs += (Join-Path $tmp ("seg_{0:D2}.mp4" -f $k)) }
$segs += $outroMp4
$durs = @(2.5) + ($scenes | ForEach-Object { $_.dur }) + @(3.5)

Write-Host "`n=== Asama 2: Crossfade ile birlestiriliyor ==="

$inputs = @()
foreach ($seg in $segs) { $inputs += @('-i', $seg) }

$n = $segs.Count
$vf = ''; $af = ''
$prevV = '[0:v]'; $prevA = '[0:a]'
$offset = 0.0
for ($k = 1; $k -lt $n; $k++) {
  $offset = $offset + $durs[$k-1] - $XF
  $offStr = $offset.ToString([System.Globalization.CultureInfo]::InvariantCulture)
  $vf += "$prevV[${k}:v]xfade=transition=fade:duration=${XF}:offset=$offStr[v$k];"
  $af += "$prevA[${k}:a]acrossfade=d=$XF[a$k];"
  $prevV = "[v$k]"; $prevA = "[a$k]"
}
$filter = ($vf + $af).TrimEnd(';')

Write-Host "  $n segment, crossfade=$XF sn"

& ffmpeg -y -loglevel error -nostats @inputs -filter_complex $filter `
  -map $prevV -map $prevA `
  -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 20 -preset medium `
  -c:a aac -b:a 192k -movflags +faststart $out 2>$null
Assert-Ok 'birlestirme'

if (Test-Path $out) {
  $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
  $dur = ffprobe -v error -show_entries format=duration -of csv=p=0 $out 2>$null
  Write-Host "`n[OK] Video uretildi: $out"
  Write-Host "     Boyut: $mb MB, Sure: $dur sn, Format: ${W}x${H} (16:9)"
} else {
  Write-Host "`n[HATA] Video uretilemedi!"
  exit 1
}
