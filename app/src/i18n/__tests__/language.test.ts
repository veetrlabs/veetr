import {
  formatNumber,
  i18n,
  locale,
  resolveLanguage,
  resources,
  t,
  translateMessage,
  validPreference,
} from "../index";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

test("selects the first supported phone language and respects explicit overrides", () => {
  expect(resolveLanguage("system", ["cs-CZ", "en-US"])).toBe("cs");
  expect(resolveLanguage("system", ["de-DE", "cs-CZ", "en"])).toBe("cs");
  expect(resolveLanguage("system", ["en-US", "cs-CZ"])).toBe("en");
  expect(resolveLanguage("system", ["hr-HR"])).toBe("en");
  expect(resolveLanguage("system", [])).toBe("en");
  expect(resolveLanguage("en", ["cs-CZ"])).toBe("en");
  expect(resolveLanguage("cs", ["en-US"])).toBe("cs");
  expect(validPreference("invalid")).toBe("system");
  expect(validPreference(null)).toBe("system");
});

test("Czech supports plurals, interpolation and decimal formatting offline", async () => {
  await i18n.changeLanguage("cs");
  expect(t("Settings")).toBe("Nastavení");
  expect(t("{{count}} boat", { count: 1 })).toBe("1 loď");
  expect(t("{{count}} boat", { count: 3 })).toBe("3 lodě");
  expect(t("{{count}} boat", { count: 5 })).toBe("5 lodí");
  expect(t("{{count}} boat", { count: 0 })).toBe("0 lodí");
  expect(t("View {{v0}}", { v0: "Luna & <Sail>" })).toBe(
    "Zobrazit Luna & <Sail>",
  );
  expect(formatNumber(12.5, 1)).toBe("12,5");
  expect(locale()).toBe("cs-CZ");
  expect(t("An untranslated native message")).toBe(
    "An untranslated native message",
  );
});

test("localizes stored errors at presentation without changing raw diagnostics", async () => {
  const original = "Failed to send chunk 3: Unknown error";
  await i18n.changeLanguage("cs");
  expect(translateMessage(original)).toBe(
    "Nepodařilo se odeslat blok 3: Neznámá chyba",
  );
  expect(original).toBe("Failed to send chunk 3: Unknown error");
  expect(translateMessage("Native error 0x12")).toBe("Native error 0x12");
});

test("catalogues cover the same messages and preserve interpolation variables", () => {
  const en = resources.en.translation,
    cs = resources.cs.translation;
  const keys = (value: Record<string, string>) =>
    [
      ...new Set(
        Object.keys(value).map((key) =>
          key.replace(/_(one|few|many|other)$/, ""),
        ),
      ),
    ].sort();
  expect(keys(cs)).toEqual(keys(en));
  for (const [key, value] of Object.entries(cs)) {
    const expected =
      key.replace(/_(one|few|many|other)$/, "").match(/\{\{\w+\}\}/g) ?? [];
    expect(value.trim().length).toBeGreaterThan(0);
    expect((value.match(/\{\{\w+\}\}/g) ?? []).sort()).toEqual(expected.sort());
  }
});

test("every literal translation key used in source exists in the English catalogue", () => {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const ts = require("typescript") as typeof import("typescript");
  const catalogue: Record<string, string> = resources.en.translation;
  const missing: string[] = [];
  function scan(directory: string) {
    for (const name of fs.readdirSync(directory)) {
      const file = path.join(directory, name);
      if (fs.statSync(file).isDirectory()) {
        if (name !== "__tests__" && name !== "i18n") scan(file);
      } else if (/\.tsx?$/.test(name) && !name.includes(".test.")) {
        const source = ts.createSourceFile(
          file,
          fs.readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        );
        function visit(node: import("typescript").Node) {
          if (
            ts.isCallExpression(node) &&
            node.expression.getText(source) === "t"
          ) {
            const key = node.arguments[0];
            if (
              key &&
              ts.isStringLiteral(key) &&
              !catalogue[key.text] &&
              !catalogue[key.text + "_one"]
            )
              missing.push(`${name}: ${key.text}`);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  scan(path.resolve(__dirname, "../.."));
  expect(missing).toEqual([]);
});
