import { appHref } from "./routes";
import React from "react";
import type { Boat } from "./domain";

export function BoatName({ boat }: { boat: Boat }) {
  return <a href={appHref(`?boat=${boat.id}`)}>{boat.name}</a>;
}
