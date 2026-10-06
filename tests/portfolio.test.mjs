import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/data/portfolio.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { certifications, organizerDownloads, organizerDownloadBase, technologies, technicalSkillGroups, projects, profile, education } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("platform downloads keep all six release assets in the correct menus", () => {
  assert.equal(new Set(organizerDownloads.map(item => item.file)).size, 6);
  for (const [platform, fileMarker] of [["Windows", "windows-x64"], ["macOS", "macos-"], ["Linux", "linux-x64"]]) {
    const options = organizerDownloads.filter(item => item.platform === platform);
    assert.equal(options.length, 2);
    for (const option of options) {
      assert.ok(option.file.includes(fileMarker));
      const url = new URL(`${organizerDownloadBase}${option.file}`);
      assert.equal(url.hostname, "github.com");
      assert.ok(url.pathname.includes("/releases/download/v1.0.0/"));
    }
  }
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
