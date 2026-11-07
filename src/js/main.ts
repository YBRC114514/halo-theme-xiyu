/* Xiyu / 熹屿 — front-end interactions. No framework, no runtime dependencies. */

type SchemeMode = "system" | "light" | "dark";

const root = document.documentElement;
const body = document.body;
const SCHEME_KEY = "azure-isle-scheme";
const VIEW_KEY = "azure-isle-view";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string) =>
  Array.from(document.querySelectorAll<T>(selector));

/* ------------------------------------------------------------------ *
 * Color scheme: server default -> localStorage -> system preference
 * ------------------------------------------------------------------ */
function serverMode(): SchemeMode {
  const value = root.dataset.schemeMode || root.getAttribute("data-color-scheme") || "auto";
  if (value === "light" || value === "dark") return value;
  return "system";
}

function currentMode(): SchemeMode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(SCHEME_KEY);
  } catch (_) {
    /* storage may be blocked */
  }
  if (saved === "system" || saved === "light" || saved === "dark") return saved;
  return serverMode();
}

function modeIcon(mode: SchemeMode): string {
  return mode === "light" ? "#i-sun" : mode === "dark" ? "#i-moon" : "#i-auto";
}

function modeLabel(mode: SchemeMode): string {
  return mode === "light" ? "浅色模式" : mode === "dark" ? "深色模式" : "跟随系统";
}

function applyScheme(mode: SchemeMode, persist: boolean): void {
  const attr = mode === "system" ? "auto" : mode;
  root.setAttribute("data-color-scheme", attr);
  root.dataset.schemeMode = mode;
  root.classList.remove("color-scheme-auto", "color-scheme-light", "color-scheme-dark", "light", "dark");
  root.classList.add("color-scheme-" + attr);
  $$("[data-theme-toggle]").forEach((button) => {
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", modeIcon(mode));
    button.setAttribute("title", `配色：${modeLabel(mode)}（点击切换）`);
    button.setAttribute("aria-label", `切换配色，当前${modeLabel(mode)}`);
  });
  if (persist) {
    try {
      localStorage.setItem(SCHEME_KEY, mode);
    } catch (_) {
      /* ignore */
    }
  }
}

function toggleScheme(): void {
  const order: SchemeMode[] = ["system", "light", "dark"];
  const next = order[(order.indexOf(currentMode()) + 1) % order.length];
  const run = () => applyScheme(next, true);
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !reducedMotion) doc.startViewTransition(run);
  else run();
}

applyScheme(currentMode(), false);
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (currentMode() === "system") applyScheme("system", false);
});

/* ------------------------------------------------------------------ *
 * Navigation: scroll state, active item, drawer, Ctrl+K
 * ------------------------------------------------------------------ */
const header = $(".site-header");
const navPanel = $(".nav-panel");
const navBackdrop = $(".nav-backdrop");

function markActiveMenu(): void {
  // Visual "current page" highlighting is intentionally disabled: on the home
  // page several parent menus with empty/# hrefs all resolved to "/", which
  // painted multiple blue pills at once. Keep the capsule shell and only add
  // an accessible marker on an exact path match.
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  $$<HTMLAnchorElement>(".primary-nav > ul > li > a[href]").forEach((link) => {
    const li = link.closest("li");
    if (li) li.classList.remove("is-active");
    let target = link.getAttribute("href") || "";
    try {
      target = new URL(target, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    } catch (_) {
      link.removeAttribute("aria-current");
      return;
    }
    if (target === path) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function setDrawer(open: boolean): void {
  navPanel?.classList.toggle("is-open", open);
  navBackdrop?.classList.toggle("is-open", open);
  document.body?.classList.toggle("drawer-open", open);
  $$("[data-nav-toggle]").forEach((btn) => btn.setAttribute("aria-expanded", String(open)));
  if (body) body.style.overflow = open ? "hidden" : "";
  /* `html` carries `overflow-x: clip`, which stops the body's overflow from
     propagating to the viewport - so locking the body alone did nothing and the
     page behind the drawer kept scrolling. Lock the root element too. */
  root.classList.toggle("drawer-lock", open);
}

/* The outline lives in the article column on desktop, but there it stacks after
 * the body text on phones and reads as a second, duplicate TOC. Move the very
 * same node into the drawer below the drawer breakpoint so only one exists,
 * and put it back when the viewport grows again. */
const drawerMq = window.matchMedia("(max-width: 900px)");
let tocRefresh: (() => void) | null = null;

function placeToc(): void {
  const toc = $<HTMLElement>(".toc");
  const panel = $<HTMLElement>(".nav-panel");
  if (!toc || !panel) return;
  if (drawerMq.matches) {
    if (toc.parentElement === panel) return;
    let home = $<HTMLElement>("[data-toc-home]");
    if (!home) {
      home = document.createElement("span");
      home.setAttribute("data-toc-home", "");
      home.hidden = true;
      toc.parentElement?.insertBefore(home, toc);
    }
    toc.classList.add("toc-in-drawer");
    /* The outline is the reason the drawer was opened on an article page, so it
       sits at the very top and the site menu follows underneath. */
    panel.insertBefore(toc, panel.firstChild);
  } else {
    const home = $<HTMLElement>("[data-toc-home]");
    if (!home?.parentElement) return;
    toc.classList.remove("toc-in-drawer");
    home.parentElement.insertBefore(toc, home);
    home.remove();
  }
  tocRefresh?.();
}

drawerMq.addEventListener("change", placeToc);

function openSearch(): void {
  const widget = (window as unknown as { SearchWidget?: { open?: () => void } }).SearchWidget;
  if (typeof widget?.open === "function") {
    widget.open();
    return;
  }
  const fallback = $<HTMLElement>("[data-search-fallback]");
  const url = fallback?.dataset.searchFallback;
  if (url) window.location.href = url;
}

document.addEventListener("click", (event) => {
  const target = event.target as Element;
  if (!target) return;
  /* Tapping anything behind the open drawer - the header, the brand capsule,
     the backdrop - closes it instead of following the link underneath. */
  if (
    navPanel?.classList.contains("is-open") &&
    !target.closest(".nav-panel") &&
    !target.closest("[data-nav-toggle]")
  ) {
    event.preventDefault();
    event.stopPropagation();
    setDrawer(false);
    return;
  }
  if (target.closest("[data-theme-toggle]")) {
    event.preventDefault();
    toggleScheme();
    return;
  }
  if (target.closest("[data-search]")) {
    event.preventDefault();
    openSearch();
    return;
  }
  if (target.closest("[data-nav-toggle]")) {
    event.preventDefault();
    setDrawer(!navPanel?.classList.contains("is-open"));
    return;
  }
  if (target.closest("[data-nav-close]") || target === navBackdrop) {
    setDrawer(false);
    return;
  }
  if (target.closest("[data-back-top]")) {
    event.preventDefault();
    const button = target.closest("[data-back-top]") as HTMLElement;
    /* "Back to list" only means something on the home page: there it skips the
       hero and lands on the article grid. Everywhere else the button still just
       scrolls up, which is what readers expect on articles and list pages. */
    const listAnchor = button.dataset.backtopMode === "list" ? $("#post-list") : null;
    if (listAnchor) {
      /* Land exactly under the sticky header so the hero is fully covered. */
      const headerH = header?.offsetHeight || 72;
      const top = listAnchor.getBoundingClientRect().top + window.scrollY - headerH;
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? "auto" : "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setDrawer(false);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});

/* iOS still rubber-bands the page under a scroll-locked body when the touch
   starts on the header, so swallow vertical drags outside the drawer. */
document.addEventListener(
  "touchmove",
  (event) => {
    if (!navPanel?.classList.contains("is-open")) return;
    const target = event.target as Element | null;
    if (target?.closest?.(".nav-panel, .nav-backdrop")) return;
    event.preventDefault();
  },
  { passive: false },
);

markActiveMenu();
setDrawer(false);

/* In "back to list" mode the home page button points down and reads "返回文章
   列表"; every other page falls back to the plain "回到顶部" affordance. */
function markBackTopMode(): void {
  const button = $("[data-back-top]");
  if (!button || button.dataset.backtopMode !== "list") return;
  const onHome = !!$("#post-list");
  const use = button.querySelector("use");
  button.classList.toggle("is-back-list", onHome);
  button.setAttribute("title", onHome ? "返回文章列表" : "回到顶部");
  button.setAttribute("aria-label", onHome ? "返回文章列表" : "回到顶部");
  if (use) use.setAttribute("href", onHome ? "#i-arrow-down" : "#i-arrow-up");
}

markBackTopMode();

let ticking = false;
function onScroll(): void {
  const y = window.scrollY || window.pageYOffset;
  header?.classList.toggle("is-scrolled", y > 24);
  const bar = $(".progress-bar > span") as HTMLElement | null;
  if (bar) {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? Math.min(100, (y / total) * 100) : 0) + "%";
  }
  const backTop = $("[data-back-top]");
  if (backTop) backTop.classList.toggle("is-visible", y > 480);
  ticking = false;
}
window.addEventListener(
  "scroll",
  () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  },
  { passive: true }
);
onScroll();

/* The home banner is pulled up behind the sticky header with --header-h, so the
   variable has to match the *real* header height (it moves with font scaling).
   Measuring once beats hard-coding a value that leaves a pale strip on top. */
function syncHeaderHeight(): void {
  const el = header as HTMLElement | null;
  if (!el) return;
  const h = el.offsetHeight;
  if (h > 0) document.documentElement.style.setProperty("--header-h", `${h}px`);
}
syncHeaderHeight();
window.addEventListener("resize", syncHeaderHeight);

/* ------------------------------------------------------------------ *
 * Staggered reveal: elastic fade-up, the "post loading" animation
 * ------------------------------------------------------------------ */
let revealObserver: IntersectionObserver | null = null;
let revealEnabled = false;

function showReveal(el: HTMLElement, delay = 0): void {
  el.style.setProperty("--reveal-delay", `${delay}ms`);
  el.classList.add("is-visible");
}

function revealAll(): void {
  $$<HTMLElement>("[data-reveal]").forEach((el) => {
    el.style.removeProperty("--reveal-delay");
    el.classList.add("is-visible");
  });
}

/**
 * Let nodes rendered after boot (friends feed cards, "load more" batches)
 * join the very same fade-up sequence the article cards use.
 */
function registerReveal(nodes: HTMLElement[]): void {
  if (!nodes.length) return;
  if (!revealEnabled || !revealObserver || reducedMotion) {
    nodes.forEach((el) => showReveal(el, 0));
    return;
  }
  nodes.forEach((el) => revealObserver!.observe(el));
}

function initReveal(): void {
  const enabled = body?.dataset.showReveal !== "false";
  const items = $$<HTMLElement>("[data-reveal]");
  if (!enabled || reducedMotion || !("IntersectionObserver" in window)) {
    revealEnabled = false;
    revealAll();
    return;
  }
  revealEnabled = true;
  revealObserver = new IntersectionObserver(
    (entries) => {
      let index = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        showReveal(el, Math.min(index++ * 80, 480));
        revealObserver?.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -32px 0px", threshold: 0.05 }
  );
  items.forEach((el) => revealObserver!.observe(el));

  // Screenshot / long-capture tools stitch the whole page without ever
  // scrolling, so off-screen [data-reveal] nodes would stay at opacity:0 and
  // show up as large blank areas. If the visitor never interacted, reveal
  // everything after a short grace period (normal scrolling keeps the effect).
  let interacted = false;
  const markInteracted = () => { interacted = true; };
  ["scroll", "wheel", "touchmove", "keydown", "pointerdown"].forEach((evt) =>
    window.addEventListener(evt, markInteracted, { passive: true, once: true })
  );
  const fallback = () => {
    if (interacted) return;
    if ($$("[data-reveal]:not(.is-visible)").length) {
      revealObserver?.disconnect();
      revealAll();
    }
  };
  window.setTimeout(fallback, 1500);
  // Capture tools may leave the page without ever scrolling; make sure the
  // final state is fully visible when the document is torn down.
  window.addEventListener("pagehide", () => { revealObserver?.disconnect(); revealAll(); });
}

/* ------------------------------------------------------------------ *
 * Table of contents
 * ------------------------------------------------------------------ */
function initToc(): void {
  const content = $(".entry-content");
  const list = $("[data-toc-list]");
  if (!content || !list) return;
  const toc = $<HTMLElement>(".toc");
  const nav = list.closest("nav") as HTMLElement | null;
  // The Halo editor often uses h1 for in-body chapters; include them too.
  const headings = Array.from(content.querySelectorAll<HTMLElement>("h1, h2, h3, h4"));
  if (headings.length < 2) {
    const toc = $(".toc");
    if (toc) toc.remove();
    const layout = $(".article-layout");
    if (layout) layout.classList.add("no-toc");
    return;
  }
  const slug = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const links: HTMLAnchorElement[] = [];
  headings.forEach((heading, i) => {
    if (!heading.id) heading.id = `toc-${i + 1}-${slug(heading.textContent || "")}`;
    const li = document.createElement("li");
    li.className = heading.tagName === "H1" ? "toc-h1" : heading.tagName === "H2" ? "toc-h2" : "toc-h3";
    const a = document.createElement("a");
    a.href = `#${heading.id}`;
    a.textContent = heading.textContent?.trim() || "";
    a.title = a.textContent;
    li.appendChild(a);
    list.appendChild(li);
    links.push(a);
  });
  // The indicator sits inside the scrolling <ul>, so it shares the same
  // coordinate system as the links and stays aligned in very long outlines.
  const indicator = list.querySelector<HTMLElement>(".toc-indicator") ||
    nav?.querySelector<HTMLElement>(".toc-indicator") || null;

  let current = -1;
  let lockUntil = 0;
  let pinned: number | null = null;
  let rafId = 0;
  let followRaf = 0;
  let fastTimer = 0;
  let manualUntil = 0;

  // While the page is scrolling the highlight must sit exactly on the active
  // row; a sliding transition made it trail one or two lines behind.
  const markFast = () => {
    if (!toc) return;
    toc.classList.add("is-fast");
    window.clearTimeout(fastTimer);
    fastTimer = window.setTimeout(() => toc.classList.remove("is-fast"), 150);
  };

  const stopFollow = () => {
    if (followRaf) window.cancelAnimationFrame(followRaf);
    followRaf = 0;
    toc?.classList.remove("is-following");
  };

  // Glide the TOC's own scroll box instead of snapping one row at a time.
  const followTo = (target: number) => {
    if (!nav) return;
    const max = nav.scrollHeight - nav.clientHeight;
    const to = Math.max(0, Math.min(max, Math.round(target)));
    const from = nav.scrollTop;
    if (Math.abs(to - from) < 1) return;
    if (followRaf) window.cancelAnimationFrame(followRaf);
    const duration = Math.min(420, Math.max(150, Math.abs(to - from) * 0.85));
    const start = performance.now();
    toc?.classList.add("is-following");
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      nav.scrollTop = from + (to - from) * eased;
      if (p < 1) {
        followRaf = window.requestAnimationFrame(step);
      } else {
        followRaf = 0;
        toc?.classList.remove("is-following");
      }
    };
    followRaf = window.requestAnimationFrame(step);
  };

  // Keep the active row inside the middle band; never call scrollIntoView,
  // which would also scroll the whole article.
  const ensureVisible = (a: HTMLAnchorElement) => {
    if (!nav || nav.scrollHeight <= nav.clientHeight + 2) return;
    if (performance.now() < manualUntil) return;
    const height = nav.clientHeight;
    const center = a.offsetTop + a.offsetHeight / 2;
    const viewTop = nav.scrollTop;
    const low = viewTop + height * 0.3;
    const high = viewTop + height * 0.7;
    if (center < low || center > high) followTo(center - height * 0.45);
  };

  const setActive = (index: number) => {
    // Idempotent: rewriting the indicator transform on every scroll frame
    // restarts its CSS transition and caused the visible "twitching".
    if (index === current) return;
    current = index;
    const active = links[index];
    if (!active) return;
    links.forEach((a, i) => a.classList.toggle("is-active", i === index));
    if (indicator) {
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translateY(${active.offsetTop}px)`;
      indicator.classList.add("is-ready");
    }
    ensureVisible(active);
  };

  const compute = () => {
    rafId = 0;
    if (performance.now() < lockUntil) return;
    let active = 0;
    headings.forEach((heading, i) => {
      if (heading.getBoundingClientRect().top <= 200) active = i;
    });
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;
    if (atBottom) active = pinned ?? headings.length - 1;
    setActive(active);
  };
  // One frame per scroll burst, instead of queueing an rAF on every event.
  const schedule = () => {
    markFast();
    if (!rafId) rafId = window.requestAnimationFrame(compute);
  };

  links.forEach((a, i) =>
    a.addEventListener("click", () => {
      pinned = i;
      lockUntil = performance.now() + 900;
      setActive(i);
      // Inside the drawer the outline must not stay open over the paragraph
      // the visitor just asked for.
      if (drawerMq.matches) setDrawer(false);
      window.setTimeout(() => {
        lockUntil = 0;
        pinned = null;
        schedule();
      }, 920);
    })
  );
  ["wheel", "touchmove"].forEach((evt) =>
    window.addEventListener(evt, () => { pinned = null; }, { passive: true })
  );
  // Manual TOC scrolling always wins for a moment, so auto-follow never
  // fights the visitor's own wheel or drag.
  if (nav) {
    const pause = () => {
      manualUntil = performance.now() + 1200;
      stopFollow();
    };
    ["wheel", "touchstart", "pointerdown"].forEach((evt) =>
      nav.addEventListener(evt, pause, { passive: true })
    );
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => { current = -1; manualUntil = 0; schedule(); });
  // Re-measure after the outline changes parent (desktop column <-> drawer).
  tocRefresh = () => { current = -1; manualUntil = 0; schedule(); };
  compute();
}

/* ------------------------------------------------------------------ *
 * Article opening animation: card spring + staggered content lines
 * ------------------------------------------------------------------ */
function initArticleReveal(): void {
  const article = $("[data-article-enter]");
  if (!article || reducedMotion) return;
  article.classList.add("is-entering");
  const content = article.querySelector(".entry-content");
  if (content) {
    Array.from(content.children).forEach((el, i) => {
      (el as HTMLElement).style.setProperty("--enter-delay", `${120 + Math.min(i * 45, 420)}ms`);
    });
  }
  $(".toc")?.classList.add("is-entering");
  [$(".post-nav"), $(".comments")].forEach((el, i) => {
    if (!el) return;
    el.classList.add("is-entering");
    el.style.setProperty("--enter-delay", `${180 + i * 90}ms`);
  });
}

/* ------------------------------------------------------------------ *
 * Article summary: character-by-character reveal
 * ------------------------------------------------------------------ */
function initSummaryTyping(): void {
  const card = $<HTMLElement>(".summary-card[data-typing='on']");
  const p = card?.querySelector<HTMLElement>(".summary-text");
  if (!card || !p) return;
  const text = (p.textContent || "").replace(/\s+/g, " ").trim();
  if (!text || reducedMotion) return;

  const configured = Number(card.dataset.typingSpeed || "16");
  const base = Number.isFinite(configured) && configured > 0 ? configured : 16;
  /* A 400-character abstract at 45ms/char would crawl for 18s; compress the
     interval so the whole card finishes within ~2.6s. */
  const step = Math.max(4, Math.min(base, 2600 / text.length));

  /* The full paragraph stays in the flow as a hidden sizer, so the card keeps
     its final height from the first frame and the text below never jumps. */
  const sizer = document.createElement("span");
  sizer.className = "typing-sizer";
  sizer.textContent = text;
  sizer.setAttribute("aria-hidden", "true");
  const live = document.createElement("span");
  live.className = "typing-live";
  live.setAttribute("aria-hidden", "true");

  p.textContent = "";
  p.classList.add("is-typing");
  p.setAttribute("aria-label", text);
  p.append(sizer, live);

  let index = 0;
  const tick = () => {
    index += 1;
    live.textContent = text.slice(0, index);
    if (index < text.length) {
      window.setTimeout(tick, step);
      return;
    }
    p.classList.remove("is-typing");
    p.classList.add("is-typed");
  };
  window.setTimeout(tick, 160);
}

/* ------------------------------------------------------------------ *
 * Code copy, external links, view switch, toast
 * ------------------------------------------------------------------ */
let toastTimer = 0;
function toast(message: string): void {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("is-visible"), 2000);
}

function initCodeCopy(): void {
  if (body?.dataset.codeCopy === "false") return;
  $$<HTMLPreElement>(".entry-content pre").forEach((pre) => {
    if (pre.querySelector(".copy-code")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code";
    button.innerHTML = '<svg class="icon"><use href="#i-copy"></use></svg><span>复制</span>';
    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent || "";
      try {
        await navigator.clipboard.writeText(code);
        const span = button.querySelector("span");
        if (span) span.textContent = "已复制";
        const use = button.querySelector("use");
        if (use) use.setAttribute("href", "#i-check");
        window.setTimeout(() => {
          if (span) span.textContent = "复制";
          if (use) use.setAttribute("href", "#i-copy");
        }, 1800);
      } catch (_) {
        toast("复制失败，请手动选择代码");
      }
    });
    pre.appendChild(button);
  });
}

function initViewSwitch(): void {
  const grid = $("[data-post-grid]");
  if (!grid) return;
  const sw = $("[data-view-switch]");
  let swapTimer = 0;
  const apply = (view: string, animate: boolean) => {
    grid.classList.toggle("is-list", view === "list");
    $$("[data-view]").forEach((btn) => {
      const on = btn.getAttribute("data-view") === view;
      btn.classList.toggle("is-active", on);
      if (on) sw?.style.setProperty("--view-index", btn.getAttribute("data-view-index") || "0");
    });
    if (!animate || reducedMotion) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".post-card"));
    // Phones get a shallower stagger: a 10-step cascade reads as a stall.
    const cap = window.matchMedia("(max-width: 640px)").matches ? 4 : 10;
    cards.forEach((card, i) => card.style.setProperty("--switch-index", String(Math.min(i, cap))));
    grid.classList.remove("is-switching");
    void (grid as HTMLElement).offsetWidth;
    grid.classList.add("is-switching");
    window.clearTimeout(swapTimer);
    // Must outlast the last card's delay + duration, otherwise the class is
    // dropped mid-animation and those cards snap into place.
    swapTimer = window.setTimeout(() => grid.classList.remove("is-switching"), 960);
  };
  let saved = "";
  try {
    saved = localStorage.getItem(VIEW_KEY) || "";
  } catch (_) {
    /* ignore */
  }
  const initial =
    saved || grid.dataset.defaultView || (grid.classList.contains("is-list") ? "list" : "grid");
  apply(initial, false);
  $$("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view") || "grid";
      apply(view, true);
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch (_) {
        /* ignore */
      }
    })
  );
}

/* ------------------------------------------------------------------ *
 * Links page: tabs, copy, apply, random visit, group filter
 * ------------------------------------------------------------------ */
function initLinks(): void {
  const tabs = $$("[data-links-tab]");
  const panels = $$("[data-tab-panel]");
  const tabSwitch = $("[data-tab-switch]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      const name = tab.getAttribute("data-links-tab");
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
      });
      panels.forEach((p) =>
        p.classList.toggle("is-active", p.getAttribute("data-tab-panel") === name)
      );
      tabSwitch?.style.setProperty("--tab-index", tab.getAttribute("data-tab-index") || "0");
    })
  );

  $$("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(value);
        toast("已复制到剪贴板");
      } catch (_) {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        body.appendChild(input);
        input.select();
        const ok = document.execCommand("copy");
        input.remove();
        toast(ok ? "已复制到剪贴板" : "复制失败");
      }
    })
  );

  // "随机访问" is back to the original behaviour: one click, one random link,
  // reusing the exact same jump semantics as a normal link card.
  $$("[data-random-link]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const links = $$<HTMLAnchorElement>(".link-card[href]");
      if (!links.length) {
        toast("暂无可访问的友链");
        return;
      }
      const target = links[Math.floor(Math.random() * links.length)];
      const anchor = document.createElement("a");
      anchor.href = target.href;
      anchor.target = target.getAttribute("target") || "_blank";
      anchor.rel = target.getAttribute("rel") || "noopener noreferrer";
      anchor.style.display = "none";
      body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    })
  );

  const chips = $$<HTMLButtonElement>("[data-link-group]");
  const groups = $$<HTMLElement>(".link-group[data-group]");
  const toolbar = $("[data-chip-switch]");
  const chipIndicator = $<HTMLElement>("[data-chip-indicator]");

  // One pill slides between the group chips instead of each chip flashing
  // its own background, so the switch reads as a single continuous motion.
  const moveChip = (chip: HTMLElement, animate = true) => {
    if (!chipIndicator) return;
    if (!animate) chipIndicator.style.transition = "none";
    chipIndicator.style.width = `${chip.offsetWidth}px`;
    chipIndicator.style.height = `${chip.offsetHeight}px`;
    chipIndicator.style.transform = `translate(${chip.offsetLeft}px, ${chip.offsetTop}px)`;
    toolbar?.classList.add("has-indicator");
    chipIndicator.classList.add("is-ready");
    if (!animate) {
      window.requestAnimationFrame(() => { chipIndicator.style.transition = ""; });
    }
  };
  const activeChip = () => chips.find((c) => c.classList.contains("is-active")) || chips[0];

  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const name = chip.getAttribute("data-link-group") || "";
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      moveChip(chip);
      groups.forEach((g) => {
        const show = !name || g.getAttribute("data-group") === name;
        g.style.display = show ? "" : "none";
        if (!show) return;
        g.classList.remove("is-filtering");
        void g.offsetWidth;
        g.classList.add("is-filtering");
      });
    })
  );
  const initialChip = activeChip();
  if (initialChip) moveChip(initialChip, false);
  window.addEventListener("resize", () => {
    const chip = activeChip();
    if (chip) moveChip(chip, false);
  });
}

/* ------------------------------------------------------------------ *
 * Author page: contribution heatmap built from publish dates
 * ------------------------------------------------------------------ */
function initHeatmap(): void {
  const holder = $("[data-heatmap]");
  if (!holder) return;
  const counts = new Map<string, number>();
  $$("[data-contribution-date]").forEach((el) => {
    const date = el.getAttribute("data-contribution-date") || "";
    if (date) counts.set(date, (counts.get(date) || 0) + 1);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364 - today.getDay());
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const max = Math.max(1, ...Array.from(counts.values()));
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 53 * 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = iso(day);
    const count = counts.get(key) || 0;
    const cell = document.createElement("span");
    cell.className = "heat-cell";
    if (count > 0) {
      const ratio = count / max;
      cell.classList.add(ratio > 0.75 ? "l4" : ratio > 0.5 ? "l3" : ratio > 0.25 ? "l2" : "l1");
    }
    cell.title = count > 0 ? `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 · ${count} 篇` : `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日 · 无更新`;
    fragment.appendChild(cell);
  }
  holder.appendChild(fragment);
  const months = $("[data-heat-months]");
  if (months) {
    /* Chinese month ticks: 1月 … 12月 (no locale dependency). */
    for (let m = 0; m < 12; m++) {
      const span = document.createElement("span");
      span.textContent = `${m + 1}月`;
      months.appendChild(span);
    }
  }
  const total = $("[data-contribution-total]");
  if (total) total.textContent = String(Array.from(counts.values()).reduce((a, b) => a + b, 0));
}

/* ------------------------------------------------------------------ *
 * Fullscreen hero header: the brand fades out and the nav pill glides
 * from the centre of the banner back to its normal slot on scroll.
 * ------------------------------------------------------------------ */
function initHeroHeader(): void {
  const header = $(".site-header");
  const hero = $(".hero.is-fullscreen");
  if (!header || !hero) return;
  const shell = header.querySelector<HTMLElement>(".shell");
  const panel = header.querySelector<HTMLElement>(".nav-panel");
  if (!shell || !panel) return;

  /* offsetLeft/offsetWidth ignore transforms, so the shift stays correct
     whether or not the header is currently in hero-top mode. */
  const measure = () => {
    const shift = shell.offsetLeft + shell.clientWidth / 2 - (panel.offsetLeft + panel.offsetWidth / 2);
    header.style.setProperty("--nav-shift", `${Math.round(shift)}px`);
  };

  let raf = 0;
  const sync = () => {
    raf = 0;
    const atHero = hero.getBoundingClientRect().bottom > header.offsetHeight * 0.6;
    header.classList.toggle("is-hero-top", atHero);
  };
  const schedule = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(sync);
  };

  measure();
  sync();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => { measure(); schedule(); });
}

/* ------------------------------------------------------------------ *
 * Bootstrap
 * ------------------------------------------------------------------ */
function initExternalLinks(): void {
  $$<HTMLAnchorElement>(".entry-content a[href], .link-card[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) {
      a.setAttribute("target", "_blank");
      const rel = a.getAttribute("rel") || "";
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel + " noopener noreferrer").trim());
    }
  });
}

/* ------------------------------------------------------------------ *
 * Footer: running days, site stats and a random-reading link
 * ------------------------------------------------------------------ */
function initFooter(): void {
  const footer = $(".site-footer");
  if (!footer) return;
  type FooterPost = { href: string; title: string; published: string; visit: number; comment: number };
  const posts: FooterPost[] = $$<HTMLElement>(".footer-data span").map((row) => ({
    href: row.dataset.href || "",
    title: row.dataset.title || "",
    published: row.dataset.published || "",
    visit: Number(row.dataset.visit || 0),
    comment: Number(row.dataset.comment || 0),
  }));
  const format = (value: number) => new Intl.NumberFormat("zh-CN").format(value);
  const counters: HTMLElement[] = [];
  const countTo = (selector: string, value: number) => {
    const el = $<HTMLElement>(selector);
    if (!el) return;
    if (reducedMotion) {
      el.textContent = format(value);
      return;
    }
    el.dataset.countTarget = String(value);
    el.textContent = "0";
    counters.push(el);
  };
  let countersDone = false;
  const runCounters = () => {
    if (countersDone) return;
    countersDone = true;
    counters.forEach((el) => {
      const target = Number(el.dataset.countTarget || 0);
      const startAt = performance.now();
      const duration = 1100;
      const tick = (now: number) => {
        const p = Math.min(1, (now - startAt) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(Math.round(target * eased));
        if (p < 1) window.requestAnimationFrame(tick);
        else el.textContent = format(target);
      };
      window.requestAnimationFrame(tick);
    });
    counters.length = 0;
  };
  if (posts.length) {
    countTo("[data-stat-posts]", posts.length);
    countTo("[data-stat-visits]", posts.reduce((sum, p) => sum + p.visit, 0));
    countTo("[data-stat-comments]", posts.reduce((sum, p) => sum + p.comment, 0));
    const configured = footer.getAttribute("data-start-date") || "";
    const dates = posts
      .map((p) => p.published)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    const start = /^\d{4}-\d{2}-\d{2}$/.test(configured) ? configured : dates[0] || "";
    if (start) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const begin = new Date(`${start}T00:00:00`);
      const days = Math.max(1, Math.floor((now.getTime() - begin.getTime()) / 86400000) + 1);
      countTo("[data-running-days]", days);
    }
  }
  // Roll the numbers up only once the footer is actually on screen, so the
  // animation still has something to show when a visitor scrolls down.
  if (!reducedMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          runCounters();
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(footer);
    window.addEventListener("beforeprint", runCounters);
  } else runCounters();
}

/* ------------------------------------------------------------------ *
 * Friends page: Halo OFFICIAL Links plugin RSS feed endpoint.
 * GET /apis/api.link.halo.run/v1alpha1/linkfeeds (anonymous, cursor based).
 * No dependency on the third-party plugin-friends / friendFinder.
 * ------------------------------------------------------------------ */
type FeedItem = Record<string, any>;

function initFriendsFeed(): void {
  const feed = $("[data-friend-feed]");
  if (!feed) return;
  const API = "/apis/api.link.halo.run/v1alpha1/linkfeeds";
  const LIMIT = 12;
  const hint = $("[data-friend-hint]");
  const empty = $<HTMLElement>("[data-friend-empty]");
  const emptyText = $("[data-friend-empty-text]");
  const moreWrap = $<HTMLElement>("[data-friend-more-wrap]");
  const moreBtn = $<HTMLButtonElement>("[data-friend-more]");
  let cursorPublished = "";
  let cursorId = "";
  let loading = false;
  let total = 0;

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => {
      const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[c] || c;
    });
  const day = (raw: unknown) => {
    const match = String(raw || "").match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  };
  const card = (item: FeedItem) => {
    const el = document.createElement("article");
    el.className = "friend-card";
    // Join the same reveal sequence the article cards use.
    el.setAttribute("data-reveal", "");
    const title = String(item.title || "未命名文章");
    const url = String(item.url || "#");
    const author = String(item.author || "友站");
    const authorUrl = String(item.authorUrl || "");
    const logo = String(item.authorLogo || "");
    const summary = String(item.summary || "");
    const date = day(item.publishedAt);
    el.innerHTML = `
      <h2 class="friend-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></h2>
      ${summary ? `<p class="friend-desc">${esc(summary)}</p>` : ""}
      <div class="friend-foot">
        <span class="friend-logo">${logo
          ? `<img src="${esc(logo)}" alt="${esc(author)}" loading="lazy" />`
          : `<span>${esc(author.charAt(0))}</span>`}</span>
        ${authorUrl
          ? `<a href="${esc(authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(author)}</a>`
          : `<span>${esc(author)}</span>`}
        ${date ? `<time class="friend-date">${date}</time>` : ""}
      </div>`;
    return el;
  };
  const showEmpty = (text: string) => {
    if (emptyText) emptyText.textContent = text;
    empty?.removeAttribute("hidden");
  };

  async function load(append: boolean) {
    if (loading) return;
    loading = true;
    moreBtn?.setAttribute("disabled", "");
    moreBtn?.classList.add("is-loading");
    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (append && cursorPublished && cursorId) {
        params.set("beforePublishedAt", cursorPublished);
        params.set("beforeId", cursorId);
      }
      const res = await fetch(`${API}?${params}`, {
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) {
        if (!total) {
          showEmpty("站主尚未开启「公开 RSS 订阅动态」。请在 Halo 后台 → 链接插件设置 → RSS 订阅中开启。");
          if (hint) hint.textContent = "暂无数据";
        }
        moreWrap?.setAttribute("hidden", "");
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const items: FeedItem[] = Array.isArray(data.items) ? data.items : [];
      if (!append && !items.length) {
        showEmpty("还没有抓取到订阅内容，请在友链的 RSS 设置里填写订阅地址并等待同步。");
      } else empty?.setAttribute("hidden", "");
      const added = items.map((item) => card(item));
      added.forEach((el) => feed.appendChild(el));
      registerReveal(added);
      total += items.length;
      cursorPublished = String(data.nextBeforePublishedAt || "");
      cursorId = String(data.nextBeforeId || "");
      if (hint) hint.textContent = `已加载 ${total} 条${data.hasNext ? " · 还有更多" : ""}`;
      if (data.hasNext && cursorPublished && cursorId) moreWrap?.removeAttribute("hidden");
      else moreWrap?.setAttribute("hidden", "");
    } catch (_) {
      if (!total) {
        showEmpty("订阅动态读取失败，请稍后刷新重试。");
        if (hint) hint.textContent = "读取失败";
      } else if (hint) hint.textContent = `已加载 ${total} 条 · 加载更多失败`;
    } finally {
      loading = false;
      moreBtn?.removeAttribute("disabled");
      moreBtn?.classList.remove("is-loading");
    }
  }
  moreBtn?.addEventListener("click", () => void load(true));
  void load(false);
}

/* ------------------------------------------------------------------ *
 * Link application: Halo official Links plugin REST API + CAPTCHA.
 * POST /link-applications/captcha  -> { challengeId, image }
 * POST /link-applications           -> 201 { id, status }
 * ------------------------------------------------------------------ */
function initLinkApplication(): void {
  const dialog = $<HTMLDialogElement>("[data-apply-dialog]");
  const form = $<HTMLFormElement>("[data-apply-form]");
  const trigger = $("[data-link-apply]");
  if (!dialog || !form || !trigger) return;
  const API = "/apis/api.link.halo.run/v1alpha1";
  const captchaImg = $<HTMLImageElement>("[data-apply-captcha]");
  const message = $<HTMLElement>("[data-apply-message]");
  const submit = $<HTMLButtonElement>("[data-apply-submit]");
  let challengeId = "";

  const say = (text: string, error = false) => {
    if (!message) return;
    message.textContent = text;
    message.classList.toggle("is-error", error);
    message.removeAttribute("hidden");
  };
  const clearSay = () => message?.setAttribute("hidden", "");

  async function refreshCaptcha(clearMessage = true) {
    try {
      const res = await fetch(`${API}/link-applications/captcha`, {
        method: "POST",
        credentials: "omit",
      });
      if (res.status === 404) {
        say("站点尚未开启友链申请，请联系站主。", true);
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      challengeId = String(data.challengeId || "");
      if (captchaImg) {
        const image = String(data.image || "");
        captchaImg.src = image;
        captchaImg.hidden = !image;
      }
      if (clearMessage) clearSay();
    } catch (_) {
      say("验证码加载失败，请点击刷新重试。", true);
    }
  }

  let closing = false;
  const openDialog = () => {
    if (dialog.open) return;
    closing = false;
    dialog.classList.remove("is-closing");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    void refreshCaptcha();
  };
  const closeDialog = () => {
    if (!dialog.open || closing) return;
    if (reducedMotion) {
      dialog.close();
      return;
    }
    closing = true;
    dialog.classList.add("is-closing");
    const finish = () => {
      if (!closing) return;
      closing = false;
      dialog.classList.remove("is-closing");
      dialog.close();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== dialog || event.animationName !== "apply-dialog-out") return;
      dialog.removeEventListener("animationend", onEnd);
      finish();
    };
    dialog.addEventListener("animationend", onEnd);
    // Safety net for browsers that skip animationend (hidden tab, reduced GPU).
    window.setTimeout(finish, 340);
  };

  trigger.addEventListener("click", () => {
    if (trigger.getAttribute("data-apply-enabled") === "true") {
      openDialog();
      return;
    }
    const legacy = (window as unknown as { LinksSubmit?: { openLinksSubmitOverlay?: () => void } }).LinksSubmit;
    if (legacy?.openLinksSubmitOverlay) {
      legacy.openLinksSubmitOverlay();
      return;
    }
    const url = trigger.getAttribute("data-apply-url");
    if (url) window.location.href = url;
    else toast("请先在链接插件设置中开启「启用友链申请」");
  });
  $("[data-apply-close]")?.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  // Some environments (and synthetic key events) skip the dialog close
  // request, so handle Escape on the element as well.
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("close", () => {
    closing = false;
    dialog.classList.remove("is-closing");
  });
  $("[data-apply-captcha-refresh]")?.addEventListener("click", () => void refreshCaptcha());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!challengeId) {
      say("验证码尚未就绪，请刷新后重试。", true);
      return;
    }
    const fd = new FormData(form);
    const str = (key: string) => String(fd.get(key) || "").trim();
    const optional = (key: string) => str(key) || undefined;
    const body = {
      url: str("url"),
      displayName: str("displayName"),
      logo: optional("logo"),
      description: optional("description"),
      email: optional("email"),
      backlink: optional("backlink"),
      feedUrls: str("feedUrls").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      challengeId,
      captchaCode: str("captchaCode"),
    };
    if (submit) submit.disabled = true;
    try {
      const res = await fetch(`${API}/link-applications`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 201) {
        say("申请已提交，等待站主审核，谢谢！");
        form.reset();
      } else {
        let detail = "提交失败，请检查填写内容后重试";
        try {
          const problem = await res.json();
          detail = problem.detail || detail;
        } catch (_) { /* keep default */ }
        say(detail, true);
      }
    } catch (_) {
      say("网络异常，请稍后重试。", true);
    } finally {
      if (submit) submit.disabled = false;
      // The challenge is single-use: always fetch a fresh one, but keep the
      // success/error message from the submission on screen.
      await refreshCaptcha(false);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Steam page: optional playtime heatmap, rendered from the plugin REST
 * endpoint (/apis/api.steam.timxs.com/v1alpha1/heatmap/records).
 * ------------------------------------------------------------------ */
function initSteamHeatmap(): void {
  const box = $<HTMLElement>("[data-steam-heatmap]");
  const holder = $<HTMLElement>("[data-steam-chart]");
  if (!box || !holder) return;
  const tip = $("[data-steam-tip]");
  const days = Math.max(7, Number(box.dataset.days || 30));
  const cdn = box.dataset.echarts || "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const draw = (map: Record<string, number>) => {
    const echarts = (window as unknown as { echarts?: any }).echarts;
    if (!echarts) {
      if (!cdn) {
        if (tip) tip.textContent = "热力图组件未加载。";
        return;
      }
      const script = document.createElement("script");
      script.src = cdn;
      script.onload = () => draw(map);
      script.onerror = () => { if (tip) tip.textContent = "热力图脚本加载失败，可稍后刷新重试。"; };
      document.head.appendChild(script);
      return;
    }
    const labels: string[] = [];
    const values: number[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = iso(day);
      labels.push(key.slice(5));
      values.push(map[key] || 0);
    }
    const chart = echarts.init(holder);
    chart.setOption({
      grid: { left: 6, right: 10, top: 18, bottom: 22, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v} 分钟` },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(130,150,170,0.28)" } },
        axisLabel: { color: "#8b9aa9", interval: Math.max(0, Math.ceil(days / 8) - 1) },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(130,150,170,0.14)" } },
        axisLabel: { color: "#8b9aa9" },
      },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 12,
          itemStyle: { borderRadius: [4, 4, 0, 0], color: "#1158d1" },
        },
      ],
    });
    window.addEventListener("resize", () => chart.resize());
    if (tip) tip.textContent = "按天统计的游玩时长（分钟）。";
  };

  const query = new URLSearchParams({
    page: "1",
    size: String(days),
    startDate: iso(start),
    endDate: iso(new Date()),
  });
  fetch(`/apis/api.steam.timxs.com/v1alpha1/heatmap/records?${query}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data: { items?: Array<Record<string, any>> }) => {
      const map: Record<string, number> = {};
      (data.items || []).forEach((raw) => {
        const spec = raw.spec || raw;
        if (!spec || !spec.date) return;
        map[String(spec.date)] = (map[String(spec.date)] || 0) + Number(spec.playtimeMinutes || 0);
      });
      if (!Object.keys(map).length) {
        if (tip) tip.textContent = "最近还没有游玩记录。";
        return;
      }
      draw(map);
    })
    .catch(() => {
      if (tip) tip.textContent = "暂时读不到游玩记录，可能尚未开启时长追踪。";
    });
}

/* ------------------------------------------------------------------ *
 * Header auth entry: "登录" for guests, "个人中心" once signed in.
 * Halo exposes the current user at /apis/api.halo.run/v1alpha1/users/-
 * (401 for anonymous visitors), so no extra plugin is required.
 * ------------------------------------------------------------------ */
function initAuthEntry(): void {
  // The sign-in state lives on the sidebar profile card, not in the header.
  const entries = $$<HTMLAnchorElement>("[data-auth-profile]");
  if (!entries.length) return;

  const apply = (signedIn: boolean, name?: string) => {
    entries.forEach((entry) => {
      const loginHref = entry.dataset.authLoginHref || "/login";
      const userHref = entry.dataset.authUserHref || "/uc";
      const label = entry.querySelector<HTMLElement>("[data-auth-label]");
      const loginText = entry.dataset.authLoginText || label?.textContent || "登录";
      const userText = entry.dataset.authUserText || "个人中心";
      entry.setAttribute("href", signedIn ? userHref : loginHref);
      entry.title = signedIn ? (name ? `${name} · ${userText}` : userText) : loginText;
      entry.setAttribute("aria-label", entry.title);
      entry.classList.toggle("is-user", signedIn);
      if (label) label.textContent = signedIn ? userText : loginText;
    });
  };

  // Anonymous visitors resolve to the hidden `anonymousUser` account, so the
  // presence of a real user name is what tells us the session is signed in.
  const readUser = (data: unknown): { name: string } | null => {
    const payload = data as
      | {
          user?: {
            metadata?: { name?: string; labels?: Record<string, string> };
            spec?: { displayName?: string };
          };
        }
      | null;
    const user = payload?.user;
    if (!user) return null;
    const name = user.metadata?.name || "";
    const hidden = user.metadata?.labels?.["halo.run/hidden-user"] === "true";
    if (!name || hidden || name === "anonymousUser") return null;
    return { name: user.spec?.displayName || name };
  };

  const endpoints = [
    "/apis/api.console.halo.run/v1alpha1/users/-",
    "/apis/api.halo.run/v1alpha1/users/-",
  ];
  const probe = (index: number): Promise<void> => {
    if (index >= endpoints.length) return Promise.resolve();
    return fetch(endpoints[index], {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        const user = readUser(data);
        if (user) apply(true, user.name);
      })
      .catch(() => probe(index + 1));
  };
  // Guests keep the server-rendered "登录" state; only a successful probe
  // promotes the entry, so a blocked request can never flip it wrongly.
  void probe(0);
}

/* ------------------------------------------------------------------ *
 * MBTI card: a chosen type brings its own official title and blurb
 * ------------------------------------------------------------------ */
const MBTI_INFO: Record<string, [string, string, string]> = {
  INFP: ["调停者", "Mediator", "诗意、善良的利他主义者，总是热心地为正当的理由提供帮助。"],
  INFJ: ["提倡者", "Advocate", "安静而神秘，同时鼓舞人心且不知疲倦的理想主义者。"],
  INTP: ["逻辑学家", "Logician", "具有创造力的发明家，对知识有着止不住的渴望。"],
  INTJ: ["建筑师", "Architect", "富有想象力和战略性的思想家，一切皆在计划之中。"],
  ENFP: ["竞选者", "Campaigner", "热情、有创造力、爱社交的自由灵魂，总能找到理由微笑。"],
  ENFJ: ["主人公", "Protagonist", "富有魅力、鼓舞人心的领导者，有使听众着迷的能力。"],
  ENTP: ["辩论家", "Debater", "聪明好奇的思想者，不会放过任何智力上的挑战。"],
  ENTJ: ["指挥官", "Commander", "大胆、富有想象力且意志强大的领导者，总能找到或创造解决方法。"],
  ISFP: ["探险家", "Adventurer", "灵活有魅力的艺术家，时刻准备着探索和体验新鲜事物。"],
  ISFJ: ["守卫者", "Defender", "非常专注而温暖的守护者，时刻准备保护爱着的人们。"],
  ISTP: ["鉴赏家", "Virtuoso", "大胆而实际的实验家，擅长使用各种形式的工具。"],
  ISTJ: ["物流师", "Logistician", "实际且注重事实的个人，可靠性不容怀疑。"],
  ESFP: ["表演者", "Entertainer", "自发的、精力充沛而热情的表演者，生活在他们周围永不无聊。"],
  ESFJ: ["执政官", "Consul", "极有同情心、爱交往、受欢迎的人们，总是热心提供帮助。"],
  ESTP: ["企业家", "Entrepreneur", "聪明、精力充沛、善于感知的人们，真心享受生活在边缘。"],
  ESTJ: ["总经理", "Executive", "出色的管理者，在管理事情或人的方面无与伦比。"],
};

function initMbtiCard(): void {
  const card = $(".mbti-card") as HTMLElement | null;
  if (!card) return;
  const row = card.querySelector<HTMLElement>("[data-mbti-alias-row]");
  const aliasEl = card.querySelector<HTMLElement>("[data-mbti-alias]");
  const descEl = card.querySelector<HTMLElement>("[data-mbti-desc]");
  const put = (el: HTMLElement | null, text: string) => {
    if (!el) return;
    el.textContent = text;
    el.toggleAttribute("hidden", !text);
  };

  if (card.dataset.mbtiCustom === "true") {
    /* Server already printed the custom copy; just drop the empty bits. */
    put(aliasEl, card.dataset.alias || "");
    put(descEl, card.dataset.desc || "");
    if (row) row.toggleAttribute("hidden", !card.dataset.alias);
    return;
  }

  const info = MBTI_INFO[(card.dataset.mbti || "").toUpperCase()];
  if (!info) {
    if (row) row.hidden = true;
    if (descEl) descEl.hidden = true;
    return;
  }
  put(aliasEl, info[0]);
  put(descEl, info[2]);
}

/**
 * Author page: the activity list is trimmed to whatever fits above the MBTI
 * card's natural height, so both columns end on the same baseline. The item
 * cap comes from the server (about.activity_count).
 */
function initActivityPanel(): void {
  const panel = $("[data-activity-panel]") as HTMLElement | null;
  if (!panel) return;
  const list = panel.querySelector<HTMLElement>(".activity-list");
  if (!list) return;
  const items = Array.from(list.children) as HTMLElement[];
  if (!items.length) return;

  const card = $(".mbti-card") as HTMLElement | null;
  const counter = panel.querySelector<HTMLElement>("[data-activity-count]");
  const title = panel.querySelector<HTMLElement>(".panel-title");
  const wide = window.matchMedia("(min-width: 901px)");
  let frame = 0;

  const fit = () => {
    items.forEach((li) => li.removeAttribute("hidden"));

    if (!card || !wide.matches) {
      if (counter) counter.textContent = String(items.length);
      return;
    }

    /* Fold the list away first: the row height then collapses to the card's
       own content height, which is exactly how much room we get. */
    items.forEach((li) => li.setAttribute("hidden", ""));
    const style = getComputedStyle(panel);
    const titleBox = title
      ? title.getBoundingClientRect().height + parseFloat(getComputedStyle(title).marginBottom || "0")
      : 0;
    const avail =
      panel.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - titleBox;

    items.forEach((li) => li.removeAttribute("hidden"));
    let used = 0;
    let shown = 0;
    for (const li of items) {
      const h = li.getBoundingClientRect().height;
      if (shown > 0 && used + h > avail - 1) break;
      used += h;
      shown += 1;
    }
    shown = Math.max(1, Math.min(shown, items.length));
    items.forEach((li, i) => { if (i >= shown) li.setAttribute("hidden", ""); });
    if (counter) counter.textContent = String(shown);
  };

  const schedule = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(fit);
  };

  schedule();
  window.requestAnimationFrame(schedule);
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("load", schedule, { once: true });
  if (document.fonts) document.fonts.ready.then(schedule).catch(() => {});
  if (typeof wide.addEventListener === "function") wide.addEventListener("change", schedule);
}

function boot(): void {
  initHeroHeader();
  initAuthEntry();
  initReveal();
  placeToc();
  initToc();
  initArticleReveal();
  initSummaryTyping();
  initCodeCopy();
  initViewSwitch();
  initLinks();
  initLinkApplication();
  initFriendsFeed();
  initSteamHeatmap();
  initHeatmap();
  initExternalLinks();
  initFooter();
  initMbtiCard();
  initActivityPanel();
  $$("[data-current-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
