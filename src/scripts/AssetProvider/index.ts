import type { IAssetProvider } from "./types";
import { httpProvider } from "./httpProvider";
import { portableProvider } from "./portableProvider";

export const AssetProvider: IAssetProvider =
  typeof (globalThis as any).EmbeddedAssets !== "undefined"
    ? portableProvider
    : httpProvider;
