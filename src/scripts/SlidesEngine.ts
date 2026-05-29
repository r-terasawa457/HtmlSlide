import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import mathjax3 from "markdown-it-mathjax3";
import ColonBlockPlugin from "./plugins/markdown-it/ColonBlockPlugin";
import SectionBlockPlugin from "./plugins/markdown-it/HrSectionPlugin";

interface MetaData {
  title: string;
  header: string;
  footer: string;
  variables: Record<string, any>;
}

interface VariableContext {
  pageNum: number;
  totalPages: number;
  meta: MetaData;
}

interface SlidesEngineResult {
  html: string;
  title: string;
  meta: MetaData;
}

const mdMeta = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});
mdMeta.use(ColonBlockPlugin);
mdMeta.use(mathjax3);

function parseAttributes(
  str: string | null | undefined,
  defaultAttrName: string,
): string {
  if (!defaultAttrName || typeof defaultAttrName !== "string") {
    throw new Error("[SlidesEngine] defaultAttrName (string) is required.");
  }

  if (!str || typeof str !== "string" || str.trim() === "") {
    return "";
  }

  const attrMap: { class: string[]; style: string[] } = {
    class: [],
    style: [],
  };
  const otherAttrs: string[] = [];
  const tokens =
    str
      .trim()
      .match(
        /[^\s"']+(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')?|[^\s]+/g,
      ) || [];

  tokens.forEach((token) => {
    let key = "";
    let val = "";

    if (token.includes("=")) {
      const eqIndex = token.indexOf("=");
      key = token.substring(0, eqIndex).trim();
      val = token
        .substring(eqIndex + 1)
        .replace(/^['"]|['"]$/g, "")
        .trim();
    } else {
      key = defaultAttrName;
      val = token.trim();
    }

    if (key === "class") {
      attrMap.class.push(...val.split(/\s+/));
    } else if (key === "style") {
      attrMap.style.push(val.endsWith(";") ? val : `${val};`);
    } else {
      otherAttrs.push(`${key}="${val}"`);
    }
  });

  let attrsHtml = "";
  if (attrMap.class.length > 0) {
    attrsHtml += ` class="${attrMap.class.join(" ")}"`;
  }
  if (attrMap.style.length > 0) {
    attrsHtml += ` style="${attrMap.style.join(" ")}"`;
  }
  if (otherAttrs.length > 0) {
    attrsHtml += ` ${otherAttrs.join(" ")}`;
  }

  return attrsHtml;
}

function normalizeHtmlTagName(
  rawHtml: string | null | undefined,
): string | null {
  if (!rawHtml || typeof rawHtml !== "string") return null;
  const match = rawHtml.match(/<([a-zA-Z][a-zA-Z0-9-]*)/);
  return match ? match[1].toLowerCase() : null;
}

function extractTextFromHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}

function renderTokenChildrenContent(token: any): string {
  if (!token || !token.children) return "";
  return token.children.map((child: any) => child.content || "").join("");
}

function createHtmlBlockToken(state: any, content: string): any {
  const token = new state.Token("html_block", "", 0);
  token.content = content;
  token.block = true;
  return token;
}

function setNestedVariable(
  target: Record<string, any>,
  path: string[],
  value: any,
): void {
  let current: Record<string, any> = target;

  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (key === undefined) continue;

    if (
      !Object.prototype.hasOwnProperty.call(current, key) ||
      typeof current[key] !== "object" ||
      current[key] === null
    ) {
      current[key] = {};
    }

    const next: unknown = current[key];
    if (next && typeof next === "object") {
      current = next as Record<string, any>;
    } else {
      return;
    }
  }

  const lastKey = path[path.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
}

function stringifyVariableValue(value: any): string | null {
  if (value == null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(stringifyVariableValue)
      .filter((v) => v != null)
      .join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map(stringifyVariableValue)
      .filter((v) => v != null && v !== "")
      .join(" ");
  }
  return String(value);
}

function resolveVariableValue(
  pathStr: string,
  context: VariableContext,
): string | null {
  const { pageNum, totalPages, meta } = context;
  if (!pathStr) return null;
  if (pathStr === "page-number") return String(pageNum);
  if (pathStr === "page-total") return String(totalPages);
  if (pathStr === "meta.title") return String(meta.title || "");
  if (pathStr === "meta.header") return String(meta.header || "");
  if (pathStr === "meta.footer") return String(meta.footer || "");

  if (pathStr.startsWith("meta.")) {
    const path = pathStr.slice(5).split(".");
    let current: any = meta;
    for (const segment of path) {
      if (
        segment === undefined ||
        current == null ||
        typeof current !== "object"
      )
        return null;
      current = current[segment];
    }
    return stringifyVariableValue(current);
  }

  const path = pathStr.split(".");
  let current: any = meta.variables;
  for (const segment of path) {
    if (segment === undefined || current == null || typeof current !== "object")
      return null;
    current = current[segment];
  }
  return stringifyVariableValue(current);
}

function replaceVariablesInString(value: any, context: VariableContext): any {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([a-zA-Z0-9._-]+)\}/g, (match, varPath) => {
    const resolved = resolveVariableValue(varPath, context);
    return resolved !== null ? resolved : match;
  });
}

function replaceVariablesInAttrs(token: any, context: VariableContext): void {
  if (!token.attrs) return;
  token.attrs = token.attrs.map(([name, value]: [string, string]) => [
    name,
    replaceVariablesInString(value, context),
  ]);
}

function replaceVariablesInToken(
  token: any,
  context: VariableContext,
  md: MarkdownIt,
): void {
  if (token.type === "inline" && typeof token.content === "string") {
    const replaced = replaceVariablesInString(token.content, context);
    if (replaced !== token.content) {
      token.content = replaced;
      const parsed = md.parseInline(replaced, {});
      const inlineToken = parsed.find((t: any) => t.type === "inline");
      if (inlineToken && Array.isArray(inlineToken.children)) {
        token.children = inlineToken.children;
      }
    }
  } else if (typeof token.content === "string") {
    token.content = replaceVariablesInString(token.content, context);
  }

  if (token.children && Array.isArray(token.children)) {
    token.children.forEach((child: any) =>
      replaceVariablesInToken(child, context, md),
    );
  }
  replaceVariablesInAttrs(token, context);
}

function parseMetaSection(metaText: string): MetaData {
  const tokens = mdMeta.parse(metaText, {});
  const lines = metaText.split(/\r?\n/);
  const metaData: MetaData = {
    title: "",
    header: "",
    footer: "",
    variables: {},
  };
  const stack: any[] = [];

  function renderTokenRange(token: any): string {
    if (!token || !token.map) return "";
    const [start, end] = token.map;
    if (start === undefined || end === undefined) return "";
    return mdMeta.render(lines.slice(start, end).join("\n")).trim();
  }

  for (const token of tokens) {
    if (token.type === "colon_block_open") {
      if (stack.length === 0) {
        if (token.tag === "title") {
          stack.push({ type: "title" });
          continue;
        }
        if (token.tag === "header") {
          stack.push({ type: "header", token });
          continue;
        }
        if (token.tag === "footer") {
          stack.push({ type: "footer", token });
          continue;
        }
        stack.push({ type: "variables", path: [token.tag] });
        continue;
      }

      const parent = stack[stack.length - 1];
      if (parent) {
        if (
          parent.type === "header" ||
          parent.type === "footer" ||
          parent.type === "title"
        ) {
          stack.push({ type: "other" });
          continue;
        }
        if (parent.type === "variables") {
          stack.push({ type: "variables", path: [...parent.path, token.tag] });
          continue;
        }
      }
      stack.push({ type: "other" });
      continue;
    }

    if (token.type === "inline") {
      const current = stack[stack.length - 1];
      if (!current) continue;
      if (current.type === "title") {
        if (!metaData.title) {
          metaData.title = token.content.trim();
        }
        continue;
      }
      if (current.type === "variables") {
        const value = token.content.trim();
        if (value !== "") {
          setNestedVariable(metaData.variables, current.path, value);
        }
        continue;
      }
    }

    if (token.type === "colon_block_close") {
      const current = stack.pop();
      if (!current) continue;
      if (current.type === "header" && !metaData.header) {
        metaData.header = renderTokenRange(current.token);
      }
      if (current.type === "footer" && !metaData.footer) {
        metaData.footer = renderTokenRange(current.token);
      }
      continue;
    }

    if (token.type === "html_block") {
      const raw = token.content.trim();
      if (
        !metaData.title &&
        /^<title\b/i.test(raw) &&
        /<\/title>$/i.test(raw)
      ) {
        metaData.title = extractTextFromHtml(raw);
      }
      if (
        !metaData.header &&
        /^<header\b/i.test(raw) &&
        /<\/header>$/i.test(raw)
      ) {
        metaData.header = raw;
      }
      if (
        !metaData.footer &&
        /^<footer\b/i.test(raw) &&
        /<\/footer>$/i.test(raw)
      ) {
        metaData.footer = raw;
      }
    }
  }

  return metaData;
}

function splitMetaSection(markdownText: string): {
  metaText: string;
  contentText: string;
} {
  const lines = markdownText.split(/\r?\n/);
  let separatorIndex = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      separatorIndex = i;
      break;
    }
  }

  if (separatorIndex === -1) {
    return { metaText: "", contentText: markdownText };
  }

  return {
    metaText: lines.slice(0, separatorIndex).join("\n"),
    contentText: lines.slice(separatorIndex + 1).join("\n"),
  };
}

function normalizeHtmlBlockClosures(markdownText: string): string {
  return markdownText.replace(/<\/(header|footer)>\n(?!\n)/gi, "</$1>\n\n");
}

function sectionHasExplicitHeaderFooter(section: any): {
  header: boolean;
  footer: boolean;
} {
  if (!section || !Array.isArray(section.tokens)) {
    return { header: false, footer: false };
  }

  return section.tokens.reduce(
    (acc: { header: boolean; footer: boolean }, token: any) => {
      if (!token || token.level !== 0) return acc;
      if (token.type === "html_block" || token.type === "html_inline") {
        const tagName = normalizeHtmlTagName(token.content);
        if (tagName === "header") acc.header = true;
        if (tagName === "footer") acc.footer = true;
      }
      if (token.type === "colon_block_open") {
        if (token.tag === "header") acc.header = true;
        if (token.tag === "footer") acc.footer = true;
      }
      return acc;
    },
    { header: false, footer: false },
  );
}

export const SlidesEngine = {
  run(markdownText: string): SlidesEngineResult {
    if (!markdownText) {
      return {
        html: '<div class="slides"></div>',
        title: "",
        meta: { title: "", header: "", footer: "", variables: {} },
      };
    }

    markdownText = markdownText.replace(/\r/g, "");
    const { metaText, contentText } = splitMetaSection(markdownText);
    const env = { metaData: parseMetaSection(metaText) };
    const safeContentText = normalizeHtmlBlockClosures(contentText);

    const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

    md.use(ColonBlockPlugin);
    md.use(mathjax3);
    md.use(SectionBlockPlugin, {
      add_section_id: "slide",
      add_classes: ["page"],
      add_data_section_number: false,
      number_start: 1,
      sectionCoreRuleAdditionalHook(ctx: any) {
        ctx.sections.forEach((section: any, index: number) => {
          const normalizedPageNumber = index + 1;
          section.pageNumber = normalizedPageNumber;

          if (
            ctx.options.add_section_id !== false &&
            ctx.options.add_section_id !== null
          ) {
            const prefix =
              typeof ctx.options.add_section_id === "string"
                ? ctx.options.add_section_id
                : "section";
            section.openToken.attrSet(
              "id",
              `${prefix}-${normalizedPageNumber}`,
            );
          }
          if (ctx.options.add_data_section_number) {
            section.openToken.attrSet(
              "data-section-number",
              String(normalizedPageNumber),
            );
          }
        });

        ctx.meta.total_pages = ctx.sections.length;

        ctx.sections.forEach((section: any) => {
          const slotPresence = sectionHasExplicitHeaderFooter(section);
          const tokens: any[] = Array.isArray(section.tokens)
            ? section.tokens.slice()
            : [];
          const headerTokens: any[] = [];
          const footerTokens: any[] = [];

          const extractLeadingHeader = () => {
            let headerOpenIdx = -1;
            let headerCloseIdx = -1;

            for (let i = 0; i < tokens.length; i++) {
              const t = tokens[i];
              if (!t || t.level !== 0) continue;

              if (t.type === "colon_block_open" && t.tag === "header") {
                headerOpenIdx = i;
                for (let j = i + 1; j < tokens.length; j++) {
                  const tj = tokens[j];
                  if (
                    tj &&
                    tj.level === 0 &&
                    tj.type === "colon_block_close" &&
                    tj.tag === "header"
                  ) {
                    headerCloseIdx = j;
                    break;
                  }
                }
                break;
              } else if (
                (t.type === "html_block" || t.type === "html_inline") &&
                normalizeHtmlTagName(t.content) === "header"
              ) {
                headerOpenIdx = i;
                headerCloseIdx = i;
                break;
              }
            }

            if (headerOpenIdx !== -1 && headerCloseIdx !== -1) {
              const slice = tokens.splice(
                headerOpenIdx,
                headerCloseIdx - headerOpenIdx + 1,
              );
              headerTokens.push(...slice);
            }
          };

          const extractTrailingFooter = () => {
            let footerOpenIdx = -1;
            let footerCloseIdx = -1;

            for (let i = tokens.length - 1; i >= 0; i--) {
              const t = tokens[i];
              if (!t || t.level !== 0) continue;

              if (t.type === "colon_block_close" && t.tag === "footer") {
                footerCloseIdx = i;
                for (let j = i - 1; j >= 0; j--) {
                  const tj = tokens[j];
                  if (
                    tj &&
                    tj.level === 0 &&
                    tj.type === "colon_block_open" &&
                    tj.tag === "footer"
                  ) {
                    footerOpenIdx = j;
                    break;
                  }
                }
                break;
              } else if (
                (t.type === "html_block" || t.type === "html_inline") &&
                normalizeHtmlTagName(t.content) === "footer"
              ) {
                footerOpenIdx = i;
                footerCloseIdx = i;
                break;
              }
            }

            if (footerOpenIdx !== -1 && footerCloseIdx !== -1) {
              const slice = tokens.splice(
                footerOpenIdx,
                footerCloseIdx - footerOpenIdx + 1,
              );
              footerTokens.unshift(...slice);
            }
          };

          extractLeadingHeader();
          extractTrailingFooter();

          if (!slotPresence.header && env.metaData.header) {
            headerTokens.unshift(
              createHtmlBlockToken(ctx.state, env.metaData.header),
            );
          }
          if (!slotPresence.footer && env.metaData.footer) {
            footerTokens.push(
              createHtmlBlockToken(ctx.state, env.metaData.footer),
            );
          }

          const newSectionTokens: any[] = [];
          newSectionTokens.push(...headerTokens);
          newSectionTokens.push(
            createHtmlBlockToken(ctx.state, '<div class="content">'),
          );
          newSectionTokens.push(...tokens);
          newSectionTokens.push(createHtmlBlockToken(ctx.state, "</div>"));
          newSectionTokens.push(...footerTokens);

          section.tokens = newSectionTokens;

          const variableContext: VariableContext = {
            pageNum: section.pageNumber,
            totalPages: ctx.meta.total_pages,
            meta: {
              title: env.metaData.title,
              header: env.metaData.header,
              footer: env.metaData.footer,
              variables: env.metaData.variables,
            },
          };

          section.tokens.forEach((token: any) => {
            replaceVariablesInToken(token, variableContext, md);
          });
        });
      },
    });

    md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      if (!token) return "";
      const info = token.info ? token.info.trim() : "";
      const lang = info.split(/\s+/)[0] || "";
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(token.content, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    };

    md.renderer.rules.code_block = (tokens, idx) => {
      const token = tokens[idx];
      if (!token) return "";
      const highlighted = hljs.highlight(token.content, {
        language: "plaintext",
      }).value;
      return `<pre><code class="hljs language-plaintext">${highlighted}</code></pre>\n`;
    };

    md.renderer.rules.image = (tokens, idx) => {
      const token = tokens[idx];
      if (!token) return "";
      const src = token.attrGet("src") || "";
      const title = token.attrGet("title") || "";
      const rawAlt = renderTokenChildrenContent(token).trim();
      const rawAttrStr = `${rawAlt} img-fluid`.trim();
      const attrsHtml = parseAttributes(rawAttrStr, "class");

      let altText = "";
      if (title) {
        altText = `${title.trim()}の画像`;
      }

      const titleAttr = title ? ` title="${title.trim()}"` : "";
      return `<img src="${src}"${attrsHtml} alt="${altText}"${titleAttr}>`;
    };

    const finalHtml = `<div class="slides">\n${md.render(safeContentText, env)}</div>`;

    return {
      html: finalHtml,
      title: env.metaData.title || "",
      meta: env.metaData,
    };
  },
};
