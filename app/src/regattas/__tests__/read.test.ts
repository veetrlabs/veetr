import { retryRegattaRead, regattaReadError } from "../read";
test("retries a dropped connection once", async () => {
  const read=jest.fn().mockRejectedValueOnce(new Error("TypeError: Network request failed")).mockResolvedValue(["race"]);
  expect(await retryRegattaRead(read)).toEqual(["race"]);
  expect(read).toHaveBeenCalledTimes(2);
});
test("persistent network failure stops after two attempts with useful copy", async () => {
  const error=new Error("TypeError: Network request failed");
  const read=jest.fn().mockRejectedValue(error);
  await expect(retryRegattaRead(read)).rejects.toThrow(error);
  expect(read).toHaveBeenCalledTimes(2);
  expect(regattaReadError(error)).toContain("pull down to try again");
});
test("does not retry server rejection or unmounted reads", async () => {
  const read=jest.fn().mockRejectedValue(new Error("Permission denied"));
  await expect(retryRegattaRead(read)).rejects.toThrow("Permission denied");
  expect(read).toHaveBeenCalledTimes(1);
  const gone=jest.fn().mockRejectedValue(new Error("Network request failed"));
  await expect(retryRegattaRead(gone,()=>false)).rejects.toThrow();
  expect(gone).toHaveBeenCalledTimes(1);
});
