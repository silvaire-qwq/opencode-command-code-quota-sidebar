import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { use as _$use } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
import { Plugin } from "@opencode/plugin/tui";
import { createEffect, createSignal, onCleanup, onMount } from "opentui:runtime-module:solid-js";
import { fetchQuota } from "./quota.js";
const FALLBACK_WIDTH = 34;
const POLL_MS = 30_000;
function trackColor(themeMode) {
  return themeMode === "light" ? "#d4d4d8" : "#4b5563";
}
function clamped(meter) {
  if (!Number.isFinite(meter.percent)) return 0;
  return Math.max(0, Math.min(100, meter.percent));
}
function formatReset(at, now) {
  if (!Number.isFinite(at) || at <= 0) return "";
  const seconds = Math.max(0, Math.round((at - now) / 1000));
  if (seconds <= 0) return "resetting";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}
function formatCredits(value) {
  return value < 10 ? `$${value.toFixed(2)}` : `$${Math.round(value)}`;
}
function barColor(theme, percent) {
  if (percent > 80) return theme.text.feedback.error.base;
  if (percent > 50) return theme.text.feedback.warning.base;
  return theme.text.feedback.success.base;
}
function MeterRow(props) {
  // Props are getters; every derived value stays lazy so the row keeps
  // repainting when the poll lands or the countdown ticks.
  const percent = () => clamped(props.meter);
  const total = () => Math.max(1, props.width);
  const used = () => {
    const value = percent();
    const width = total();
    return value > 0 ? Math.min(width, Math.max(1, Math.round(value / 100 * width))) : 0;
  };
  const rest = () => Math.max(0, total() - used());
  const reset = () => formatReset(props.meter.resetsAt, props.now);
  const color = () => barColor(props.theme, percent());
  const amount = () => `${formatCredits(props.meter.used)} / ${formatCredits(props.meter.cap)}`;
  return (() => {
    var _el$ = _$createElement("box"),
      _el$2 = _$createElement("box"),
      _el$3 = _$createElement("text"),
      _el$4 = _$createElement("text"),
      _el$5 = _$createElement("box"),
      _el$6 = _$createElement("text"),
      _el$7 = _$createElement("box");
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$7);
    _$setProp(_el$, "flexDirection", "column");
    _$insertNode(_el$2, _el$3);
    _$insertNode(_el$2, _el$4);
    _$insertNode(_el$2, _el$5);
    _$insertNode(_el$2, _el$6);
    _$setProp(_el$2, "flexDirection", "row");
    _$setProp(_el$2, "gap", 1);
    _$insert(_el$3, () => props.label);
    _$insert(_el$4, amount);
    _$setProp(_el$5, "flexGrow", 1);
    _$insert(_el$2, (() => {
      var _c$ = _$memo(() => !!reset());
      return () => _c$() ? (() => {
        var _el$8 = _$createElement("text");
        _$insert(_el$8, () => `(${reset()})`);
        _$effect(_$p => _$setProp(_el$8, "fg", props.theme.text.muted, _$p));
        return _el$8;
      })() : null;
    })(), _el$6);
    _$insert(_el$6, () => `${Math.round(percent())}%`);
    _$setProp(_el$7, "flexDirection", "row");
    _$setProp(_el$7, "height", 1);
    _$setProp(_el$7, "width", "100%");
    _$insert(_el$7, (() => {
      var _c$2 = _$memo(() => used() > 0);
      return () => _c$2() ? (() => {
        var _el$9 = _$createElement("text");
        _$insert(_el$9, () => "━".repeat(used()));
        _$effect(_$p => _$setProp(_el$9, "fg", color(), _$p));
        return _el$9;
      })() : null;
    })(), null);
    _$insert(_el$7, (() => {
      var _c$3 = _$memo(() => rest() > 0);
      return () => _c$3() ? (() => {
        var _el$0 = _$createElement("text");
        _$insert(_el$0, () => "━".repeat(rest()));
        _$effect(_$p => _$setProp(_el$0, "fg", trackColor(props.themeMode), _$p));
        return _el$0;
      })() : null;
    })(), null);
    _$effect(_p$ => {
      var _v$ = props.theme.text.base,
        _v$2 = props.theme.text.muted,
        _v$3 = props.meter.limited ? props.theme.text.feedback.error.base : props.theme.text.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$6, "fg", _v$3, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$;
  })();
}
function Panel(props) {
  const theme = props.ctx.theme;
  const open = () => props.view.open;
  const [quota, setQuota] = createSignal();
  const [now, setNow] = createSignal(Date.now());
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const repaint = () => {
    try {
      props.ctx.renderer.requestRender();
    } catch {
      // the renderer is gone during shutdown
    }
  };

  // Repaint as soon as either signal changes; text updates alone do not
  // always schedule a frame in the host renderer.
  createEffect(() => {
    quota();
    now();
    repaint();
  });
  onMount(() => {
    let disposed = false;
    let busy = false;
    const load = async () => {
      if (busy || disposed) return;
      busy = true;
      try {
        const next = await fetchQuota();
        if (disposed) return;
        if (next) {
          setQuota(next);
          setError("");
          repaint();
        } else if (!quota()) {
          setError("No Command Code key");
        }
      } catch (cause) {
        if (!disposed && !quota()) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        busy = false;
        if (!disposed) setLoading(false);
      }
    };
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const tick = setInterval(() => {
      setNow(Date.now());
      repaint();
    }, 1_000);
    let timer;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 1500);
    };
    const stops = [props.ctx.data.on("session.execution.succeeded", schedule), props.ctx.data.on("session.execution.failed", schedule), props.ctx.data.on("session.execution.interrupted", schedule), props.ctx.data.on("session.step.ended", schedule), props.ctx.data.on("session.idle", schedule)];
    onCleanup(() => {
      disposed = true;
      clearInterval(poll);
      clearInterval(tick);
      if (timer) clearTimeout(timer);
      for (const stop of stops) stop();
    });
  });
  const toggle = () => {
    void props.setView(draft => {
      draft.open = !draft.open;
    }).catch(() => {});
  };
  const summary = () => {
    const data = quota();
    if (!data) return undefined;
    const meters = [data.fiveHour, data.weekly, data.monthly].filter(meter => meter !== null);
    if (!meters.length) return undefined;
    return Math.round(Math.max(...meters.map(clamped)));
  };
  const headline = () => {
    const data = quota();
    if (!data) return "";
    const parts = [];
    if (data.plan) parts.push(data.plan);
    parts.push(`${formatCredits(data.remaining.monthly)} left`);
    return ` (${parts.join(" · ")})`;
  };
  return (() => {
    var _el$1 = _$createElement("box"),
      _el$10 = _$createElement("box"),
      _el$11 = _$createElement("text"),
      _el$12 = _$createElement("text"),
      _el$13 = _$createElement("b");
    _$insertNode(_el$1, _el$10);
    _$use(element => {
      if (!element) return;
      const update = () => {
        const next = (element.width ?? 0) | 0;
        if (!next) return;
        props.setUI(draft => {
          if (draft.width !== next) draft.width = next;
        });
      };
      element.onSizeChange = update;
      queueMicrotask(update);
    }, _el$1);
    _$setProp(_el$1, "flexDirection", "column");
    _$setProp(_el$1, "width", "100%");
    _$insertNode(_el$10, _el$11);
    _$insertNode(_el$10, _el$12);
    _$use(element => {
      if (!element) return;
      const update = () => {
        const next = (element.width ?? 0) | 0;
        if (!next) return;
        props.setUI(draft => {
          if (draft.barWidth !== next) draft.barWidth = next;
        });
      };
      element.onSizeChange = update;
      queueMicrotask(update);
    }, _el$10);
    _$setProp(_el$10, "flexDirection", "row");
    _$setProp(_el$10, "gap", 1);
    _$setProp(_el$10, "width", "100%");
    _$setProp(_el$10, "onMouseDown", toggle);
    _$insert(_el$11, () => open() ? "▼" : "▶");
    _$insertNode(_el$12, _el$13);
    _$insertNode(_el$13, _$createTextNode(`Command Code`));
    _$insert(_el$12, (() => {
      var _c$4 = _$memo(() => !!(!open() && summary() !== undefined));
      return () => _c$4() ? (() => {
        var _el$15 = _$createElement("span");
        _$insert(_el$15, () => ` (${summary()}% used)`);
        _$effect(_$p => _$setProp(_el$15, "style", {
          fg: theme.text.muted
        }, _$p));
        return _el$15;
      })() : null;
    })(), null);
    _$insert(_el$12, (() => {
      var _c$5 = _$memo(() => !!(open() && quota()));
      return () => _c$5() ? (() => {
        var _el$16 = _$createElement("span");
        _$insert(_el$16, headline);
        _$effect(_$p => _$setProp(_el$16, "style", {
          fg: theme.text.muted
        }, _$p));
        return _el$16;
      })() : null;
    })(), null);
    _$insert(_el$1, (() => {
      var _c$6 = _$memo(() => !!!open());
      return () => _c$6() ? null : _$memo(() => _$memo(() => !!(loading() && !quota()))() ? (() => {
        var _el$17 = _$createElement("text");
        _$insertNode(_el$17, _$createTextNode(`Loading…`));
        _$effect(_$p => _$setProp(_el$17, "fg", theme.text.muted, _$p));
        return _el$17;
      })() : _$memo(() => !!(error() && !quota()))() ? (() => {
        var _el$19 = _$createElement("text");
        _$insert(_el$19, error);
        _$effect(_$p => _$setProp(_el$19, "fg", theme.text.feedback.error.base, _$p));
        return _el$19;
      })() : _$memo(() => !!quota())() ? [_$memo(() => _$memo(() => !!quota().fiveHour)() ? _$createComponent(MeterRow, {
        theme: theme,
        get themeMode() {
          return props.ctx.themeMode;
        },
        label: "5h",
        get meter() {
          return quota().fiveHour;
        },
        get width() {
          return props.ui.barWidth || props.ui.width;
        },
        get now() {
          return now();
        }
      }) : null), _$memo(() => _$memo(() => !!quota().weekly)() ? _$createComponent(MeterRow, {
        theme: theme,
        get themeMode() {
          return props.ctx.themeMode;
        },
        label: "Weekly",
        get meter() {
          return quota().weekly;
        },
        get width() {
          return props.ui.barWidth || props.ui.width;
        },
        get now() {
          return now();
        }
      }) : null), _$createComponent(MeterRow, {
        theme: theme,
        get themeMode() {
          return props.ctx.themeMode;
        },
        label: "Monthly",
        get meter() {
          return quota().monthly;
        },
        get width() {
          return props.ui.barWidth || props.ui.width;
        },
        get now() {
          return now();
        }
      })] : (() => {
        var _el$20 = _$createElement("text");
        _$insertNode(_el$20, _$createTextNode(`No Command Code key`));
        _$effect(_$p => _$setProp(_el$20, "fg", theme.text.muted, _$p));
        return _el$20;
      })());
    })(), null);
    _$effect(_p$ => {
      var _v$4 = theme.text.base,
        _v$5 = theme.text.base;
      _v$4 !== _p$.e && (_p$.e = _$setProp(_el$11, "fg", _v$4, _p$.e));
      _v$5 !== _p$.t && (_p$.t = _$setProp(_el$12, "fg", _v$5, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$1;
  })();
}
export default Plugin.define({
  id: "commandcode.quota.sidebar",
  setup(ctx) {
    const [view, setView] = ctx.storage.store("view", {
      initial: {
        open: true
      }
    });
    const [ui, setUI] = ctx.storage.memory("ui", {
      initial: {
        width: FALLBACK_WIDTH,
        barWidth: 0
      }
    });
    const dispose = ctx.ui.slot({
      prepend: "sidebar.content",
      render: () => _$createComponent(Panel, {
        ctx: ctx,
        view: view,
        setView: setView,
        ui: ui,
        setUI: setUI
      })
    });
    return () => dispose();
  }
});