import { NextResponse } from "next/server";

/**
 * GET /.well-known/farcaster.json
 *
 * Serves the Farcaster Mini App manifest.
 * accountAssociation fields must be populated after registering at
 * https://miniapps.farcaster.xyz once the app is deployed.
 */
export function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return NextResponse.json({
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    miniapp: {
      version: "1",
      name: "PlotLink",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/og-image.png`,
      buttonTitle: "Open PlotLink",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#E8DFD0",
    },
  });
}
