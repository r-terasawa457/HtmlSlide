/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Image Attributes Extension (TS)
 * ============================================================
 */
import type { MarkedExtension } from "marked";
import { parseAttributes } from "./MarkedExtensionUtils";

interface ImagePluginOptions {
  altTemplate?: string;
}

export function createMarkedImageAttributesPlugin(
  options?: ImagePluginOptions,
): MarkedExtension {
  const config = Object.assign(
    {
      altTemplate: "${imageTitle}の画像",
    },
    options,
  );

  return {
    renderer: {
      image(token: any): string {
        const rawAttrStr = (token.text || "").trim() + " img-fluid";
        const attrsHtml = parseAttributes(rawAttrStr, "class");

        let altText = "";
        if (token.title) {
          altText = config.altTemplate.replaceAll(
            "${imageTitle}",
            token.title.trim(),
          );
        }

        const titleAttr = token.title ? ` title="${token.title.trim()}"` : "";
        return `<img src="${token.href}"${attrsHtml} alt="${altText}"${titleAttr}>`;
      },
    },
  };
}
