import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWithTimeout, requestErrorMessage } from "./request";

const waiting: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
  const signal = init!.signal!;
  if (signal.aborted) reject(signal.reason);
  else signal.addEventListener("abort", () => reject(signal.reason), {once:true});
});
test("a slow request times out without retrying a mutation", async () => {
  let calls=0;
  await assert.rejects(fetchWithTimeout("https://example.test", {method:"POST",body:"data"},
    (...args) => {calls++;return waiting(...args);}, 5), {name:"TimeoutError"});
  assert.equal(calls,1);
});
test("caller cancellation and Request cancellation remain effective", async () => {
  const caller=new AbortController();
  const pending=fetchWithTimeout("https://example.test", {signal:caller.signal},waiting);
  caller.abort();
  await assert.rejects(pending,{name:"AbortError"});
  await assert.rejects(fetchWithTimeout(new Request("https://example.test",{signal:caller.signal}),{},waiting),{name:"AbortError"});
});
test("successful requests preserve method, headers and body", async () => {
  const result=await fetchWithTimeout("https://example.test", {method:"POST",headers:{apikey:"test"},body:"payload"}, async (_input,init) => {
    assert.equal(init!.method,"POST");assert.equal(init!.body,"payload");
    assert.deepEqual(init!.headers,{apikey:"test"});return new Response("ok");
  });
  assert.equal(await result.text(),"ok");
});
test("network errors are readable, other errors are preserved", () => {
  assert.match(requestErrorMessage({message:"TimeoutError: signal timed out"}),/server took too long/);
  assert.match(requestErrorMessage(new DOMException("Request timed out","TimeoutError")),/server took too long/);
  assert.match(requestErrorMessage(new TypeError("Failed to fetch")),/Check your connection/);
  assert.equal(requestErrorMessage({message:"Revision conflict"}),"Revision conflict");
});
