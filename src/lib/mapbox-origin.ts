export interface MapboxRecoveryIssue {
  title: string;
  body: string;
}

export function getMapboxRecoveryIssueForOrigin(
  href: string,
): MapboxRecoveryIssue | null {
  const url = new URL(href);
  const isLocalHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (!isLocalHost) {
    return null;
  }

  if (url.port === "3000") {
    return null;
  }

  return {
    title: "Basemap blocked on this local origin",
    body:
      "This Mapbox token is URL-restricted and local development is currently allowlisted for localhost:3000 only. Run the app on port 3000 or add this exact origin to the token allowlist.",
  };
}
