const STORAGE_KEY = "study-tracker-parent-management-tab-v1";
const TAB_IDS = ["study", "academy", "rewards", "family"];

class ParentTabPanel {
  constructor(id, button, panel) {
    this.id = id;
    this.button = button;
    this.panel = panel;
  }

  setActive(active) {
    this.button.setAttribute("aria-selected", String(active));
    this.button.tabIndex = active ? 0 : -1;
    this.panel.hidden = !active;
    this.panel.classList.toggle("active", active);
  }
}

class ParentTabs {
  constructor(root) {
    this.root = root;
    this.items = TAB_IDS.map((id) => new ParentTabPanel(
      id,
      root.querySelector(`[data-parent-panel="${id}"]`),
      document.querySelector(`[data-parent-tab="${id}"]`),
    )).filter((item) => item.button && item.panel);
  }

  select(id, { focus = false } = {}) {
    const selected = this.items.find((item) => item.id === id) || this.items[0];
    if (!selected) return;
    this.items.forEach((item) => item.setActive(item === selected));
    try { localStorage.setItem(STORAGE_KEY, selected.id); } catch {}
    if (focus) selected.button.focus();
    this.root.dispatchEvent(new CustomEvent("parent-tab-changed", { detail: { tab: selected.id } }));
  }

  init() {
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-parent-panel]");
      if (button) this.select(button.dataset.parentPanel);
    });
    this.root.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const current = this.items.findIndex((item) => item.button === document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? this.items.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + this.items.length) % this.items.length;
      this.select(this.items[next].id, { focus: true });
    });
    let saved = "";
    try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch {}
    this.select(saved);
  }
}

class ParentDashboard {
  constructor(root) {
    this.root = root;
    this.tabs = new ParentTabs(root.querySelector(".parent-management-tabs"));
  }

  init() {
    this.tabs.init();
  }
}

export function initParentDashboard() {
  const root = document.querySelector("#parent");
  if (!root?.querySelector(".parent-management-tabs")) return null;
  const dashboard = new ParentDashboard(root);
  dashboard.init();
  return dashboard;
}
