// Use the Google Play app-signing certificate, NOT the EAS upload certificate.
export function GET() {
  const fingerprints = (
    import.meta.env.PUBLIC_ANDROID_APP_LINK_FINGERPRINTS || ""
  )
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (
    fingerprints.some(
      (s: string) => !/^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(s),
    )
  )
    throw new Error("Invalid Android App Links SHA-256 fingerprint");
  return new Response(
    JSON.stringify(
      fingerprints.length
        ? [
            {
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: "com.veetr.app",
                sha256_cert_fingerprints: fingerprints,
              },
            },
          ]
        : [],
    ),
    { headers: { "Content-Type": "application/json" } },
  );
}
