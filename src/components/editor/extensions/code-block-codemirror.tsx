import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { LanguageDescription, LanguageSupport } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  ArrowDown01Icon,
  Copy01Icon,
  TextWrapIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { mergeAttributes, Node, textblockTypeInputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

// Define supported languages
export const languages = [
  LanguageDescription.of({
    name: "plain",
    alias: ["text"],
    load: async () => new LanguageSupport(markdown().language), // fallback
  }),
  LanguageDescription.of({
    name: "javascript",
    alias: ["js", "jsx"],
    load: async () => javascript(),
  }),
  LanguageDescription.of({
    name: "typescript",
    alias: ["ts", "tsx"],
    load: async () => javascript({ typescript: true }),
  }),
  LanguageDescription.of({
    name: "html",
    alias: ["htm"],
    load: async () => html(),
  }),
  LanguageDescription.of({
    name: "css",
    load: async () => css(),
  }),
  LanguageDescription.of({
    name: "json",
    load: async () => json(),
  }),
  LanguageDescription.of({
    name: "markdown",
    alias: ["md"],
    load: async () => markdown(),
  }),
  LanguageDescription.of({
    name: "python",
    alias: ["py"],
    load: async () => python(),
  }),
  LanguageDescription.of({
    name: "rust",
    alias: ["rs"],
    load: async () => rust(),
  }),
  LanguageDescription.of({
    name: "cpp",
    alias: ["c++", "c"],
    load: async () => cpp(),
  }),
  LanguageDescription.of({
    name: "java",
    load: async () => java(),
  }),
];

/**
 * Compares two strings and finds the minimal change between them.
 */
function computeTextChange(
  previousText: string,
  currentText: string,
): { from: number; to: number; text: string } | null {
  if (previousText === currentText) return null;

  let from = 0;
  let to = previousText.length;
  let currentTo = currentText.length;

  while (
    from < to &&
    previousText.charCodeAt(from) === currentText.charCodeAt(from)
  ) {
    from++;
  }

  while (
    to > from &&
    currentTo > from &&
    previousText.charCodeAt(to - 1) === currentText.charCodeAt(currentTo - 1)
  ) {
    to--;
    currentTo--;
  }

  return { from, to, text: currentText.slice(from, currentTo) };
}

const CodeMirrorComponent = ({
  node,
  getPos,
  editor,
  updateAttributes,
}: NodeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const getPosRef = useRef(getPos);
  const isUpdatingRef = useRef(false);
  const languageLoadIdRef = useRef(0);
  const destroyedRef = useRef(false);

  const uniqueId = useRef(Math.random().toString(36).substring(2, 9)).current;

  // Define compartments within the component to ensure unique instances for each code block
  const { languageConf, lineWrappingConf, themeConf } = useRef({
    languageConf: new Compartment(),
    lineWrappingConf: new Compartment(),
    themeConf: new Compartment(),
  }).current;

  const { theme: currentTheme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    if (currentTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return (currentTheme as "light" | "dark") || "dark";
  });

  useEffect(() => {
    if (currentTheme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () =>
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      mediaQuery.addEventListener("change", handleChange);
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    setResolvedTheme(currentTheme as "light" | "dark");
  }, [currentTheme]);

  const [currentLanguage, setCurrentLanguage] = useState(
    node.attrs.language || "plain",
  );

  // Sync currentLanguage state when node attribute changes (e.g., when switching tabs)
  useEffect(() => {
    const lang = node.attrs.language || "plain";
    setCurrentLanguage((prev: string) => (prev !== lang ? lang : prev));
  }, [node.attrs.language]);

  const [isLineWrapped, setIsLineWrapped] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Keep pos ref updated
  useEffect(() => {
    getPosRef.current = getPos;
  }, [getPos]);

  const loadLanguage = useCallback(
    async (langName: string) => {
      if (!viewRef.current || destroyedRef.current) return;

      // Track this request to handle race conditions
      const loadId = ++languageLoadIdRef.current;

      let lang = languages.find(
        (l) => l.name === langName || l.alias?.includes(langName),
      );

      // Fallback to plain if language not found
      if (!lang) {
        lang = languages.find((l) => l.name === "plain");
      }

      if (lang) {
        try {
          const support = await lang.load();
          // Only apply if this is still the latest request and not destroyed
          if (
            loadId === languageLoadIdRef.current &&
            viewRef.current &&
            !destroyedRef.current
          ) {
            viewRef.current.dispatch({
              effects: languageConf.reconfigure(support),
            });
          }
        } catch (err) {
          console.error(`Failed to load language "${langName}":`, err);
        }
      }
    },
    [languageConf],
  );

  const initialLanguageRef = useRef(currentLanguage);
  const initialContentRef = useRef<string | null>(null);
  if (initialContentRef.current === null) {
    const pos = getPos();
    const actualNode = pos !== undefined ? editor.state.doc.nodeAt(pos) : null;
    // Prefer the actual node content from the editor state over the prop node
    // to avoid transient empty states during attribute updates
    initialContentRef.current = actualNode?.textContent ?? node.textContent;
  }
  const initialThemeRef = useRef(resolvedTheme);

  // Initialize CodeMirror instance
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    // Reset destroyed flag for new instance
    destroyedRef.current = false;

    const initialTheme = initialThemeRef.current;
    const content = initialContentRef.current ?? "";
    const startState = EditorState.create({
      doc: content,
      extensions: [
        keymap.of([...defaultKeymap, indentWithTab]),
        lineNumbers(),
        themeConf.of([
          initialTheme === "dark" ? vscodeDark : vscodeLight,
          EditorView.theme(
            {
              ".cm-scroller": {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                backgroundColor: "var(--card) !important",
                borderRadius: "0.375rem",
              },
              ".cm-gutters": {
                backgroundColor: "var(--muted) !important",
                borderRight: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              },
            },
            { dark: initialTheme === "dark" },
          ),
        ]),
        languageConf.of([]),
        lineWrappingConf.of([]),
        EditorView.updateListener.of((update) => {
          // Skip if component has been destroyed
          if (destroyedRef.current) {
            return;
          }

          if (
            !isUpdatingRef.current &&
            (update.docChanged || update.selectionSet)
          ) {
            const pos = getPosRef.current();
            if (pos === undefined) return;

            const { state, dispatch } = editor.view;
            const pmNode = state.doc.nodeAt(pos);
            if (!pmNode) return;

            // Verify node type to prevent cross-contamination
            if (pmNode.type.name !== "codeBlock") return;

            const start = pos + 1;
            let tr = state.tr;

            if (update.docChanged) {
              const content = update.state.doc.toString();
              const change = computeTextChange(pmNode.textContent, content);

              if (change) {
                tr = tr.insertText(
                  change.text,
                  start + change.from,
                  start + change.to,
                );
              }
            }

            // Selection sync - use tr.doc since doc may have changed
            const anchor = update.state.selection.main.from + start;
            const head = update.state.selection.main.to + start;
            const selection = TextSelection.create(tr.doc, anchor, head);

            // Compare against tr.selection (not state.selection) since doc may have changed
            if (!selection.eq(tr.selection)) {
              tr = tr.setSelection(selection);
            }

            if (tr.docChanged || tr.selectionSet) {
              isUpdatingRef.current = true;
              tr.setMeta("code-mirror-update", true);
              tr.setMeta("addToHistory", true);
              dispatch(tr);
              isUpdatingRef.current = false;
            }
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;
    loadLanguage(initialLanguageRef.current);

    return () => {
      destroyedRef.current = true;
      view.destroy();
      viewRef.current = null;
    };
  }, [editor.view, loadLanguage, languageConf, themeConf, lineWrappingConf]);

  // Handle external content updates (e.g., from TipTap undo/redo)
  useEffect(() => {
    if (!viewRef.current || isUpdatingRef.current || destroyedRef.current)
      return;

    const currentContent = viewRef.current.state.doc.toString();
    if (node.textContent === currentContent) return;

    const change = computeTextChange(currentContent, node.textContent);
    if (change) {
      isUpdatingRef.current = true;
      viewRef.current.dispatch({
        changes: {
          from: change.from,
          to: change.to,
          insert: change.text,
        },
      });
      isUpdatingRef.current = false;
    }
  }, [node.textContent]);

  // Handle line wrapping toggle
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: lineWrappingConf.reconfigure(
          isLineWrapped ? EditorView.lineWrapping : [],
        ),
      });
    }
  }, [isLineWrapped, lineWrappingConf]);

  // Handle theme change
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: themeConf.reconfigure([
          resolvedTheme === "dark" ? vscodeDark : vscodeLight,
          EditorView.theme(
            {
              ".cm-scroller": {
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                backgroundColor: "var(--card) !important",
              },
              ".cm-gutters": {
                backgroundColor: "var(--muted) !important",
                borderRight: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              },
            },
            { dark: resolvedTheme === "dark" },
          ),
        ]),
      });
    }
  }, [resolvedTheme, themeConf]);

  // Handle language change
  useEffect(() => {
    loadLanguage(currentLanguage);
  }, [currentLanguage, loadLanguage]);

  const handleLanguageChange = (value: string) => {
    setCurrentLanguage(value);
    updateAttributes({ language: value });
  };

  const toggleLineWrapping = () => {
    setIsLineWrapped(!isLineWrapped);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <NodeViewWrapper className="code-block" contentEditable={false}>
      <div className="not-prose my-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="code-block-ui flex items-center justify-between border-border border-b bg-muted/50 px-4 py-1">
          <select
            key={`code-block-select-${uniqueId}`}
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-select"
          >
            <button
              type="button"
              className="flex items-center gap-1 focus:outline-none"
            >
              {React.createElement("selectedcontent")}
              <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
            </button>
            {currentLanguage &&
              !languages.some(
                (l) =>
                  l.name === currentLanguage ||
                  l.alias?.includes(currentLanguage),
              ) && (
                <option value={currentLanguage}>
                  {currentLanguage} (unknown)
                </option>
              )}
            {languages.map((lang) => (
              <option key={lang.name} value={lang.name}>
                {lang.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 border-border border-l pl-2">
            <button
              type="button"
              onClick={toggleLineWrapping}
              className={cn(
                "rounded p-1 transition-colors hover:bg-accent",
                isLineWrapped ? "text-primary" : "text-muted-foreground",
              )}
              title="Toggle Line Wrap"
              aria-label="Toggle Line Wrap"
            >
              <HugeiconsIcon icon={TextWrapIcon} size={14} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Copy Code"
              aria-label="Copy Code"
            >
              {copied ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={14}
                  className="text-green-500"
                />
              ) : (
                <HugeiconsIcon icon={Copy01Icon} size={14} />
              )}
            </button>
          </div>
        </div>
        <div ref={containerRef} />
        <NodeViewContent className="hidden" />
      </div>
    </NodeViewWrapper>
  );
};

export const CodeBlockCodeMirror = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element) => {
          return (
            element.getAttribute("data-language") ||
            element.getAttribute("class")?.match(/language-(\S+)/)?.[1] ||
            element.querySelector("code")?.getAttribute("data-language") ||
            element
              .querySelector("code")
              ?.getAttribute("class")
              ?.match(/language-(\S+)/)?.[1]
          );
        },
        renderHTML: (attributes) => {
          if (!attributes.language) {
            return {};
          }

          return {
            class: `language-${attributes.language}`,
            "data-language": attributes.language,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "pre",
        preserveWhitespace: "full",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "pre",
      mergeAttributes(HTMLAttributes),
      ["code", mergeAttributes(HTMLAttributes), 0],
    ];
  },

  addCommands() {
    return {
      setCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.setNode(this.name, attributes);
        },
      toggleCodeBlock:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph", attributes);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```(\S+)?[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1],
        }),
      }),
      textblockTypeInputRule({
        find: /^~~~(\S+)?[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1],
        }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeMirrorComponent, {
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement;
        // Stop events from the CodeMirror editor itself
        if (target?.closest?.(".cm-editor")) {
          return true;
        }
        // Allow events from our UI controls to bubble up so ProseMirror knows they're interactive,
        // but stop events from the wrapper itself if it's not a UI control.
        if (target?.closest?.(".code-block-ui")) {
          return false;
        }
        return true;
      },
      ignoreMutation: () => true,
    });
  },
});
