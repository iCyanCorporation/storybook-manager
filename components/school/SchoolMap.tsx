"use client";

import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { School } from "@/types/school";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SchoolMapProps {
  school: School;
}

export function SchoolMap({ school }: SchoolMapProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: "400px", width: "100%" }}>
          <Map
            initialViewState={{
              longitude: school.lon,
              latitude: school.lat,
              zoom: 14,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={{
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                  tileSize: 256,
                  attribution: "&copy; OpenStreetMap",
                },
              },
              glyphs:
                "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
              layers: [
                {
                  id: "osm",
                  type: "raster",
                  source: "osm",
                  paint: {
                    "raster-opacity": 1,
                  },
                },
              ],
            }}
          >
            <Marker longitude={school.lon} latitude={school.lat} color="red" />
          </Map>
        </div>
      </CardContent>
    </Card>
  );
}
