import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

type GeoJsonMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

/**
 * Ray-casting point-in-polygon test for a simple GeoJSON ring.
 * WGS-84 coordinates [lon, lat] — works fine for city-scale polygons.
 */
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isInsidePolygon(lon: number, lat: number, geom: GeoJsonPolygon): boolean {
  const [outer, ...holes] = geom.coordinates;
  if (!pointInRing(lon, lat, outer)) return false;
  for (const hole of holes) {
    if (pointInRing(lon, lat, hole)) return false; // inside a hole = outside the polygon
  }
  return true;
}

function isInsideGeoJson(
  lon: number,
  lat: number,
  geoJson: GeoJsonPolygon | GeoJsonMultiPolygon | object,
): boolean {
  const g = geoJson as { type: string; coordinates: unknown };
  if (g.type === 'Polygon') {
    return isInsidePolygon(lon, lat, geoJson as GeoJsonPolygon);
  }
  if (g.type === 'MultiPolygon') {
    for (const coords of (geoJson as GeoJsonMultiPolygon).coordinates) {
      if (isInsidePolygon(lon, lat, { type: 'Polygon', coordinates: coords })) return true;
    }
  }
  return false;
}

export type NeighborhoodMatch = {
  id: string;
  name: string;
  departmentId: string | null;
};

@Injectable()
export class NeighborhoodRoutingService {
  private readonly logger = new Logger(NeighborhoodRoutingService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Given WGS-84 coordinates, returns the first Neighborhood whose polygon
   * contains the point.  Returns null if no match (or no polygons stored).
   */
  async resolveNeighborhood(
    lat: number,
    lon: number,
    tenantId: string,
  ): Promise<NeighborhoodMatch | null> {
    if (!process.env.ENABLE_GIS_ROUTING || process.env.ENABLE_GIS_ROUTING === 'false') {
      return null; // feature flag off
    }

    // Note: we fetch all active neighborhoods and skip those with null polygons in code
    // (Prisma JSON null filter varies by DB, so we filter in-process instead)
    const neighborhoods = await this.prisma.neighborhood.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, polygonGeoJson: true, departmentId: true },
    });

    for (const n of neighborhoods) {
      if (!n.polygonGeoJson) continue;
      try {
        const geom =
          typeof n.polygonGeoJson === 'string'
            ? (JSON.parse(n.polygonGeoJson) as object)
            : (n.polygonGeoJson as object);
        if (isInsideGeoJson(lon, lat, geom)) {
          return { id: n.id, name: n.name, departmentId: n.departmentId };
        }
      } catch (err) {
        this.logger.warn(`Skipping neighborhood ${n.id}: invalid polygonGeoJson`, err);
      }
    }

    return null;
  }
}
