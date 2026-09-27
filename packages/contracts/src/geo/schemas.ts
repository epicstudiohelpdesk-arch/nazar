import { z } from "zod";

export const geoPointSchema = z.object({
  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

export type GeoPoint = z.infer<typeof geoPointSchema>;

export const locationUpdateSchema = geoPointSchema.extend({
  cityName: z.string().trim().max(100).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

export type LocationUpdate = z.infer<typeof locationUpdateSchema>;
