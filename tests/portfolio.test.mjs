import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/data/portfolio.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { certifications, technologies, technicalSkillGroups, projects, profile, education } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const releaseSource = await readFile(new URL("../src/lib/organizer-release.ts", import.meta.url), "utf8");
const releaseCompiled = ts.transpileModule(releaseSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { fallbackOrganizerRelease, parseOrganizerRelease, fetchOrganizerRelease } =
  await import(`data:text/javascript;base64,${Buffer.from(releaseCompiled).toString("base64")}`);
const repository = "https://github.com/kashnordeen/downloads-organizer";
const latest = {
  tag_name: "v1.1.0", html_url: `${repository}/releases/tag/v1.1.0`, draft: false, prerelease: false,
  assets: fallbackOrganizerRelease.downloads.map(download => ({
    name: download.url.split("/").at(-1).replace("1.0.0", "1.1.0"),
    browser_download_url: download.url.replaceAll("1.0.0", "1.1.0"), state: "uploaded", size: 100,
  })),
};

test("fallback keeps all six verified release assets in the correct menus", () => {
  assert.equal(new Set(fallbackOrganizerRelease.downloads.map(item => item.url)).size, 6);
  for (const [platform, fileMarker] of [["Windows", "windows-x64"], ["macOS", "macos-"], ["Linux", "linux-x64"]]) {
    const options = fallbackOrganizerRelease.downloads.filter(item => item.platform === platform);
    assert.equal(options.length, 2);
    for (const option of options) {
      const url = new URL(option.url);
      assert.ok(url.pathname.includes(fileMarker));
      assert.equal(url.hostname, "github.com");
      assert.ok(url.pathname.includes("/releases/download/v1.0.0/"));
    }
  }
});

test("a newer stable release updates version and all actual installer URLs", () => {
  const result = parseOrganizerRelease(latest);
  assert.equal(result.version, "v1.1.0");
  assert.equal(result.url, latest.html_url);
  assert.equal(result.status, "latest");
  assert.deepEqual(result.downloads.map(item => item.url), latest.assets.map(asset => asset.browser_download_url));
});

test("missing, incomplete, or foreign builds are unavailable, not guessed or mixed with old files", () => {
  const assets = latest.assets.slice(1).map(asset => ({ ...asset }));
  assets[0].browser_download_url = "https://example.com/installer.dmg";
  assets[1].state = "new";
  assets.push({ name: "SHA256SUMS.txt", browser_download_url: `${repository}/releases/download/v1.1.0/SHA256SUMS.txt`, state: "uploaded", size: 100 });
  const result = parseOrganizerRelease({ ...latest, assets });
  assert.deepEqual(result.downloads.slice(0, 3).map(item => item.url), [null, null, null]);
  assert.equal(result.downloads.filter(item => item.url).length, 3);
  assert.equal(parseOrganizerRelease({ ...latest, assets: [] }).downloads.filter(item => item.url).length, 0);
});

test("drafts, prereleases, and malformed or foreign release metadata are rejected", () => {
  for (const invalid of [null, {}, { ...latest, draft: true }, { ...latest, prerelease: true },
    { ...latest, html_url: "https://example.com/release" }, { ...latest, assets: null }]) {
    assert.throws(() => parseOrganizerRelease(invalid));
  }
});

test("GitHub failures and timeouts return explicitly labeled fallback downloads", async t => {
  for (const failure of [new Response("rate limited", { status: 403 }), new Response("bad json"),
    Response.json({ ...latest, prerelease: true }), new DOMException("Timed out", "TimeoutError")]) {
    const stub = t.mock.method(globalThis, "fetch", async () => {
      if (failure instanceof Error) throw failure;
      return failure;
    });
    assert.deepEqual(await fetchOrganizerRelease(), fallbackOrganizerRelease);
    stub.mock.restore();
  }
  t.mock.method(globalThis, "fetch", async () => Response.json(latest));
  assert.equal((await fetchOrganizerRelease()).version, "v1.1.0");
});

test("toolkit logos resolve and credentials remain image-only public previews", () => {
  for (const name of ["React", "Python", "TypeScript", "Kotlin", "FastAPI", "PyTorch", "PostgreSQL", "Docker"]) {
    assert.ok(technologies.find(tool => tool.name === name)?.icon);
  }
  assert.equal(technicalSkillGroups.length, 6);
  for (const cert of certifications) assert.match(cert.certificateImage, /\.(png|jpe?g|webp)$/i);
});

test("project evidence and resume point to real local assets", async () => {
  assert.equal(new Set(projects.map(project => project.id)).size, 5);
  for (const project of projects) {
    assert.ok(project.problem && project.decision && project.status && project.visualLabel);
    assert.equal(new URL(project.link).protocol, "https:");
    await readFile(new URL(`../public${project.image}`, import.meta.url));
  }
  assert.match(education[0].degree, /^B\.Tech/);
  const resume = await readFile(new URL(`../public${profile.resume}`, import.meta.url));
  assert.equal(resume.subarray(0, 5).toString(), "%PDF-");
  const avatar = await readFile(new URL(`../public${profile.avatar}`, import.meta.url));
  assert.ok(avatar.length < 200000);
});

test("primary text and button colors meet normal-text contrast in both themes", async () => {
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  const luminance = hex => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const selector of [":root", ".dark"]) {
    const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
    const color = name => block.match(new RegExp(`--${name}: (#[a-f0-9]{6})`))[1];
    for (const [a, b] of [[color("primary"), color("primary-fg")], [color("primary"), color("bg")], [color("primary"), color("card")]]) {
      const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
      assert.ok((light + 0.05) / (dark + 0.05) >= 4.5);
    }
  }
});

test("dock uses native buttons with persistent accessible names", async () => {
  const dock = await readFile(new URL("../src/components/ui/dock.tsx", import.meta.url), "utf8");
  assert.match(dock, /<motion\.button\s+type="button"\s+aria-label=\{label\}/);
  assert.doesNotMatch(dock, /aria-haspopup="true"/);
});

test("asChild styles the actual resume link, not a non-clickable wrapper", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
  const moduleUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
  const utils = await readFile(new URL("../src/lib/utils.ts", import.meta.url), "utf8");
  const utilsUrl = moduleUrl(compile(utils).replace('"clsx"', JSON.stringify(import.meta.resolve("clsx"))).replace('"tailwind-merge"', JSON.stringify(import.meta.resolve("tailwind-merge"))));
  const source = await readFile(new URL("../src/components/ui/button.tsx", import.meta.url), "utf8");
  const buttonUrl = moduleUrl(compile(source).replace('"react"', JSON.stringify(import.meta.resolve("react"))).replace('"@/lib/utils"', JSON.stringify(utilsUrl)));
  const { Button } = await import(buttonUrl);
  const html = renderToStaticMarkup(createElement(Button, { asChild: true, variant: "outline" }, createElement("a", { href: profile.resume }, "Resume")));
  assert.match(html, /^<a /);
  assert.ok(html.includes(`href="${profile.resume}"`));
  assert.ok(html.includes("inline-flex"));
  assert.doesNotMatch(html, /<span/);
});
