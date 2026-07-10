import { createClient } from "./vendor/supabase-js.js";
import { SUPABASE_CONFIG } from "./config.js";
import { initFamilyChat } from "./family-chat.js";
import { initRewardStore } from "./reward-store.js";

const PARENT_PASSWORD = "1234";
const BUILD_VERSION = "v24";
const LOCAL_DATA_KEY = "study-tracker-local-data-v1";
const LOCAL_NOTIFICATION_KEY = "study-tracker-parent-notifications-v1";
const DEFAULT_REWARD = { goal: 10, name: "5,000원 용돈" };
const DEFAULT_REWARD_MILESTONES = [
  { id: "default-5", stars: 5, name: "아이스크림" },
  { id: "default-20", stars: 20, name: "용돈 5,000원" },
  { id: "default-50", stars: 50, name: "수영장 쿠폰" },
];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const statusLabels = {
  planned: "예정",
  done: "완료",
  late: "지연",
  "예정": "예정",
  "완료": "완료",
  "지연": "지연",
};
const praises = [
  "GOOD!! 너무 잘했어!",
  "GREAT! 하겸이 최고야!",
  "PERFECT! 오늘도 멋지게 성공!",
  "WOW! 스티커 하나 더!",
  "SUPER! 끝까지 해낸 힘이 멋져!",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function normalizeRewardMilestones(milestones, legacyReward) {
  const source = Array.isArray(milestones) && milestones.length
    ? milestones
    : DEFAULT_REWARD_MILESTONES;

  const normalized = source
    .map((item, index) => ({
      id: item.id || `reward-${Date.now()}-${index}`,
      stars: Number(item.stars || item.required_stickers || item.goal || 0),
      name: String(item.name || item.reward_name || "").trim(),
    }))
    .filter((item) => item.stars > 0 && item.name)
    .sort((a, b) => a.stars - b.stars || a.name.localeCompare(b.name, "ko"));

  return normalized.length ? normalized : [...DEFAULT_REWARD_MILESTONES];
}

function readLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) return { reward: { ...DEFAULT_REWARD }, rewardMilestones: [...DEFAULT_REWARD_MILESTONES], stickerCount: 0, plans: [], academySchedules: [], academyCompletions: [] };
    const parsed = JSON.parse(raw);
    return {
      reward: parsed.reward || { ...DEFAULT_REWARD },
      rewardMilestones: normalizeRewardMilestones(parsed.rewardMilestones || parsed.rewards, parsed.reward),
      stickerCount: Number(parsed.stickerCount || 0),
      plans: Array.isArray(parsed.plans) ? parsed.plans : [],
      academySchedules: Array.isArray(parsed.academySchedules) ? parsed.academySchedules : [],
      academyCompletions: Array.isArray(parsed.academyCompletions) ? parsed.academyCompletions : [],
    };
  } catch (error) {
    console.warn("[local fallback] read failed", error);
    return { reward: { ...DEFAULT_REWARD }, rewardMilestones: [...DEFAULT_REWARD_MILESTONES], stickerCount: 0, plans: [], academySchedules: [], academyCompletions: [] };
  }
}

function writeLocalData(data) {
  try {
    localStorage.setItem(
      LOCAL_DATA_KEY,
      JSON.stringify({
        reward: data.reward || { ...DEFAULT_REWARD },
        rewardMilestones: normalizeRewardMilestones(data.rewardMilestones, data.reward),
        stickerCount: Number(data.stickerCount || 0),
        plans: Array.isArray(data.plans) ? data.plans : [],
        academySchedules: Array.isArray(data.academySchedules) ? data.academySchedules : [],
        academyCompletions: Array.isArray(data.academyCompletions) ? data.academyCompletions : [],
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("[local fallback] write failed", error);
  }
}

function writeLocalNotification(entry) {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATION_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    next.unshift(entry);
    localStorage.setItem(LOCAL_NOTIFICATION_KEY, JSON.stringify(next.slice(0, 50)));
  } catch (error) {
    console.warn("[parent notification] local log failed", error);
  }
}

function createSupabaseRepository(config) {
  const apiKey = config.publishableKey || config.anonKey || "";
  const configured = Boolean(config.url && apiKey);
  const requestTimeoutMs = Number(config.requestTimeoutMs || 4500);

  function validateSupabaseUrl(url) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.endsWith(".supabase.in")) {
        console.warn("[Supabase config] URL does not look like a Supabase project URL:", url);
      }
    } catch (error) {
      console.warn("[Supabase config] Invalid Supabase URL:", url, error);
    }
  }

  async function fetchWithTimeout(input, init = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    if (init.signal) {
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      const reason = error?.name === "AbortError" ? `timed out after ${requestTimeoutMs}ms` : error?.message || error;
      throw new Error(`Supabase network request failed: ${reason}`);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (config.url) validateSupabaseUrl(config.url);

  const client = configured
    ? createClient(config.url, apiKey, {
        global: { fetch: fetchWithTimeout },
      })
    : null;

  function assertConfigured() {
    if (!configured) {
      throw new Error("Supabase Project URL과 Publishable Key를 js/config.js에 입력해주세요.");
    }
  }

  async function request(label, promise) {
    const { data, error, count } = await promise;
    if (error) {
      const detail = error.details ? ` (${error.details})` : "";
      throw new Error(`${label}: ${error.message}${detail}`);
    }
    return { data, count };
  }

  function warnReadFallback(label, error) {
    console.warn(`[Supabase fallback] ${label}`, error);
  }

  function warnRealtimeFallback(label, error) {
    console.warn(`[Supabase realtime disabled] ${label}`, error || "");
  }

  async function requestOrFallback(label, promise, fallbackData) {
    try {
      return await request(label, promise);
    } catch (error) {
      warnReadFallback(label, error);
      return { data: fallbackData, count: 0 };
    }
  }

  function sanitizePayload(payload, options = {}) {
    const { keepId = false } = options;
    return Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => {
        if (key === "id" && !keepId) return false;
        return value !== undefined && value !== null && value !== "";
      })
    );
  }

  function planFromRow(row) {
    return {
      id: row.id,
      subject: row.subject,
      book: row.workbook,
      unit: row.chapter,
      lessonNo: row.lesson,
      studyDate: row.study_date,
      dayNo: row.day_label,
      content: row.content,
      target: row.goal,
      status: row.status,
    };
  }

  function normalizeLoadedPlan(item) {
    if (item && "study_date" in item) return planFromRow(item);
    return item;
  }

  function academyScheduleFromRow(row) {
    return {
      id: row.id,
      name: row.academy_name,
      dayOfWeek: Number(row.day_of_week),
      time: row.start_time,
      memo: row.memo || "",
      stars: Number(row.star_count || 1),
    };
  }

  function academyScheduleToRow(schedule) {
    const id = schedule.id && !String(schedule.id).startsWith("local-") ? schedule.id : undefined;
    return sanitizePayload({
      id,
      academy_name: schedule.name,
      day_of_week: Number(schedule.dayOfWeek),
      start_time: schedule.time,
      memo: schedule.memo,
      star_count: Number(schedule.stars || 1),
    });
  }

  function academyCompletionFromRow(row) {
    return {
      id: row.id,
      scheduleId: row.academy_schedule_id,
      completedDate: row.completed_date,
      stars: Number(row.star_count || 1),
    };
  }

  function normalizeLoadedAcademySchedule(item) {
    if (item && "academy_name" in item) return academyScheduleFromRow(item);
    return item;
  }

  function normalizeLoadedAcademyCompletion(item) {
    if (item && "academy_schedule_id" in item) return academyCompletionFromRow(item);
    return item;
  }

  function rowFromPlan(plan) {
    return sanitizePayload({
      id: plan.id || undefined,
      subject: plan.subject,
      workbook: plan.book,
      chapter: plan.unit,
      lesson: plan.lessonNo,
      study_date: plan.studyDate,
      day_label: plan.dayNo,
      content: plan.content,
      goal: plan.target,
      status: plan.status,
    });
  }

  async function ensureRewardSettings() {
    try {
      const { data: settings } = await request(
        "보상 설정 확인 실패",
        client.from("reward_settings").select("id").limit(1).maybeSingle()
      );

      if (!settings) {
        await saveReward(DEFAULT_REWARD);
      }
    } catch (error) {
      warnReadFallback("reward_settings check", error);
    }
  }

  async function load() {
    const localData = readLocalData();
    if (!configured) {
      warnReadFallback("Supabase config is missing. Rendering fallback data.");
      return localData;
    }

    const remoteLoad = (async () => {
    ensureRewardSettings();

    const [
      { data: plans },
      { data: reward },
      { data: rewardMilestones },
      { data: stickers },
      { data: academySchedules },
      { data: academyCompletions },
    ] = await Promise.all([
      requestOrFallback(
        "학습계획 불러오기 실패",
        client.from("study_plans").select("*").order("study_date", { ascending: true }),
        localData.plans
      ),
      requestOrFallback(
        "보상 설정 불러오기 실패",
        client.from("reward_settings").select("*").limit(1).maybeSingle(),
        localData.reward
      ),
      requestOrFallback(
        "보상 마일스톤 불러오기 실패",
        client.from("reward_milestones").select("*").order("required_stickers", { ascending: true }),
        localData.rewardMilestones
      ),
      requestOrFallback(
        "스티커 이력 불러오기 실패",
        client.from("sticker_history").select("sticker_count"),
        []
      ),
      requestOrFallback(
        "학원 일정 불러오기 실패",
        client.from("academy_schedules").select("*").order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
        localData.academySchedules
      ),
      requestOrFallback(
        "학원 완료 이력 불러오기 실패",
        client.from("academy_completion_history").select("*"),
        localData.academyCompletions
      ),
    ]);

    const safePlans = Array.isArray(plans) ? plans : [];
    const safeStickers = Array.isArray(stickers) ? stickers : [];
    const safeAcademySchedules = Array.isArray(academySchedules) ? academySchedules : [];
    const safeAcademyCompletions = Array.isArray(academyCompletions) ? academyCompletions : [];
    const academyStars = safeAcademyCompletions.reduce((sum, item) => sum + Number(item.star_count || item.stars || 0), 0);
    const loadedStickerCount = safeStickers.reduce((sum, sticker) => sum + Number(sticker.sticker_count || 0), 0) + academyStars;

    console.log("Supabase study_plans count:", safePlans.length);
    console.log("Supabase study_plans rows:", safePlans);

    return {
      reward: reward?.target_stickers
        ? { id: reward.id, goal: reward.target_stickers, name: reward.reward_name }
        : reward?.goal
          ? reward
          : { ...DEFAULT_REWARD },
      rewardMilestones: normalizeRewardMilestones(rewardMilestones, reward),
      stickerCount: safeStickers.length || safeAcademyCompletions.length
        ? loadedStickerCount
        : Number(localData.stickerCount || 0),
      plans: safePlans.map(normalizeLoadedPlan),
      academySchedules: safeAcademySchedules.map(normalizeLoadedAcademySchedule),
      academyCompletions: safeAcademyCompletions.map(normalizeLoadedAcademyCompletion),
    };
    })();

    const result = await Promise.race([
      remoteLoad,
      new Promise((resolve) => window.setTimeout(() => resolve(null), requestTimeoutMs)),
    ]);

    if (!result) {
      warnReadFallback(`Supabase load timed out after ${requestTimeoutMs}ms. Rendering local fallback data.`);
      return localData;
    }

    return result;
  }

  async function save(data) {
    assertConfigured();
    await Promise.all([
      saveReward(data.reward),
      Promise.all(data.plans.map((plan) => upsertPlan(plan))),
    ]);
  }

  async function upsertPlan(plan) {
    assertConfigured();
    const payload = rowFromPlan(plan);
    if (plan.id) {
      const { data } = await request(
        "학습계획 수정 실패",
        client.from("study_plans").update(payload).eq("id", plan.id).select("*").single()
      );
      await syncStickerForPlan(data.id, data.status);
      return planFromRow(data);
    }

    const { data } = await request(
      "학습계획 저장 실패",
      client.from("study_plans").insert(payload).select("*").single()
    );
    await syncStickerForPlan(data.id, data.status);
    return planFromRow(data);
  }

  async function deletePlan(id) {
    assertConfigured();
    const planId = /^\d+$/.test(String(id)) ? Number(id) : id;
    await request(
      "연결된 스티커 기록 삭제 실패",
      client.from("sticker_history").delete().eq("study_plan_id", planId)
    );
    await request("학습계획 삭제 실패", client.from("study_plans").delete().eq("id", planId));
  }

  async function completePlan(id) {
    assertConfigured();
    const { data, error } = await client
      .from("study_plans")
      .update(sanitizePayload({ status: "완료" }))
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      const detail = error.details ? ` (${error.details})` : "";
      throw new Error(`완료 상태 저장 실패: ${error.message}${detail}`);
    }
    console.log("[complete-update-success]", data);

    const stickerPayload = sanitizePayload({
      study_plan_id: /^\d+$/.test(String(id)) ? Number(id) : id,
      sticker_count: 1,
    });
    const { error: stickerError } = await client.from("sticker_history").insert(stickerPayload);

    if (stickerError) {
      const detail = stickerError.details ? ` (${stickerError.details})` : "";
      throw new Error(`스티커 저장 실패: ${stickerError.message}${detail}`);
    }
    console.log("[complete-sticker-success]", stickerPayload);

    return planFromRow(data);
  }

  async function updatePlanStatus(id, status) {
    assertConfigured();
    const { data } = await request(
      "완료 상태 저장 실패",
      client
        .from("study_plans")
        .update(sanitizePayload({ status }))
        .eq("id", id)
        .select("*")
        .single()
    );

    if (isDoneStatus(status)) {
      await request(
        "스티커 저장 실패",
        client
          .from("sticker_history")
          .upsert(sanitizePayload({ study_plan_id: id, sticker_count: 1 }), { onConflict: "study_plan_id" })
      );
    } else {
      await request(
        "스티커 상태 정리 실패",
        client.from("sticker_history").delete().eq("study_plan_id", id)
      );
    }

    return planFromRow(data);
  }

  async function syncStickerForPlan(planId, status) {
    if (isDoneStatus(status)) {
      await request(
        "스티커 저장 실패",
        client
          .from("sticker_history")
          .upsert(sanitizePayload({ study_plan_id: planId, sticker_count: 1 }), { onConflict: "study_plan_id" })
      );
      return;
    }
    await request(
      "스티커 상태 정리 실패",
      client.from("sticker_history").delete().eq("study_plan_id", planId)
    );
  }

  async function saveReward(reward) {
    assertConfigured();
    const payload = sanitizePayload({
      target_stickers: Number(reward.goal),
      reward_name: reward.name,
    });
    const { data: current } = await request(
      "보상 설정 확인 실패",
      client.from("reward_settings").select("id").limit(1).maybeSingle()
    );
    if (current?.id) {
      await request("보상 설정 저장 실패", client.from("reward_settings").update(payload).eq("id", current.id));
      return;
    }
    await request("보상 설정 저장 실패", client.from("reward_settings").insert(payload));
  }

  async function saveRewardMilestones(milestones) {
    assertConfigured();
    const rows = normalizeRewardMilestones(milestones).map((milestone) => ({
      id: String(milestone.id).startsWith("default-") || String(milestone.id).startsWith("local-") ? undefined : milestone.id,
      required_stickers: milestone.stars,
      reward_name: milestone.name,
    }));

    await request("보상 마일스톤 초기화 실패", client.from("reward_milestones").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
    if (rows.length) {
      await request("보상 마일스톤 저장 실패", client.from("reward_milestones").insert(rows));
    }
  }

  async function upsertAcademySchedule(schedule) {
    assertConfigured();
    const payload = academyScheduleToRow(schedule);
    if (schedule.id && !String(schedule.id).startsWith("local-")) {
      const { data } = await request(
        "학원 일정 수정 실패",
        client.from("academy_schedules").update(payload).eq("id", schedule.id).select("*").single()
      );
      return academyScheduleFromRow(data);
    }

    const { data } = await request(
      "학원 일정 저장 실패",
      client.from("academy_schedules").insert(payload).select("*").single()
    );
    return academyScheduleFromRow(data);
  }

  async function deleteAcademySchedule(id) {
    assertConfigured();
    await request("학원 일정 삭제 실패", client.from("academy_schedules").delete().eq("id", id));
  }

  async function completeAcademySchedule(schedule, completedDate) {
    assertConfigured();
    const payload = sanitizePayload({
      academy_schedule_id: schedule.id,
      completed_date: completedDate,
      star_count: Number(schedule.stars || 1),
    });
    const { data } = await request(
      "학원 완료 저장 실패",
      client.from("academy_completion_history").insert(payload).select("*").single()
    );
    return academyCompletionFromRow(data);
  }

  async function recordCompletionNotification(entry) {
    assertConfigured();
    const payload = sanitizePayload({
      study_plan_id: entry.planId,
      title: entry.title,
      body: entry.body,
      delivered: entry.delivered,
      delivery_channel: entry.pushSubscription ? "push" : "browser",
      error_message: entry.errorMessage,
    });
    await request("완료 알림 기록 저장 실패", client.from("completion_notifications").insert(payload));
  }

  async function markLate(planIds) {
    assertConfigured();
    if (!planIds.length) return;
    await request(
      "지연 상태 저장 실패",
      client.from("study_plans").update({ status: "지연" }).in("id", planIds)
    );
  }

  function subscribe(onChange, onError) {
    assertConfigured();
    if (config.enableRealtime !== true) {
      warnRealtimeFallback("Realtime subscription skipped. REST reads and writes remain active.");
      return () => {};
    }

    const channel = client
      .channel("study-tracker-single-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_plans" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_settings" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_history" }, onChange)
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          console.log("[Supabase realtime] subscribed");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" || error) {
          warnRealtimeFallback(`subscription ${status}`, error);
        }
      });
    return () => client.removeChannel(channel);
  }

  return {
    load,
    save,
    upsertPlan,
    deletePlan,
    completePlan,
    recordCompletionNotification,
    saveReward,
    saveRewardMilestones,
    upsertAcademySchedule,
    deleteAcademySchedule,
    completeAcademySchedule,
    markLate,
    subscribe,
  };
}

const repository = createSupabaseRepository(SUPABASE_CONFIG);
let state = {
  reward: { ...DEFAULT_REWARD },
  rewardMilestones: [...DEFAULT_REWARD_MILESTONES],
  stickerCount: 0,
  plans: [],
  academySchedules: [],
  academyCompletions: [],
};
state.formMode = "create";
let isParentMode = false;
let learningFilter = "due";
let isRemoteRefreshPending = false;
let installPrompt = null;
let parentPushState = { status: "idle", message: "", registered: false };
let familyChatController = null;
let rewardStoreController = null;

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function comparePlans(a, b) {
  return a.studyDate.localeCompare(b.studyDate) || a.subject.localeCompare(b.subject, "ko");
}

function isDoneStatus(status) {
  return status === "done" || status === "완료";
}

function isPlannedStatus(status) {
  return status === "planned" || status === "예정";
}

function isLateStatus(status) {
  return status === "late" || status === "지연";
}

function statusClass(status) {
  if (isDoneStatus(status)) return "done";
  if (isLateStatus(status)) return "late";
  return "planned";
}

function toDateInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

async function saveAndRender(message, operation) {
  try {
    if (operation) await operation();
    state = await repository.load();
    ensureFormMode();
    await markOverduePlans();
    writeLocalData(state);
    render();
    setConnectionStatus("");
    if (message) showToast(message);
  } catch (error) {
    handleRepositoryError(error);
  }
}

function ensureFormMode() {
  if (!state.formMode) state.formMode = "create";
}

function completedCount() {
  return state.stickerCount || state.plans.filter((plan) => isDoneStatus(plan.status)).length + academyCompletedStars();
}

function academyCompletedStars() {
  return (state.academyCompletions || []).reduce((sum, item) => sum + Number(item.stars || item.star_count || 0), 0);
}

function markPlanCompleteLocally(id) {
  const planId = String(id);
  let completedPlan = null;
  const plans = state.plans.map((plan) => {
    if (String(plan.id) !== planId) return plan;
    completedPlan = { ...plan, status: "\uC644\uB8CC" };
    return completedPlan;
  });

  if (!completedPlan) return null;

  state = {
    ...state,
    plans,
    stickerCount: Math.max(Number(state.stickerCount || 0), plans.filter((plan) => isDoneStatus(plan.status)).length),
  };
  writeLocalData(state);
  return completedPlan;
}

function academyCompletionKey(scheduleId, date = toDateInput(new Date())) {
  return `${date}:${scheduleId}`;
}

function isAcademyCompleted(scheduleId, date = toDateInput(new Date())) {
  const key = academyCompletionKey(scheduleId, date);
  return (state.academyCompletions || []).some((item) => {
    const itemDate = item.completedDate || item.completed_date;
    const itemScheduleId = item.scheduleId || item.academy_schedule_id;
    return academyCompletionKey(itemScheduleId, itemDate) === key;
  });
}

function completeAcademyLocally(schedule, date = toDateInput(new Date())) {
  if (isAcademyCompleted(schedule.id, date)) return null;
  const completion = {
    id: `local-academy-completion-${Date.now()}`,
    scheduleId: schedule.id,
    completedDate: date,
    stars: Number(schedule.stars || 1),
  };
  state = {
    ...state,
    academyCompletions: [...(state.academyCompletions || []), completion],
    stickerCount: Number(state.stickerCount || 0) + completion.stars,
  };
  writeLocalData(state);
  return completion;
}

function todaysAcademySchedules() {
  const dayOfWeek = new Date().getDay();
  return [...(state.academySchedules || [])]
    .filter((schedule) => Number(schedule.dayOfWeek) === dayOfWeek)
    .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")) || String(a.name || "").localeCompare(String(b.name || "")));
}

function upsertAcademyScheduleLocally(schedule) {
  const exists = (state.academySchedules || []).some((item) => String(item.id) === String(schedule.id));
  const academySchedules = exists
    ? state.academySchedules.map((item) => (String(item.id) === String(schedule.id) ? schedule : item))
    : [...(state.academySchedules || []), schedule];
  state = { ...state, academySchedules };
  writeLocalData(state);
}

function replaceAcademyScheduleId(localId, savedSchedule) {
  if (!savedSchedule || String(savedSchedule.id) === String(localId)) return;
  state = {
    ...state,
    academySchedules: (state.academySchedules || []).map((item) => (String(item.id) === String(localId) ? savedSchedule : item)),
    academyCompletions: (state.academyCompletions || []).map((item) => (
      String(item.scheduleId || item.academy_schedule_id) === String(localId)
        ? { ...item, scheduleId: savedSchedule.id }
        : item
    )),
  };
  writeLocalData(state);
}

function parentNotificationMessage(plan) {
  return {
    title: "하겸이 학습 완료 ⭐",
    body: `하겸이가 ${plan.subject} · ${plan.book} 학습을 완료했어요. 스티커 1개를 받았습니다.`,
    url: "/?tab=progress",
    tag: `study-complete-${plan.id}`,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `${url} failed with ${response.status}`);
  }
  return data;
}

async function fetchPushPublicKey() {
  const data = await requestJson("/api/push/public-key");
  if (!data.configured || !data.publicKey) {
    throw new Error("알림 서버 설정이 완료되지 않았어요.");
  }
  return data.publicKey;
}

function isSecurePushContext() {
  return window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

async function getParentPushSubscription(publicKey) {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

async function notifyParentOfCompletion(plan) {
  const message = parentNotificationMessage(plan);
  const entry = {
    planId: plan.id,
    title: message.title,
    body: message.body,
    sentAt: new Date().toISOString(),
    delivered: false,
  };

  try {
    const result = await requestJson("/api/push/send", {
      method: "POST",
      body: JSON.stringify({ type: "study-complete", planId: plan.id }),
    });
    entry.delivered = Number(result.success || 0) > 0;
    entry.result = result;
  } catch (error) {
    console.warn("[parent notification] push failed", error);
    entry.errorMessage = error?.message || String(error);
    showToast("학습 완료는 저장됐지만 부모 알림 전송은 실패했어요.");
  } finally {
    writeLocalNotification(entry);
    repository.recordCompletionNotification(entry).catch((error) => {
      console.warn("[parent notification] remote log skipped", error);
    });
  }
}

async function notifyParentOfAcademyCompletion(schedule, completedDate) {
  try {
    await requestJson("/api/push/send", {
      method: "POST",
      body: JSON.stringify({ type: "academy-complete", scheduleId: schedule.id, completedDate }),
    });
  } catch (error) {
    console.warn("[parent notification] academy push failed", error);
    showToast("일정 완료는 저장됐지만 부모 알림 전송은 실패했어요.");
  }
}

async function createFamilyStudyMessage(plan) {
  try {
    await requestJson("/api/family/messages", {
      method: "POST",
      body: JSON.stringify({ messageType: "system", relatedType: "study_complete", relatedId: plan.id }),
    });
  } catch (error) {
    console.warn("[family chat] study message skipped", error?.message || error);
  }
}

function render() {
  renderDataSource();
  renderHeader();
  renderRoleControls();
  renderLearning();
  renderProgress();
  renderRewards();
  renderParent();
  rewardStoreController?.render();
  rewardStoreController?.scheduleRefresh();
}

function renderApp() {
  render();
}

function clearBrowserStorage() {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn("Browser storage clear skipped:", error);
  }
}

function renderDataSource() {
  const source = $("#dataSource");
  if (source) source.textContent = `Data source: Supabase / Build: ${BUILD_VERSION}`;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updateInstallUI() {
  const panel = $("#installPanel");
  const button = $("#installAppButton");
  const help = $("#installHelp");
  if (!panel || !button || !help) return;

  if (isStandaloneDisplay()) {
    panel.hidden = true;
    return;
  }

  if (installPrompt) {
    panel.hidden = false;
    button.hidden = false;
    help.textContent = "설치하면 휴대폰 홈 화면에서 바로 열 수 있어요.";
    return;
  }

  if (isIosDevice()) {
    panel.hidden = false;
    button.hidden = true;
    help.textContent = "iPhone/Safari에서는 공유 버튼 → 홈 화면에 추가를 눌러주세요.";
    return;
  }

  panel.hidden = true;
  console.log("[pwa-install] beforeinstallprompt not available yet. Check HTTPS, manifest icons, and service worker.");
}

async function promptInstallApp() {
  if (!installPrompt) {
    console.log("[pwa-install] install prompt is not ready.");
    updateInstallUI();
    return;
  }
  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  console.log("[pwa-install] user choice:", choice.outcome);
  installPrompt = null;
  updateInstallUI();
}

async function markOverduePlans() {
  const today = toDateInput(new Date());
  const changedIds = [];
  state.plans = state.plans.map((plan) => {
    if (isPlannedStatus(plan.status) && plan.studyDate < today) {
      changedIds.push(plan.id);
      return { ...plan, status: "지연" };
    }
    return plan;
  });
  if (changedIds.length) {
    await repository.markLate(changedIds);
  }
}

function renderHeader() {
  $("#stickerCount").textContent = completedCount();
}

function renderRoleControls() {
  $$("[data-parent-only]").forEach((element) => {
    element.hidden = !isParentMode;
  });
  $("#parentAccessButton").hidden = isParentMode;
}

function renderLearning() {
  const today = toDateInput(new Date());
  const weekEnd = toDateInput(addDays(new Date(), 6));
  $("#todayDate").textContent = formatDate(today);
  $$(".today-filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.learningFilter === learningFilter);
  });

  const duePlans = state.plans
    .filter((plan) => !isDoneStatus(plan.status) && plan.studyDate <= today)
    .sort(comparePlans);
  const weekPlans = state.plans
    .filter((plan) => !isDoneStatus(plan.status) && plan.studyDate >= today && plan.studyDate <= weekEnd)
    .sort(comparePlans);
  const upcomingPlans = state.plans
    .filter((plan) => !isDoneStatus(plan.status) && plan.studyDate >= today)
    .sort(comparePlans);
  let plans = duePlans;

  if (learningFilter === "week") plans = weekPlans;
  if (learningFilter === "upcoming") plans = upcomingPlans;
  const academyTasks = learningFilter === "due" ? todaysAcademySchedules() : [];

  if (!plans.length && !academyTasks.length) {
    $("#todayList").innerHTML = `<div class="empty"><h3>표시할 예정 학습이 없어요</h3><p>${isParentMode ? "부모관리 탭에서 학습을 등록하세요." : "오늘은 쉬어가는 날이에요. 스티커 에너지를 충전해요!"}</p></div>`;
    return;
  }

  $("#todayList").innerHTML = [
    ...plans.map(createStudyCard),
    ...academyTasks.map(createAcademyCard),
  ].join("");
}

const renderToday = renderLearning;

function createStudyCard(plan) {
  const done = isDoneStatus(plan.status);
  const normalizedStatus = statusClass(plan.status);
  const isOverdue = !done && plan.studyDate < toDateInput(new Date());
  const displayStatus = isOverdue ? "\uC9C0\uC5F0" : statusLabels[plan.status] || statusLabels[normalizedStatus];
  const completeButtonHtml = `<button type="button" class="complete-btn" data-action="complete" data-id="${plan.id}">완료했어요!</button>`;
  if (!done) console.log("[complete-button-html]", completeButtonHtml);
  return `
    <article class="study-card ${isOverdue ? "late" : normalizedStatus} ${done ? "completed" : ""}">
      <span class="card-status">${done ? "⭐" : "📘"} ${displayStatus}</span>
      <h3>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)}</h3>
      <p>${escapeHtml(plan.unit)} / ${escapeHtml(plan.lessonNo)}</p>
      <div class="card-meta">
        <span>오늘 할 일: ${escapeHtml(plan.content)}</span>
        <span>목표: ${escapeHtml(plan.target)}</span>
        <span>${escapeHtml(plan.dayNo)}</span>
      </div>
      ${done
        ? `<div class="complete-done">참 잘했어요!</div>`
        : completeButtonHtml}
    </article>
  `;
}

async function handleCompletePlan(id, button) {
  if (!id) {
    handleRepositoryError(new Error("완료할 학습 ID가 없습니다."));
    return;
  }
  const planBeforeComplete = state.plans.find((plan) => String(plan.id) === String(id));
  console.log("[complete-start]", id);

  if (button) {
    button.disabled = true;
    button.textContent = "저장 중...";
  }

  try {
    await repository.completePlan(id);
    state = await repository.load();
    await markOverduePlans();
    writeLocalData(state);
    renderApp();
    setConnectionStatus("");
    console.log("[complete-refresh-success]", id);
    launchCelebration();
    const completedPlan = state.plans.find((plan) => String(plan.id) === String(id)) || planBeforeComplete;
    if (completedPlan) await Promise.allSettled([notifyParentOfCompletion(completedPlan), createFamilyStudyMessage(completedPlan)]);
    showToast("GOOD!! 너무 잘했어!");
  } catch (error) {
    if (isNetworkFallbackError(error)) {
      const completedPlan = markPlanCompleteLocally(id) || planBeforeComplete;
      renderApp();
      setConnectionStatus("");
      launchCelebration();
      if (completedPlan) await notifyParentOfCompletion(completedPlan);
      showToast("GOOD!! \uB108\uBB34 \uC798\uD588\uC5B4!");
      console.warn("[local fallback] completed plan locally", error);
      if (button) {
        button.disabled = false;
        button.textContent = "\uC644\uB8CC\uD588\uC5B4\uC694";
      }
      return;
    }
    if (button) {
      button.disabled = false;
      button.textContent = "완료했어요!";
    }
    handleRepositoryError(error);
  }
}

function renderProgress() {
  const sorted = [...state.plans].sort(comparePlans);
  $("#progressTable").innerHTML = sorted.map((plan) => `
    <tr class="status-${statusClass(plan.status)}">
      <td>${escapeHtml(plan.subject)}</td>
      <td>${escapeHtml(plan.book)}</td>
      <td>${escapeHtml(plan.unit)}</td>
      <td>${escapeHtml(plan.lessonNo)}</td>
      <td>${escapeHtml(plan.dayNo)}</td>
      <td>${escapeHtml(formatDate(plan.studyDate))}</td>
      <td>${escapeHtml(plan.target)}</td>
      <td><span class="status-badge status-${statusClass(plan.status)}">${statusLabels[plan.status] || statusLabels[statusClass(plan.status)]}</span></td>
    </tr>
  `).join("");
}

function renderRewards() {
  if (!rewardStoreController) $("#rewardPanel").innerHTML = `<div class="empty">보상상점을 불러오는 중이에요.</div>`;
}

function createAcademyCard(schedule) {
  const today = toDateInput(new Date());
  const done = isAcademyCompleted(schedule.id, today);
  const stars = Number(schedule.stars || 1);
  const title = `${schedule.name || "\uD559\uC6D0"} \uB2E4\uB140\uC624\uAE30`;
  return `
    <article class="study-card academy ${done ? "completed" : ""}">
      <span class="card-status academy-status">\uD559\uC6D0</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(WEEKDAY_LABELS[Number(schedule.dayOfWeek)] || "")}\uC694\uC77C ${escapeHtml(schedule.time || "")}</p>
      <div class="card-meta">
        <span>\uBCC4 ${stars}\uAC1C</span>
        ${schedule.memo ? `<span>${escapeHtml(schedule.memo)}</span>` : ""}
      </div>
      ${done
        ? `<div class="complete-done">\uC798 \uB2E4\uB140\uC654\uC5B4\uC694! \uBCC4 ${stars}\uAC1C\uAC00 \uC313\uC600\uC5B4\uC694.</div>`
        : `<button type="button" class="complete-btn" data-action="complete-academy" data-id="${schedule.id}">\uC798 \uB2E4\uB140\uC654\uC5B4\uC694</button>`}
    </article>
  `;
}

function createRewardMilestoneCard(milestone, count, nextReward) {
  const achieved = count >= milestone.stars;
  const active = nextReward && milestone.id === nextReward.id;
  const status = achieved ? "달성 완료" : active ? "진행 중" : "예정";
  const remaining = Math.max(milestone.stars - count, 0);
  return `
    <div class="milestone-card ${achieved ? "achieved" : active ? "active" : "planned"}">
      <strong>별 ${milestone.stars}개</strong>
      <span>${escapeHtml(milestone.name)}</span>
      <em>${status}${active ? ` · ${remaining}개 남음` : ""}</em>
    </div>
  `;
}

function renderParent() {
  const total = state.plans.length;
  const done = state.plans.filter((plan) => isDoneStatus(plan.status)).length;
  const late = state.plans.filter((plan) => isLateStatus(plan.status)).length;
  $("#totalPlans").textContent = total;
  $("#donePlans").textContent = done;
  $("#latePlans").textContent = late;
  $("#weeklyRate").textContent = `${calculateWeeklyRate()}%`;
  renderAcademyScheduleAdmin();
  renderParentNotificationSettings();

  $("#planList").innerHTML = [...state.plans]
    .sort((a, b) => b.studyDate.localeCompare(a.studyDate))
    .map((plan) => `
      <article class="plan-item">
        <div>
          <h4>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)} <span class="status-badge status-${statusClass(plan.status)}">${statusLabels[plan.status] || statusLabels[statusClass(plan.status)]}</span></h4>
          <p>${escapeHtml(formatDate(plan.studyDate))} · ${escapeHtml(plan.unit)} · ${escapeHtml(plan.target)}</p>
        </div>
        <div class="plan-actions">
          <button type="button" class="copy-btn" data-action="copy" data-id="${plan.id}">복사</button>
          <button type="button" class="edit-btn" data-action="edit" data-id="${plan.id}">수정</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${plan.id}">삭제</button>
        </div>
      </article>
    `).join("");
}

function renderRewardMilestoneAdmin() {
  const list = $("#rewardMilestoneList");
  if (!list) return;
  const milestones = normalizeRewardMilestones(state.rewardMilestones, state.reward);
  list.innerHTML = milestones.map((milestone) => `
    <div class="reward-admin-row">
      <span>별 ${milestone.stars}개 · ${escapeHtml(milestone.name)}</span>
      <div class="plan-actions">
        <button type="button" class="edit-btn" data-action="edit-reward" data-id="${milestone.id}">수정</button>
        <button type="button" class="delete-btn" data-action="delete-reward" data-id="${milestone.id}">삭제</button>
      </div>
    </div>
  `).join("");
}

function resetRewardForm() {
  $("#rewardMilestoneId").value = "";
  $("#rewardGoal").value = "";
  $("#rewardName").value = "";
  const button = $("#rewardSubmitButton");
  if (button) button.textContent = "보상 추가";
}

function renderAcademyScheduleAdmin() {
  const list = $("#academyScheduleList");
  if (!list) return;
  const schedules = [...(state.academySchedules || [])]
    .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek) || String(a.time || "").localeCompare(String(b.time || "")));

  list.innerHTML = schedules.length ? schedules.map((schedule) => `
    <div class="academy-admin-row">
      <span>${escapeHtml(schedule.name)} · ${escapeHtml(WEEKDAY_LABELS[Number(schedule.dayOfWeek)] || "")} · ${escapeHtml(schedule.time || "")} · \uBCC4 ${Number(schedule.stars || 1)}\uAC1C</span>
      <div class="plan-actions">
        <button type="button" class="edit-btn" data-action="edit-academy" data-id="${schedule.id}">\uC218\uC815</button>
        <button type="button" class="delete-btn" data-action="delete-academy" data-id="${schedule.id}">\uC0AD\uC81C</button>
      </div>
    </div>
  `).join("") : `<p class="empty-note">\uB4F1\uB85D\uB41C \uD559\uC6D0 \uC77C\uC815\uC774 \uC5C6\uC5B4\uC694.</p>`;
}

function resetAcademyForm() {
  const form = $("#academyForm");
  if (!form) return;
  form.reset();
  $("#academyScheduleId").value = "";
  $("#academyStars").value = "1";
  const button = $("#academySubmitButton");
  if (button) button.textContent = "\uD559\uC6D0 \uC77C\uC815 \uCD94\uAC00";
}

function renderParentNotificationSettings() {
  const panel = $("#parentNotificationPanel");
  const status = $("#parentNotificationStatus");
  const button = $("#enableParentNotificationButton");
  const testButton = $("#testParentNotificationButton");
  if (!panel || !status || !button) return;

  const notificationAvailable = "Notification" in window;
  const pushAvailable = "serviceWorker" in navigator && "PushManager" in window;
  const permission = notificationAvailable ? Notification.permission : "unsupported";

  button.disabled = !notificationAvailable || !pushAvailable || !isSecurePushContext() || parentPushState.status === "working";
  if (testButton) testButton.disabled = !parentPushState.registered || parentPushState.status === "working";

  if (!isSecurePushContext()) {
    status.textContent = "HTTPS 또는 localhost에서만 부모 알림을 설정할 수 있어요.";
    button.textContent = "알림 설정 불가";
    return;
  }
  if (!notificationAvailable || !pushAvailable) {
    status.textContent = "이 브라우저는 푸시 알림을 지원하지 않아요.";
    button.textContent = "알림 설정 불가";
    return;
  }
  if (permission === "denied") {
    status.textContent = "브라우저 설정에서 알림을 허용해주세요.";
    button.textContent = "알림 허용 필요";
    return;
  }

  status.textContent = parentPushState.message || (
    parentPushState.registered
      ? "이 기기에서 부모 알림을 받고 있어요."
      : "미등록 상태예요. 버튼을 눌러 부모 알림을 설정하세요."
  );
  button.textContent = parentPushState.registered ? "알림 설정 완료" : "알림 받기";
}

async function handleEnableParentNotifications() {
  try {
    parentPushState = { status: "working", message: "알림 권한을 확인하고 있어요.", registered: false };
    renderParentNotificationSettings();

    if (!isSecurePushContext()) throw new Error("HTTPS 또는 localhost에서만 부모 알림을 설정할 수 있어요.");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("이 브라우저는 푸시 알림을 지원하지 않아요.");
    }
    if (Notification.permission === "default") {
      parentPushState.message = "알림 권한 요청 중이에요.";
      renderParentNotificationSettings();
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("브라우저 설정에서 알림을 허용해주세요.");
    }
    if (Notification.permission === "denied") {
      throw new Error("브라우저 설정에서 알림을 허용해주세요.");
    }

    parentPushState.message = "알림 서버 설정을 확인하고 있어요.";
    renderParentNotificationSettings();
    const publicKey = await fetchPushPublicKey();

    parentPushState.message = "이 기기를 부모 알림 수신 기기로 등록하고 있어요.";
    renderParentNotificationSettings();
    const subscription = await getParentPushSubscription(publicKey);

    await requestJson("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ childName: "하겸이", subscription: subscription.toJSON() }),
    });
    parentPushState = { status: "ready", message: "이 기기에서 부모 알림을 받고 있어요.", registered: true };
    showToast("부모 알림 설정 완료");
  } catch (error) {
    console.warn("[parent notification] setup failed", error);
    parentPushState = { status: "error", message: error?.message || "알림 설정에 실패했어요.", registered: false };
  } finally {
    renderParentNotificationSettings();
  }
}

async function handleTestParentNotification() {
  try {
    parentPushState = { ...parentPushState, status: "working", message: "테스트 알림을 보내고 있어요." };
    renderParentNotificationSettings();
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) throw new Error("먼저 알림 받기를 설정해주세요.");
    await requestJson("/api/push/send", {
      method: "POST",
      body: JSON.stringify({ type: "test", subscription: subscription.toJSON() }),
    });
    parentPushState = { status: "ready", message: "테스트 알림을 보냈어요.", registered: true };
  } catch (error) {
    console.warn("[parent notification] test failed", error);
    parentPushState = { ...parentPushState, status: "error", message: error?.message || "테스트 알림 전송에 실패했어요." };
  } finally {
    renderParentNotificationSettings();
  }
}

async function refreshParentPushRegistrationState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !isSecurePushContext()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      parentPushState = { status: "ready", message: "이 기기에서 부모 알림을 받고 있어요.", registered: true };
      renderParentNotificationSettings();
    }
  } catch (error) {
    console.warn("[parent notification] registration state check failed", error);
  }
}

async function handleCompleteAcademy(id, button) {
  const schedule = (state.academySchedules || []).find((item) => String(item.id) === String(id));
  if (!schedule) {
    console.warn("[academy] schedule not found", id);
    return;
  }

  const today = toDateInput(new Date());
  const stars = Number(schedule.stars || 1);
  if (isAcademyCompleted(schedule.id, today)) {
    showToast("\uC774\uBBF8 \uBCC4\uC774 \uC313\uC600\uC5B4\uC694.");
    renderLearning();
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "\uC800\uC7A5 \uC911...";
  }

  completeAcademyLocally(schedule, today);
  renderApp();
  setConnectionStatus("");
  launchCelebration();
  showToast(`\uC798 \uB2E4\uB140\uC654\uC5B4\uC694! \uBCC4 ${stars}\uAC1C\uAC00 \uC313\uC600\uC5B4\uC694.`);

  if (!String(schedule.id).startsWith("local-")) {
    try {
      await repository.completeAcademySchedule(schedule, today);
      await notifyParentOfAcademyCompletion(schedule, today);
      await rewardStoreController?.refresh({ silent: true });
    } catch (error) {
      console.warn("[academy] completion saved locally only", error);
    }
  }
}

function calculateWeeklyRate() {
  const today = new Date();
  const start = toDateInput(addDays(today, -6));
  const end = toDateInput(today);
  const weekly = state.plans.filter((plan) => plan.studyDate >= start && plan.studyDate <= end);
  if (!weekly.length) return 0;
  return Math.round((weekly.filter((plan) => isDoneStatus(plan.status)).length / weekly.length) * 100);
}

async function handleEditPlan(id) {
  if (!isParentMode) return;
  const plan = state.plans.find((item) => Number(item.id) === Number(id));
  if (!plan) {
    handleRepositoryError(new Error("수정할 학습계획을 찾지 못했습니다."));
    return;
  }
  state.formMode = "edit";
  $("#planId").value = plan.id;
  $("#subject").value = plan.subject;
  $("#book").value = plan.book;
  $("#unit").value = plan.unit;
  $("#lessonNo").value = plan.lessonNo;
  $("#studyDate").value = plan.studyDate;
  $("#dayNo").value = plan.dayNo;
  $("#content").value = plan.content;
  $("#target").value = plan.target;
  $("#status").value = statusClass(plan.status);
  updatePlanSubmitButton();
  switchView("parent");
  $("#planForm").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("수정할 내용을 바꾸고 저장하세요.");
}

async function handleCopyPlan(id) {
  if (!isParentMode) return;
  console.log("[copy-click]", id);
  console.log("[copy-plans]", state.plans.map((plan) => plan.id));
  const plan = state.plans.find((item) => Number(item.id) === Number(id));
  if (!plan) {
    handleRepositoryError(new Error("복사할 학습계획을 찾지 못했습니다."));
    return;
  }
  state.formMode = "copy";
  $("#planId").value = "";
  $("#subject").value = plan.subject;
  $("#book").value = plan.book;
  $("#unit").value = plan.unit;
  $("#lessonNo").value = plan.lessonNo;
  $("#studyDate").value = plan.studyDate;
  $("#dayNo").value = plan.dayNo;
  $("#content").value = plan.content;
  $("#target").value = plan.target;
  $("#status").value = "planned";
  updatePlanSubmitButton();
  switchView("parent");
  $("#planForm").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("복사할 내용을 수정하고 저장하세요.");
}

async function handleDeletePlan(id) {
  if (!isParentMode) return;
  const ok = window.confirm("이 학습계획과 연결된 스티커 기록도 함께 삭제됩니다. 삭제할까요?");
  if (!ok) return;
  await saveAndRender("학습계획이 삭제되었습니다.", () => repository.deletePlan(id));
}

function resetForm() {
  $("#planForm").reset();
  $("#planId").value = "";
  $("#studyDate").value = toDateInput(new Date());
  $("#status").value = "planned";
  state.formMode = "create";
  updatePlanSubmitButton();
}

function updatePlanSubmitButton() {
  const button = $("#planSubmitButton");
  if (!button) return;
  if (state.formMode === "copy") {
    button.textContent = "복사해서 저장";
    return;
  }
  if (state.formMode === "edit") {
    button.textContent = "수정 저장";
    return;
  }
  button.textContent = "저장";
}

async function handlePlanSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const formPlan = {
    id: state.formMode === "copy" ? undefined : $("#planId").value || undefined,
    subject: $("#subject").value.trim(),
    book: $("#book").value.trim(),
    unit: $("#unit").value.trim(),
    lessonNo: $("#lessonNo").value.trim(),
    studyDate: $("#studyDate").value,
    dayNo: $("#dayNo").value.trim(),
    content: $("#content").value.trim(),
    target: $("#target").value.trim(),
    status: statusLabels[$("#status").value] || $("#status").value,
  };

  const message = state.formMode === "copy" ? "복사한 학습계획이 저장되었습니다." : "학습계획을 저장했어요.";
  await saveAndRender(message, () => repository.upsertPlan(formPlan));
  resetForm();
}

async function handleAcademySubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const existingId = $("#academyScheduleId").value;
  const schedule = {
    id: existingId || `local-academy-${Date.now()}`,
    name: $("#academyName").value.trim(),
    dayOfWeek: Number($("#academyDayOfWeek").value),
    time: $("#academyTime").value,
    memo: $("#academyMemo").value.trim(),
    stars: Number($("#academyStars").value || 1),
  };
  if (!schedule.name || !schedule.time || Number.isNaN(schedule.dayOfWeek)) return;

  upsertAcademyScheduleLocally(schedule);
  render();
  resetAcademyForm();
  showToast("\uD559\uC6D0 \uC77C\uC815\uC744 \uC800\uC7A5\uD588\uC5B4\uC694.");

  try {
    const saved = await repository.upsertAcademySchedule(schedule);
    replaceAcademyScheduleId(schedule.id, saved);
    render();
  } catch (error) {
    console.warn("[academy] remote save skipped", error);
  }
}

function handleEditAcademySchedule(id) {
  if (!isParentMode) return;
  const schedule = (state.academySchedules || []).find((item) => String(item.id) === String(id));
  if (!schedule) return;
  $("#academyScheduleId").value = schedule.id;
  $("#academyName").value = schedule.name || "";
  $("#academyDayOfWeek").value = String(schedule.dayOfWeek ?? new Date().getDay());
  $("#academyTime").value = schedule.time || "";
  $("#academyMemo").value = schedule.memo || "";
  $("#academyStars").value = String(schedule.stars || 1);
  const button = $("#academySubmitButton");
  if (button) button.textContent = "\uD559\uC6D0 \uC77C\uC815 \uC218\uC815";
  $("#academyForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleDeleteAcademySchedule(id) {
  if (!isParentMode) return;
  const ok = window.confirm("\uD559\uC6D0 \uC77C\uC815\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?");
  if (!ok) return;
  const removedCompletions = (state.academyCompletions || []).filter((item) => String(item.scheduleId || item.academy_schedule_id) === String(id));
  const removedStars = removedCompletions.reduce((sum, item) => sum + Number(item.stars || item.star_count || 0), 0);
  state = {
    ...state,
    academySchedules: (state.academySchedules || []).filter((item) => String(item.id) !== String(id)),
    academyCompletions: (state.academyCompletions || []).filter((item) => String(item.scheduleId || item.academy_schedule_id) !== String(id)),
    stickerCount: Math.max(Number(state.stickerCount || 0) - removedStars, 0),
  };
  writeLocalData(state);
  render();
  resetAcademyForm();
  showToast("\uD559\uC6D0 \uC77C\uC815\uC744 \uC0AD\uC81C\uD588\uC5B4\uC694.");

  if (!String(id).startsWith("local-")) {
    try {
      await repository.deleteAcademySchedule(id);
      await rewardStoreController?.refresh({ silent: true });
    } catch (error) {
      console.warn("[academy] remote delete skipped", error);
    }
  }
}

async function handleRewardSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const id = $("#rewardMilestoneId").value || `local-${Date.now()}`;
  const stars = Number($("#rewardGoal").value);
  const name = $("#rewardName").value.trim();
  if (!stars || !name) return;

  const milestones = normalizeRewardMilestones(state.rewardMilestones, state.reward);
  const exists = milestones.some((milestone) => String(milestone.id) === String(id));
  state.rewardMilestones = normalizeRewardMilestones(
    exists
      ? milestones.map((milestone) => String(milestone.id) === String(id) ? { ...milestone, stars, name } : milestone)
      : [...milestones, { id, stars, name }]
  );
  state.reward = { goal: state.rewardMilestones[0].stars, name: state.rewardMilestones[0].name };
  writeLocalData(state);
  render();
  resetRewardForm();
  showToast("보상 기준을 저장했어요.");

  repository.saveRewardMilestones(state.rewardMilestones).catch((error) => {
    console.warn("[reward milestones] remote save skipped", error);
  });
}

function handleEditRewardMilestone(id) {
  if (!isParentMode) return;
  const milestone = normalizeRewardMilestones(state.rewardMilestones, state.reward).find((item) => String(item.id) === String(id));
  if (!milestone) return;
  $("#rewardMilestoneId").value = milestone.id;
  $("#rewardGoal").value = milestone.stars;
  $("#rewardName").value = milestone.name;
  const button = $("#rewardSubmitButton");
  if (button) button.textContent = "보상 수정";
}

function handleDeleteRewardMilestone(id) {
  if (!isParentMode) return;
  const milestones = normalizeRewardMilestones(state.rewardMilestones, state.reward).filter((item) => String(item.id) !== String(id));
  state.rewardMilestones = normalizeRewardMilestones(milestones);
  state.reward = { goal: state.rewardMilestones[0].stars, name: state.rewardMilestones[0].name };
  writeLocalData(state);
  render();
  resetRewardForm();
  repository.saveRewardMilestones(state.rewardMilestones).catch((error) => {
    console.warn("[reward milestones] remote save skipped", error);
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setConnectionStatus(message) {
  const status = $("#connectionStatus");
  status.hidden = !message;
  status.textContent = message;
}

function isNetworkFallbackError(error) {
  const message = String(error?.message || error || "");
  return (
    message.includes("Failed to fetch") ||
    message.includes("Network request failed") ||
    message.includes("ERR_NAME_NOT_RESOLVED") ||
    message.includes("NAME_NOT_RESOLVED") ||
    message.includes("timed out") ||
    message.includes("ERR_FAILED") ||
    message.includes("503")
  );
}

function isRealtimeFallbackError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("channel error") ||
    message.includes("transport failure") ||
    message.includes("websocket") ||
    message.includes("realtime")
  );
}

function handleRepositoryError(error) {
  if (isNetworkFallbackError(error) || isRealtimeFallbackError(error)) {
    console.warn("[Supabase fallback] request failed without user-facing error", error);
    setConnectionStatus("");
    return;
  }
  const details = error?.details ? ` (${error.details})` : "";
  const message = `${error?.message || "Supabase 연결 중 오류가 발생했습니다."}${details}`;
  setConnectionStatus(message);
  showToast(message);
}

function launchCelebration() {
  const root = $("#celebration");
  const icons = ["⭐", "🎉", "GOOD", "GREAT", "PERFECT"];
  for (let i = 0; i < 18; i += 1) {
    const pop = document.createElement("span");
    pop.className = "pop";
    pop.textContent = icons[Math.floor(Math.random() * icons.length)];
    pop.style.left = `${Math.random() * 90 + 4}%`;
    pop.style.bottom = `${Math.random() * 24 + 4}%`;
    pop.style.animationDelay = `${Math.random() * 0.25}s`;
    root.appendChild(pop);
    setTimeout(() => pop.remove(), 1500);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(viewName) {
  if (viewName === "parent" && !isParentMode) {
    openPasswordDialog();
    return;
  }
  $$(".tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  $$(".view").forEach((item) => {
    item.classList.toggle("active", item.id === viewName);
  });
  familyChatController?.setActive(viewName === "family-chat");
  rewardStoreController?.setActive(["progress", "rewards", "parent"].includes(viewName));
  const url = new URL(window.location.href);
  if (viewName === "today") url.searchParams.delete("tab");
  else url.searchParams.set("tab", viewName);
  history.replaceState(null, "", url);
}

function openPasswordDialog() {
  const dialog = $("#passwordDialog");
  $("#parentPasswordInput").value = "";
  $("#passwordError").textContent = "";
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
  $("#parentPasswordInput").focus();
}

function closePasswordDialog() {
  const dialog = $("#passwordDialog");
  if (dialog.close) dialog.close();
  else dialog.removeAttribute("open");
}

function enterParentMode() {
  isParentMode = true;
  closePasswordDialog();
  resetForm();
  render();
  switchView("parent");
  showToast("부모 모드로 전환했어요.");
}

function exitParentMode() {
  isParentMode = false;
  resetForm();
  render();
  switchView("today");
  showToast("아이 화면으로 돌아왔어요.");
}

function handlePasswordSubmit(event) {
  event.preventDefault();
  if ($("#parentPasswordInput").value === PARENT_PASSWORD) {
    enterParentMode();
    return;
  }
  $("#passwordError").textContent = "비밀번호가 맞지 않아요.";
  $("#parentPasswordInput").select();
}

function bindEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    console.log("[pwa-install] beforeinstallprompt captured.");
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("#installPanel").hidden = true;
    console.log("[pwa-install] app installed.");
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  $$(".today-filter").forEach((button) => {
    button.addEventListener("click", () => {
      learningFilter = button.dataset.learningFilter;
      renderLearning();
    });
  });

  document.addEventListener("click", async (event) => {
    const editRewardButton = event.target.closest('[data-action="edit-reward"]');
    if (editRewardButton) {
      event.stopPropagation();
      handleEditRewardMilestone(editRewardButton.dataset.id);
      return;
    }

    const deleteRewardButton = event.target.closest('[data-action="delete-reward"]');
    if (deleteRewardButton) {
      event.stopPropagation();
      handleDeleteRewardMilestone(deleteRewardButton.dataset.id);
      return;
    }

    const editAcademyButton = event.target.closest('[data-action="edit-academy"]');
    if (editAcademyButton) {
      event.stopPropagation();
      handleEditAcademySchedule(editAcademyButton.dataset.id);
      return;
    }

    const deleteAcademyButton = event.target.closest('[data-action="delete-academy"]');
    if (deleteAcademyButton) {
      event.stopPropagation();
      await handleDeleteAcademySchedule(deleteAcademyButton.dataset.id);
      return;
    }

    const copyButton = event.target.closest('[data-action="copy"]');
    if (copyButton) {
      event.stopPropagation();
      const id = Number(copyButton.dataset.id);
      await handleCopyPlan(id);
      return;
    }

    const editButton = event.target.closest('[data-action="edit"]');
    if (editButton) {
      event.stopPropagation();
      const id = Number(editButton.dataset.id);
      await handleEditPlan(id);
      return;
    }

    const deleteButton = event.target.closest('[data-action="delete"]');
    if (deleteButton) {
      event.stopPropagation();
      const id = Number(deleteButton.dataset.id);
      await handleDeletePlan(id);
      return;
    }

    const academyButton = event.target.closest('[data-action="complete-academy"]');
    if (academyButton) {
      event.stopPropagation();
      await handleCompleteAcademy(academyButton.dataset.id, academyButton);
      return;
    }

    const button = event.target.closest('[data-action="complete"]');
    if (!button) return;
    event.stopPropagation();
    const currentPlans = state.plans || [];
    const rawId = button.dataset.id;
    const id = rawId;
    console.log("[complete-click]");
    console.log("button id:", rawId);
    console.log("button.dataset.id:", button.dataset.id);
    console.log("typeof button.dataset.id:", typeof button.dataset.id);
    console.log("currentPlans:", currentPlans);
    console.log("[plans]", currentPlans.map((plan) => plan.id));
    console.log("[complete-click-detected]", id);
    await handleCompletePlan(id, button);
  });

  $("#parentAccessButton").addEventListener("click", openPasswordDialog);
  $("#returnChildButton").addEventListener("click", exitParentMode);
  $("#installAppButton").addEventListener("click", promptInstallApp);
  $("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  $("#closePasswordButton").addEventListener("click", closePasswordDialog);
  $("#planForm").addEventListener("submit", handlePlanSubmit);
  $("#academyForm")?.addEventListener("submit", handleAcademySubmit);
  $("#rewardForm")?.addEventListener("submit", handleRewardSubmit);
  $("#enableParentNotificationButton")?.addEventListener("click", handleEnableParentNotifications);
  $("#testParentNotificationButton")?.addEventListener("click", handleTestParentNotification);
  $("#resetFormButton").addEventListener("click", resetForm);
  $("#resetAcademyFormButton")?.addEventListener("click", resetAcademyForm);
}

async function reloadFromRemote() {
  if (isRemoteRefreshPending) return;
  isRemoteRefreshPending = true;
  window.setTimeout(async () => {
    try {
      state = await repository.load();
      ensureFormMode();
      await markOverduePlans();
      writeLocalData(state);
      render();
      setConnectionStatus("");
    } catch (error) {
      handleRepositoryError(error);
    } finally {
      isRemoteRefreshPending = false;
    }
  }, 250);
}

async function init() {
  bindEvents();
  familyChatController = await initFamilyChat();
  rewardStoreController = await initRewardStore({ openFamily: () => switchView("family-chat") });
  updateInstallUI();
  resetForm();
  resetAcademyForm();
  $("#todayList").innerHTML = `<div class="empty"><h3>학습계획을 불러오는 중이에요</h3><p>Supabase에서 데이터를 가져오고 있어요.</p></div>`;
  try {
    state = await repository.load();
    ensureFormMode();
    await markOverduePlans();
    writeLocalData(state);
    render();
    setConnectionStatus("");
    repository.subscribe(reloadFromRemote, handleRepositoryError);
  } catch (error) {
    render();
    handleRepositoryError(error);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .then(() => refreshParentPushRegistrationState())
      .catch((error) => {
        console.log("[service-worker] registration failed:", error);
      });
  }
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (["today", "progress", "rewards", "family-chat"].includes(requestedTab)) switchView(requestedTab);
}

init();
