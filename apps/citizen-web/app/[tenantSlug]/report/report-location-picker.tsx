'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const ZOOM = 16;
const TILE_SIZE = 256;
const DEFAULT_CENTER = { lat: 41.0082, lng: 28.9784 };

type Point = { lat: number; lng: number };
type ReverseGeocodeResponse = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function latLngToWorld(point: Point) {
  const scale = TILE_SIZE * 2 ** ZOOM;
  const sinLat = Math.sin((point.lat * Math.PI) / 180);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function worldToLatLng(x: number, y: number): Point {
  const scale = TILE_SIZE * 2 ** ZOOM;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return { lat, lng };
}

function tileUrl(x: number, y: number) {
  return `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function composeAddress(data: ReverseGeocodeResponse) {
  if (data.display_name?.trim()) return data.display_name.trim();

  const address = data.address ?? {};
  const parts = [
    address.road,
    address.neighbourhood ?? address.suburb ?? address.quarter,
    address.town ?? address.city ?? address.district ?? address.county,
    address.province ?? address.state,
  ].filter((part): part is string => Boolean(part?.trim()));

  return parts.join(', ');
}

export function ReportLocationPicker() {
  const [selected, setSelected] = useState<Point | null>(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [status, setStatus] = useState('Konumunuzu otomatik almaya calisiyoruz.');
  const [isLocating, setIsLocating] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');
  const [addressError, setAddressError] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [accuracyText, setAccuracyText] = useState('');
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const geocodeRequestId = useRef(0);
  const lastAutoAddress = useRef('');
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWorld: { x: number; y: number };
    moved: boolean;
    latestCenter: Point;
  } | null>(null);

  const tiles = useMemo(() => {
    const centerWorld = latLngToWorld(center);
    const centerTileX = Math.floor(centerWorld.x / TILE_SIZE);
    const centerTileY = Math.floor(centerWorld.y / TILE_SIZE);

    return Array.from({ length: 9 }, (_, index) => {
      const dx = (index % 3) - 1;
      const dy = Math.floor(index / 3) - 1;
      const x = centerTileX + dx;
      const y = centerTileY + dy;
      return { x, y, dx, dy, src: tileUrl(x, y) };
    });
  }, [center]);

  function syncAddressInput(address: string) {
    const input = document.getElementById('addressText') as HTMLInputElement | null;
    if (!input) return;

    const currentValue = input.value.trim();
    if (currentValue && currentValue !== lastAutoAddress.current) return;

    input.value = address;
    lastAutoAddress.current = address;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearAutoAddressInput() {
    const input = document.getElementById('addressText') as HTMLInputElement | null;
    if (!input || input.value !== lastAutoAddress.current) return;

    input.value = '';
    lastAutoAddress.current = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function resolveAddress(point: Point) {
    const requestId = geocodeRequestId.current + 1;
    geocodeRequestId.current = requestId;
    setAddressLabel('');
    setAddressError('');
    setIsResolvingAddress(true);

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: formatCoordinate(point.lat),
        lon: formatCoordinate(point.lng),
        'accept-language': 'tr',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
      if (!response.ok) throw new Error('Reverse geocode failed');

      const data = (await response.json()) as ReverseGeocodeResponse;
      const address = composeAddress(data);
      if (!address) throw new Error('Address not found');
      if (geocodeRequestId.current !== requestId) return;

      setAddressLabel(address);
      syncAddressInput(address);
    } catch {
      if (geocodeRequestId.current !== requestId) return;
      setAddressError('Adres otomatik bulunamadi. Lutfen adres tarifini yazin.');
    } finally {
      if (geocodeRequestId.current === requestId) setIsResolvingAddress(false);
    }
  }

  function selectPoint(point: Point, nextStatus: string, options: { moveCenter?: boolean; accuracy?: number } = {}) {
    const shouldMoveCenter = options.moveCenter ?? true;
    if (shouldMoveCenter) setCenter(point);
    setSelected(point);
    setStatus(nextStatus);
    if (typeof options.accuracy === 'number' && Number.isFinite(options.accuracy)) {
      const rounded = Math.max(1, Math.round(options.accuracy));
      setAccuracyText(`Yaklasik hassasiyet: ${rounded} m`);
    }
    void resolveAddress(point);
  }

  function selectFromClientPoint(clientX: number, clientY: number, target: HTMLDivElement) {
    const rect = target.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    const centerWorld = latLngToWorld(center);
    const point = worldToLatLng(centerWorld.x + x - rect.width / 2, centerWorld.y + y - rect.height / 2);

    selectPoint(point, 'Haritadan secilen konum basvuruya eklendi.', { moveCenter: false });
  }

  function startMapDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWorld: latLngToWorld(center),
      moved: false,
      latestCenter: center,
    };
  }

  function moveMapDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) < 3) return;

    const nextCenter = worldToLatLng(drag.startWorld.x - deltaX, drag.startWorld.y - deltaY);
    drag.moved = true;
    drag.latestCenter = nextCenter;
    setIsDraggingMap(true);
    setCenter(nextCenter);
    setStatus('Haritayi kaydirin; pin olay yerinin uzerinde kalsin.');
  }

  function finishMapDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragState.current = null;
    setIsDraggingMap(false);

    if (drag.moved) {
      selectPoint(drag.latestCenter, 'Pin altindaki konum basvuruya eklendi.');
      return;
    }

    selectFromClientPoint(event.clientX, event.clientY, event.currentTarget);
  }

  function useBrowserLocation() {
    if (!navigator.geolocation) {
      setStatus('Tarayici konum izni desteklenmiyor. Haritadaki noktayi tiklayarak secin.');
      return;
    }

    setIsLocating(true);
    setStatus('Konum izni bekleniyor...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        selectPoint(point, 'Konum tahmini alindi. Gerekirse haritayi kaydirip pini olay yerine getirin.', {
          accuracy: position.coords.accuracy,
        });
        setIsLocating(false);
      },
      () => {
        setStatus('Konum alinamadi. Haritadaki noktayi tiklayarak secin veya tekrar deneyin.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    if (autoTried) return;
    setAutoTried(true);
    useBrowserLocation();
  }, [autoTried]);

  function nudgeSelected(deltaLat: number, deltaLng: number) {
    const current = selected ?? center;
    const next = { lat: current.lat + deltaLat, lng: current.lng + deltaLng };
    selectPoint(next, 'Secilen konum hassaslastirildi.');
  }

  return (
    <div className="field location-picker-field">
      <label htmlFor="location-map">Konum</label>
      <div className={`location-picker-card ${selected ? 'location-picker-card-ready' : ''}`}>
        <div className="location-picker-summary">
          <strong>{selected ? 'Konum secildi' : 'Konum bekleniyor'}</strong>
          <span>{isResolvingAddress ? 'Adres bulunuyor...' : status}</span>
          {accuracyText ? <small>{accuracyText}</small> : null}
        </div>
        <button className="cta location-use-button" type="button" onClick={useBrowserLocation} disabled={isLocating}>
          {isLocating ? 'Konum aliniyor...' : selected ? 'Konumu yeniden al' : 'Konumumu kullan'}
        </button>
      </div>
      <input type="hidden" name="latitude" value={selected ? formatCoordinate(selected.lat) : ''} />
      <input type="hidden" name="longitude" value={selected ? formatCoordinate(selected.lng) : ''} />
      <div
        id="location-map"
        className="location-map"
        role="button"
        tabIndex={0}
        aria-label="Haritayi kaydirarak basvuru konumunu sec"
        onPointerDown={startMapDrag}
        onPointerMove={moveMapDrag}
        onPointerUp={finishMapDrag}
        onPointerCancel={() => {
          dragState.current = null;
          setIsDraggingMap(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectPoint(center, 'Harita merkezindeki konum basvuruya eklendi.');
          }
          if (event.key === 'ArrowUp') nudgeSelected(0.0008, 0);
          if (event.key === 'ArrowDown') nudgeSelected(-0.0008, 0);
          if (event.key === 'ArrowLeft') nudgeSelected(0, -0.0008);
          if (event.key === 'ArrowRight') nudgeSelected(0, 0.0008);
        }}
      >
        <div className="location-tile-layer" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={`${tile.x}-${tile.y}`}
              alt=""
              className="location-map-tile"
              src={tile.src}
              style={{
                left: `calc(50% + ${tile.dx * TILE_SIZE}px - ${TILE_SIZE / 2}px)`,
                top: `calc(50% + ${tile.dy * TILE_SIZE}px - ${TILE_SIZE / 2}px)`,
              }}
            />
          ))}
        </div>
        <div className="location-map-focus" aria-hidden="true" />
        <div className={`location-marker ${isDraggingMap ? 'location-marker-dragging' : ''}`} aria-hidden="true" />
      </div>
      <p className="location-map-hint">Haritayi parmaginizla kaydirin; pin olay yerinin tam ustunde kalsin.</p>
      <div className="location-picker-status" aria-live="polite">
        <span>
          {selected
            ? isResolvingAddress
              ? 'Adres bulunuyor...'
              : addressLabel || addressError || 'Secilen nokta kaydedildi. Adres bulunursa burada gosterilecek.'
            : 'Konumu otomatik alamazsak haritaya tiklayarak nokta secin.'}
        </span>
        {selected ? (
          <button
            type="button"
            className="location-clear-button"
            onClick={() => {
              geocodeRequestId.current += 1;
              setSelected(null);
              setAddressLabel('');
              setAddressError('');
              setIsResolvingAddress(false);
              setStatus('Konum secimi temizlendi. Konumumu kullan ile tekrar deneyin.');
              clearAutoAddressInput();
            }}
          >
            Temizle
          </button>
        ) : null}
      </div>
      <small>Konum istege baglidir; nokta secerseniz ekip olay yerine daha hizli yonlenir.</small>
    </div>
  );
}
