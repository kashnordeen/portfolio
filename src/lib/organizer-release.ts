const repository = "https://github.com/kashnordeen/downloads-organizer";
const downloadOptions = [
  { platform: "Windows", label: "Setup (x64)", suffix: "windows-x64-setup.exe" },
  { platform: "Windows", label: "Portable (x64)", suffix: "windows-x64-portable.zip" },
  { platform: "macOS", label: "Apple Silicon", suffix: "macos-arm64-unsigned.dmg" },
  { platform: "macOS", label: "Intel", suffix: "macos-x64-unsigned.dmg" },
  { platform: "Linux", label: "Debian / Ubuntu (x64)", suffix: "linux-x64.deb" },
  { platform: "Linux", label: "Portable (x64)", suffix: "linux-x64-portable.tar.gz" },
];

export type OrganizerRelease = {
  version: string;
  url: string;
  status: "checking" | "latest" | "fallback";
  downloads: { platform: string; label: string; url: string | null }[];
};

export const fallbackOrganizerRelease: OrganizerRelease = {
  version: "v1.0.0", url: `${repository}/releases/tag/v1.0.0`, status: "fallback",
  downloads: downloadOptions.map(({ platform, label, suffix }) => ({
    platform, label, url: `${repository}/releases/download/v1.0.0/DownloadsOrganizer-1.0.0-${suffix}`,
  })),
};

export function parseOrganizerRelease(data: unknown): OrganizerRelease {
  if (!data || typeof data !== "object") throw new Error("Invalid release");
  const release = data as Record<string, unknown>;
  if (typeof release.tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)
    || release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)
    || release.html_url !== `${repository}/releases/tag/${encodeURIComponent(release.tag_name)}`) {
    throw new Error("Invalid stable release");
  }
  const tag = release.tag_name;
  const assets = release.assets;
  return {
    version: tag, url: release.html_url as string, status: "latest",
    downloads: downloadOptions.map(({ platform, label, suffix }) => {
      const name = `DownloadsOrganizer-${tag.replace(/^v/, "")}-${suffix}`;
      const expectedUrl = `${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
      const asset = assets.find(asset => asset && typeof asset === "object" && asset.name === name
        && asset.state === "uploaded" && typeof asset.size === "number" && asset.size > 0
        && asset.browser_download_url === expectedUrl);
      return { platform, label, url: asset ? asset.browser_download_url : null };
    }),
  };
}

export async function fetchOrganizerRelease(): Promise<OrganizerRelease> {
  try {
    const response = await fetch("https://api.github.com/repos/kashnordeen/downloads-organizer/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000), cache: "no-cache",
    });
    if (!response.ok) throw new Error("Release check failed");
    return parseOrganizerRelease(await response.json());
  } catch {
    return fallbackOrganizerRelease;
  }
}
