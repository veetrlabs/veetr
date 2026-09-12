import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceAccess, requireAccount } from "./WorkspaceAccess";
const render = (userId = "", authReady = true, isPublic = false) =>
  renderToStaticMarkup(
    <WorkspaceAccess userId={userId} authReady={authReady} isPublic={isPublic}>
      {isPublic ? (
        <table>
          <caption>Published standings</caption>
        </table>
      ) : (
        <form>
          <input name="series-name" />
          <button>Save series</button>
        </form>
      )}
    </WorkspaceAccess>,
  );
test("signed-out visitors never receive management forms", () => {
  const html = render();
  assert.doesNotMatch(html, /<form|series-name|Save series/);
});
test("session restoration does not flash management forms", () => {
  const html = render("", false);
  assert.match(html, /Restoring your sign-in/);
  assert.doesNotMatch(html, /<form/);
});
test("authenticated sessions unlock the workspace without a connectivity requirement", () =>
  assert.match(render("official"), /Save series/));
test("public standings remain readable without authentication", () => {
  const html = render("", false, true);
  assert.match(html, /Published standings/);
  assert.doesNotMatch(html, /<form/);
});
test("queued mutations fail after sign-out or account switch", () => {
  assert.throws(() => requireAccount("", "official"), /Sign in/);
  assert.throws(() => requireAccount("other", "official"), /Sign in/);
  assert.doesNotThrow(() => requireAccount("official", "official"));
});

test("signed-out visitors can discover published series while management remains hidden", () => {
  const html = renderToStaticMarkup(
    <WorkspaceAccess
      userId=""
      authReady
      isPublic={false}
      publicContent={<h1>Available published series</h1>}
    >
      <form>
        <button>Save series</button>
      </form>
    </WorkspaceAccess>,
  );
  assert.match(html, /Available published series/);
  assert.doesNotMatch(html, /<form|Save series/);
});
test("signed-in officials can browse the public directory without showing management forms", () => {
  const html = renderToStaticMarkup(
    <WorkspaceAccess
      userId="official"
      authReady
      isPublic={false}
      browsingPublic
      publicContent={<h1>Available published series</h1>}
    >
      <form>
        <button>Save series</button>
      </form>
    </WorkspaceAccess>,
  );
  assert.match(html, /Available published series/);
  assert.doesNotMatch(html, /<form|Save series/);
});
