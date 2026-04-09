import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Starbucks Pitstop",
    short_name: "Pitstop",
    description:
      "Crowdsourced restroom keypad codes for qualifying Starbucks locations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#1f4a3d",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
