import { createClient } from "./vendor/supabase-js.js";
import { SUPABASE_CONFIG } from "./config.js";
import { AUTH_KEY as FAMILY_AUTH_KEY, TOKEN_KEY as FAMILY_TOKEN_KEY } from "./family-auth.js";
import { initFamilyChat } from "./family-chat.js";
import { initParentDashboard } from "./parent-dashboard.js";
import { initRewardStore } from "./reward-store.js";

const PARENT_PASSWORD = "1234";
const BUILD_VERSION = "v39";
const CACHE_VERSION = 2;
const STUDY_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_CACHE_TTL_MS = 30 * 60 * 1000;
const startupStartedAt = performance.now();
const startupMetrics = { appShellMs: 0, authMs: null, firstContentMs: null, essentialDataMs: null, deferredDataMs: null, requests: [] };
window.__studyTrackerStartupRequests = startupMetrics.requests;
const LEGACY_LOCAL_DATA_KEY = "study-tracker-local-data-v1";
const CACHE_PREFIX = "study_tracker_cache";
const LOCAL_NOTIFICATION_KEY = "study-tracker-parent-notifications-v1";
const DEFAULT_REWARD = { goal: 10, name: "5,000원 용돈" };
const DEFAULT_REWARD_MILESTONES = [
  { id: "default-5", stars: 5, name: "아이스크림" },
  { id: "default-20", stars: 20, name: "용돈 5,000원" },
  { id: "default-50", stars: 50, name: "수영장 쿠폰" },
];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const CALENDAR_VISIBLE_CARD_LIMIT = 3;
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

function cacheIdentity() {
  try {
    const member = JSON.parse(sessionStorage.getItem(FAMILY_AUTH_KEY) || "null")?.member || {};
    return { familyId: member.family_id || "default", memberKey: member.member_key || localStorage.getItem("study-tracker-family-member-v1") || "default" };
  } catch { return { familyId: "default", memberKey: "default" }; }
}

function localDataKey() {
  const { familyId, memberKey } = cacheIdentity();
  return `${CACHE_PREFIX}_${familyId}_${memberKey}`;
}

function renderStoredUserHint() {
  try {
    const auth = JSON.parse(sessionStorage.getItem(FAMILY_AUTH_KEY) || "null");
    if (!auth?.member || !auth.savedAt || Date.now() - new Date(auth.savedAt).getTime() > USER_CACHE_TTL_MS) return;
    $("#currentUserAvatar").textContent = auth.member.avatar_emoji || "👤";
    $("#currentUserName").textContent = auth.member.display_name || "가족 사용자";
    $("#currentUserRole").textContent = auth.member.role === "parent" ? "부모 확인 중" : "자녀 확인 중";
    $("#currentUserCard").classList.remove("startup-skeleton");
  } catch (error) {
    console.warn("[startup cache] user hint unavailable", error);
  }
}

function emptyLocalData() {
  return { reward: { ...DEFAULT_REWARD }, rewardMilestones: [...DEFAULT_REWARD_MILESTONES], plans: [], bookPlans: [], academySchedules: [], academyCompletions: [] };
}

function readLocalData() {
  try {
    const key = localDataKey();
    const raw = localStorage.getItem(key) || (cacheIdentity().memberKey === "default" ? localStorage.getItem(LEGACY_LOCAL_DATA_KEY) : null);
    if (!raw) return emptyLocalData();
    const parsed = JSON.parse(raw);
    const cached = parsed?.version ? parsed.data : parsed;
    if (parsed?.version && parsed.version !== CACHE_VERSION) { localStorage.removeItem(key); return emptyLocalData(); }
    const result = {
      reward: cached.reward || { ...DEFAULT_REWARD },
      rewardMilestones: normalizeRewardMilestones(cached.rewardMilestones || cached.rewards, cached.reward),
      plans: Array.isArray(cached.plans) ? cached.plans : [],
      bookPlans: Array.isArray(cached.bookPlans) ? cached.bookPlans : [],
      academySchedules: Array.isArray(cached.academySchedules) ? cached.academySchedules : [],
      academyCompletions: Array.isArray(cached.academyCompletions) ? cached.academyCompletions : [],
    };
    result.cacheSavedAt = parsed?.savedAt || null;
    result.cacheFresh = Boolean(parsed?.savedAt && Date.now() - new Date(parsed.savedAt).getTime() <= STUDY_CACHE_TTL_MS);
    return result;
  } catch (error) {
    console.warn("[local fallback] read failed", error);
    localStorage.removeItem(localDataKey());
    return emptyLocalData();
  }
}

function writeLocalData(data) {
  try {
    localStorage.setItem(
      localDataKey(),
      JSON.stringify({
        version: CACHE_VERSION,
        savedAt: new Date().toISOString(),
        identity: cacheIdentity(),
        data: {
        reward: data.reward || { ...DEFAULT_REWARD },
        rewardMilestones: normalizeRewardMilestones(data.rewardMilestones, data.reward),
        plans: Array.isArray(data.plans) ? data.plans : [],
        bookPlans: Array.isArray(data.bookPlans) ? data.bookPlans : [],
        academySchedules: Array.isArray(data.academySchedules) ? data.academySchedules : [],
        academyCompletions: Array.isArray(data.academyCompletions) ? data.academyCompletions : [],
        },
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
    const startedAt = performance.now();
    try {
      const result = await request(label, promise);
      startupMetrics.requests.push({ label, ms: Math.round(performance.now() - startedAt), ok: true });
      return result;
    } catch (error) {
      startupMetrics.requests.push({ label, ms: Math.round(performance.now() - startedAt), ok: false });
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
      bookPlanId: row.book_plan_id || null,
      readingPlanId: row.reading_plan_id || null,
      sequenceNo: Number(row.sequence_no || 0),
      startPage: row.start_page == null ? null : Number(row.start_page),
      endPage: row.end_page == null ? null : Number(row.end_page),
      taskType: row.task_type || (row.book_plan_id ? "page" : "daily"),
      note: row.note || "",
    };
  }

  function bookPlanFromRow(row) {
    return {
      id: row.id,
      subject: row.subject,
      book: row.workbook,
      unit: row.chapter,
      lessonNo: row.lesson,
      content: row.content || "",
      startDate: row.start_date,
      weekdays: row.study_weekdays || [],
      startPage: Number(row.start_page),
      endPage: Number(row.end_page),
      pagesPerDay: Number(row.pages_per_day),
      target: row.goal || "",
      memo: row.memo || "",
      expectedEndDate: row.expected_end_date,
    };
  }

  function normalizeLoadedPlan(item) {
    if (item && "study_date" in item) return planFromRow(item);
    return item;
  }

  function normalizeLoadedBookPlan(item) {
    if (item && "start_date" in item) return bookPlanFromRow(item);
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
    const value = Number(row?.star_count ?? row?.stars ?? 1);
    return {
      id: row.id,
      scheduleId: row.academy_schedule_id,
      completedDate: row.completed_date,
      stars: Number.isFinite(value) && value >= 0 ? value : 1,
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

  async function load({ essentialOnly = false } = {}) {
    const localData = readLocalData();
    if (!configured) {
      warnReadFallback("Supabase config is missing. Rendering fallback data.");
      return localData;
    }

    const remoteLoad = (async () => {
    const weekEnd = toDateInput(addDays(new Date(), 6));
    const planSelect = "id,subject,workbook,chapter,lesson,study_date,day_label,content,goal,status,book_plan_id,reading_plan_id,sequence_no,start_page,end_page,task_type,note,study_weekdays";
    let plansQuery = client.from("study_plans")
      .select(planSelect)
      .order("study_date", { ascending: true });
    if (essentialOnly) plansQuery = plansQuery.lte("study_date", weekEnd).not("status", "in", "(완료,done)");
    console.info("[study_plans query]", {
      select: planSelect,
      where: essentialOnly ? { study_date: `<=${weekEnd}`, status: "not in (완료,done)" } : {},
      order: { study_date: "asc" },
      cacheKey: localDataKey(),
    });
    if (!essentialOnly) ensureRewardSettings();

    const [
      { data: plans },
      { data: bookPlans },
      { data: reward },
      { data: rewardMilestones },
      { data: academySchedules },
      { data: academyCompletions },
    ] = await Promise.all([
      requestOrFallback(
        "학습계획 불러오기 실패",
        plansQuery,
        localData.plans
      ),
      requestOrFallback(
        "교재 계획 불러오기 실패",
        essentialOnly ? Promise.resolve({ data: localData.bookPlans || [], error: null }) : client.from("book_plans").select("id,subject,workbook,chapter,lesson,content,start_date,study_weekdays,start_page,end_page,pages_per_day,goal,memo,expected_end_date,updated_at").order("updated_at", { ascending: false }),
        localData.bookPlans || []
      ),
      requestOrFallback(
        "보상 설정 불러오기 실패",
        essentialOnly ? Promise.resolve({ data: localData.reward, error: null }) : client.from("reward_settings").select("id,target_stickers,reward_name").limit(1).maybeSingle(),
        localData.reward
      ),
      requestOrFallback(
        "보상 마일스톤 불러오기 실패",
        !essentialOnly && familyAuthHeaders()
          ? requestJson("/api/reward_milestones", { headers: familyAuthHeaders() })
              .then((result) => ({ data: result.milestones, error: null }))
              .catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: localData.rewardMilestones, error: null }),
        localData.rewardMilestones
      ),
      requestOrFallback(
        "학원 일정 불러오기 실패",
        essentialOnly ? Promise.resolve({ data: localData.academySchedules, error: null }) : client.from("academy_schedules").select("id,academy_name,day_of_week,start_time,memo,star_count").order("day_of_week", { ascending: true }).order("start_time", { ascending: true }),
        localData.academySchedules
      ),
      requestOrFallback(
        "학원 완료 이력 불러오기 실패",
        !essentialOnly && familyAuthHeaders()
          ? requestJson("/api/rewards/academy-complete", { headers: familyAuthHeaders() })
              .then((result) => ({ data: result.completions, error: null }))
              .catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: localData.academyCompletions, error: null }),
        localData.academyCompletions
      ),
    ]);

    const safePlans = Array.isArray(plans) ? plans : [];
    const safeAcademySchedules = Array.isArray(academySchedules) ? academySchedules : [];
    const safeAcademyCompletions = Array.isArray(academyCompletions) ? academyCompletions : [];

    console.log("Supabase study_plans count:", safePlans.length);
    console.log("Supabase study_plans rows:", safePlans);

    return {
      reward: reward?.target_stickers
        ? { id: reward.id, goal: reward.target_stickers, name: reward.reward_name }
        : reward?.goal
          ? reward
          : { ...DEFAULT_REWARD },
      rewardMilestones: normalizeRewardMilestones(rewardMilestones, reward),
      plans: safePlans.map(normalizeLoadedPlan),
      bookPlans: (Array.isArray(bookPlans) ? bookPlans : []).map(normalizeLoadedBookPlan),
      academySchedules: safeAcademySchedules.map(normalizeLoadedAcademySchedule),
      academyCompletions: safeAcademyCompletions.map(normalizeLoadedAcademyCompletion),
    };
    })();

    return remoteLoad;
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
    await request("학습계획 삭제 실패", client.from("study_plans").delete().eq("id", planId));
  }

  async function createBookPlan(input) {
    assertConfigured();
    const { data } = await request("교재 계획 생성 실패", client.rpc("create_book_plan", {
      p_subject: input.subject,
      p_workbook: input.book,
      p_lesson: input.unit,
      p_chapter: input.lessonNo,
      p_content: input.content || "",
      p_start_date: input.startDate,
      p_start_page: input.startPage,
      p_end_page: input.endPage,
      p_pages_per_day: input.pagesPerDay,
      p_study_weekdays: input.weekdays,
      p_goal: input.target || "",
      p_memo: input.memo || "",
    }));
    const result = Array.isArray(data) ? data[0] : data;
    return {
      generatedCount: Number(result?.generated_count || 0),
      firstStudyDate: result?.first_study_date || null,
      lastStudyDate: result?.last_study_date || null,
      rows: Array.isArray(result?.generated_rows) ? result.generated_rows : [],
    };
  }

  async function createReadingPlan(input) {
    const data = await requestJson("/api/study/reading-plans", {
      method: "POST",
      headers: familyAuthHeaders(),
      body: JSON.stringify(input),
    });
    return {
      readingPlanId: data.readingPlanId,
      generatedCount: Number(data.generatedCount || 0),
      firstStudyDate: data.firstStudyDate || null,
      lastStudyDate: data.lastStudyDate || null,
    };
  }

  async function addBookPlanReview(bookPlanId, afterSequence, content) {
    assertConfigured();
    await request("복습 일정 추가 실패", client.rpc("add_book_plan_review", {
      p_book_plan_id: bookPlanId,
      p_after_sequence: Number(afterSequence || 0),
      p_content: content || "복습",
    }));
  }

  async function updateBookPlanPages(bookPlanId, pagesPerDay) {
    assertConfigured();
    await request("하루 학습량 변경 실패", client.rpc("update_book_plan_pages", {
      p_book_plan_id: bookPlanId,
      p_pages_per_day: Number(pagesPerDay),
    }));
  }

  async function deleteBookPlanTask(id) {
    assertConfigured();
    await request("교재 일정 삭제 실패", client.rpc("delete_book_plan_task", { p_study_plan_id: String(id) }));
  }

  async function moveBookPlanForward(bookPlanId) {
    assertConfigured();
    await request("지연 일정 이동 실패", client.rpc("reflow_book_plan", {
      p_book_plan_id: bookPlanId,
      p_from_date: toDateInput(new Date()),
    }));
  }

  async function completePlan(id) {
    const authHeaders = familyAuthHeaders();
    if (!authHeaders) throw new Error("가족 사용자 인증이 필요해요.");
    const data = await requestJson("/api/rewards/study-complete", { method:"POST", headers:authHeaders, body:JSON.stringify({ planId:id }) });
    const result = data.completion;
    return {
      plan: result?.plan ? planFromRow(result.plan) : null,
      adjustmentType: result?.adjustmentType || "normal",
      rescheduledCount: Number(result?.rescheduledCount || 0),
      awardedStickerCount: Number(result?.awardedStickerCount ?? result?.stickerCount ?? 0),
      stickerCount: Number(result?.awardedStickerCount ?? result?.stickerCount ?? 0),
      rewardType: result?.rewardType || null,
      rewardReason: result?.rewardReason || "완료했어요!",
      balance: Number(result?.balance || 0),
      alreadyCompleted: result?.alreadyCompleted === true,
    };
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

    return planFromRow(data);
  }

  async function syncStickerForPlan(){/* Sticker awards are written only by the authenticated completion API. */}

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
    const rows = normalizeRewardMilestones(milestones).map((milestone) => ({
      required_stickers: milestone.stars,
      reward_name: milestone.name,
    }));
    await requestJson("/api/reward_milestones", { method: "PUT", headers: familyAuthHeaders(), body: JSON.stringify({ milestones: rows }) });
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
    const authHeaders = familyAuthHeaders();
    if (!authHeaders) throw new Error("가족 사용자 인증이 필요해요.");
    const data = await requestJson("/api/rewards/academy-complete", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ scheduleId: schedule.id, completedDate }),
    });
    return {completion:academyCompletionFromRow(data.completion),stickerCount:Number(data.stickerCount||0),balance:Number(data.balance||0)};
  }

  async function recordCompletionNotification(entry) {
    const payload = sanitizePayload({
      study_plan_id: entry.planId,
      title: entry.title,
      body: entry.body,
      delivered: entry.delivered,
      delivery_channel: entry.pushSubscription ? "push" : "browser",
      error_message: entry.errorMessage,
    });
    await requestJson("/api/completion_notifications", { method: "POST", headers: familyAuthHeaders(), body: JSON.stringify(payload) });
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
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_milestones" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_history" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_schedules" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_completion_history" }, onChange)
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
    createBookPlan,
    createReadingPlan,
    addBookPlanReview,
    updateBookPlanPages,
    deleteBookPlanTask,
    moveBookPlanForward,
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
  stickerCount: null,
  plans: [],
  bookPlans: [],
  academySchedules: [],
  academyCompletions: [],
};
state.formMode = "create";
let isParentMode = false;
let learningFilter = "due";
let isRemoteRefreshPending = false;
let remoteLoadPromise = null;
let activeCacheKey = localDataKey();
let installPrompt = null;
const PWA_INSTALLED_KEY = "study-sticker-pwa-installed-v1";
let parentPushState = { status: "idle", message: "", registered: false };
let parentNotificationPreferences = [];
const DEFAULT_STICKER_REWARDS={early_complete_count:3,on_time_complete_count:2,delayed_complete_count:1,no_date_complete_count:1,academy_complete_count:1};
let familyChatController = null;
let rewardStoreController = null;
let appReady = false;
let authenticationTransition = null;
let realtimeUnsubscribe = null;
let stickerWalletSnapshot = null;

function applyStickerWalletData(nextState = state) {
  if (!stickerWalletSnapshot) return { ...nextState, stickerCount: null };
  const rewardsByPlan = new Map(
    stickerWalletSnapshot.history.map((row) => [String(row.study_plan_id), row])
  );
  return {
    ...nextState,
    stickerCount: stickerWalletSnapshot.balance,
    plans: (nextState.plans || []).map((plan) => {
      const rewardRow = rewardsByPlan.get(String(plan.id));
      return rewardRow ? {
        ...plan,
        stickerRewardCount: Number(rewardRow.sticker_count || 0),
        stickerRewardType: rewardRow.reward_type,
        stickerRewardReason: rewardRow.reward_reason,
      } : plan;
    }),
  };
}

function handleStickerWalletLoaded(wallet) {
  stickerWalletSnapshot = {
    balance: Number(wallet.balance || 0),
    history: Array.isArray(wallet.stickerHistory) ? wallet.stickerHistory : [],
  };
  state = applyStickerWalletData(state);
  renderLearning();
  renderProgress();
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function comparePlans(a, b) {
  return a.studyDate.localeCompare(b.studyDate) || a.subject.localeCompare(b.subject, "ko");
}

function parseLocalDate(dateString) {
  const value = String(dateString || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatDateKey(date) {
  return toDateInput(date);
}

function getWeekStartSunday(date) {
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -date.getDay());
}

function getWeekEndSaturday(date) {
  return addDays(getWeekStartSunday(date), 6);
}

function compareCalendarPlans(a, b) {
  const groupOrder = String(a.planGroupId || a.plan_group_id || a.bookPlanId || "")
    .localeCompare(String(b.planGroupId || b.plan_group_id || b.bookPlanId || ""), "ko", { numeric: true });
  if (groupOrder) return groupOrder;
  const dayOrder = String(a.dayNo || "").localeCompare(String(b.dayNo || ""), "ko", { numeric: true });
  if (dayOrder) return dayOrder;
  const pageOrder = Number(a.startPage || 0) - Number(b.startPage || 0);
  if (pageOrder) return pageOrder;
  return String(a.id).localeCompare(String(b.id), "ko", { numeric: true });
}

function groupPlansByDate(plans) {
  const dates = new Map();
  const undated = [];
  plans.forEach((plan) => {
    const date = parseLocalDate(plan.studyDate);
    if (!date) {
      undated.push(plan);
      return;
    }
    const key = formatDateKey(date);
    if (!dates.has(key)) dates.set(key, []);
    dates.get(key).push(plan);
  });
  dates.forEach((items) => items.sort(compareCalendarPlans));
  undated.sort(compareCalendarPlans);
  return { dates, undated };
}

function groupPlansByWeek(plans) {
  const { dates, undated } = groupPlansByDate(plans);
  const weeks = new Map();
  dates.forEach((items, dateKey) => {
    const date = parseLocalDate(dateKey);
    const weekStart = formatDateKey(getWeekStartSunday(date));
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { weekStart, weekEnd: formatDateKey(getWeekEndSaturday(date)), dates: new Map() });
    }
    weeks.get(weekStart).dates.set(dateKey, items);
  });
  return { weeks: [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)), undated };
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
    state = applyStickerWalletData(await repository.load());
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
  return Number.isFinite(Number(state.stickerCount)) ? Number(state.stickerCount) : 0;
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

function completeAcademyLocally(schedule, date = toDateInput(new Date()), savedCompletion = null) {
  if (isAcademyCompleted(schedule.id, date)) return null;
  const completion = savedCompletion || {
    id: `local-academy-completion-${Date.now()}`,
    scheduleId: schedule.id,
    completedDate: date,
    stars: Number(schedule.stars || 1),
  };
  const rawEarnedStars = Number(completion?.stars ?? completion?.star_count ?? schedule?.stars ?? 1);
  const earnedStars = Number.isFinite(rawEarnedStars) && rawEarnedStars > 0 ? rawEarnedStars : 1;
  const currentStickerCount = Number(state.stickerCount);
  state = {
    ...state,
    academyCompletions: [...(state.academyCompletions || []), { ...completion, stars: earnedStars }],
    stickerCount: (Number.isFinite(currentStickerCount) ? currentStickerCount : 0) + earnedStars,
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
    let message=data.error||data.message||`${url} failed with ${response.status}`;
    if(response.status===401)message="로그인이 만료되었습니다. 다시 로그인해 주세요.";
    else if(response.status===403)message="권한이 없습니다.";
    else if(response.status===404&&data.code==="API_NOT_FOUND")message="학습 완료 API를 찾을 수 없습니다.";
    else if(response.status>=500)message="서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    const error=new Error(message);error.status=response.status;error.code=data.code;error.details=data.details||null;error.serverMessage=data.message||data.error||null;error.supabaseCode=data.supabaseCode||null;throw error;
  }
  return data;
}

function familyAuthHeaders() {
  const token = sessionStorage.getItem(FAMILY_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : null;
}

async function fetchPushPublicKey() {
  const data = await requestJson("/api/notifications/public-key");
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

async function notifyParentOfAcademyCompletion(schedule, completedDate) {
  return;
}

function render() {
  renderHeader();
  renderRoleControls();
  renderLearning();
  renderProgress();
  renderRewards();
  renderParent();
  rewardStoreController?.render();
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

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function getInstallMarker() {
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function setInstallMarker() {
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, "1");
  } catch (error) {
    console.warn("[pwa-install] install marker could not be saved:", error);
  }
}

function isKnownInstalled() {
  return isStandaloneDisplay() || getInstallMarker();
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updateInstallUI() {
  const panel = $("#installPanel");
  const button = $("#installAppButton");
  const help = $("#installHelp");
  if (!panel || !button || !help) return;

  if (isKnownInstalled()) {
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
  if (choice.outcome === "accepted") setInstallMarker();
  installPrompt = null;
  updateInstallUI();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
    .then(() => refreshParentPushRegistrationState())
    .catch((error) => {
      console.log("[service-worker] registration failed:", error);
    });
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
  const member = familyChatController?.currentMember();
  if (!member) return;
  $("#currentUserCard").classList.remove("startup-skeleton");
  $("#currentUserAvatar").textContent = member.avatar_emoji || "👤";
  $("#currentUserName").textContent = member.display_name || "가족 사용자";
  $("#currentUserRole").textContent = member.role === "parent" ? "부모로 로그인 중" : "자녀로 로그인 중";
}

function renderRoleControls() {
  const parentAuthenticated = familyChatController?.currentMember()?.role === "parent";
  if (!parentAuthenticated) isParentMode = false;
  $$("[data-parent-only]").forEach((element) => {
    element.hidden = !isParentMode;
  });
  $("#parentAccessButton").hidden = isParentMode || !parentAuthenticated;
}

function renderLearning() {
  $("#todayList").setAttribute("aria-busy", "false");
  const today = toDateInput(new Date());
  const currentWeekStart = getWeekStartSunday(new Date());
  const weekStart = formatDateKey(currentWeekStart);
  const weekEnd = formatDateKey(getWeekEndSaturday(currentWeekStart));
  $("#todayDate").textContent = formatDate(today);
  $$(".today-filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.learningFilter === learningFilter);
  });

  const duePlans = state.plans
    .filter((plan) => !isDoneStatus(plan.status) && plan.studyDate <= today)
    .sort(comparePlans);
  const weekPlans = state.plans
    .filter((plan) => !isDoneStatus(plan.status) && plan.studyDate >= weekStart && plan.studyDate <= weekEnd)
    .sort(comparePlans);
  const upcomingPlans = state.plans.filter((plan) => !isDoneStatus(plan.status));
  let plans = duePlans;

  if (learningFilter === "week") {
    if (!weekPlans.length) {
      $("#todayList").innerHTML = '<div class="empty"><h3>이번 주 예정된 학습이 없습니다.</h3></div>';
      return;
    }
    renderWeeklyCalendar([{
      weekStart,
      weekEnd,
      dates: groupPlansByDate(weekPlans).dates,
    }], { showPeriod: false });
    return;
  }
  if (learningFilter === "upcoming") {
    renderUpcomingCalendar(upcomingPlans);
    return;
  }
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

function parsePlanDate(plan) {
  const value = String(plan.studyDate || "");
  const date = parseLocalDate(value);
  if (!date) return { valid: false, value };
  return { valid: true, value, date, weekday: date.getDay() };
}

function formatUpcomingDate(dateInfo) {
  if (!dateInfo.valid) return "날짜 미지정";
  const options = dateInfo.date.getFullYear() === new Date().getFullYear()
    ? { month: "long", day: "numeric" }
    : { year: "numeric", month: "long", day: "numeric" };
  return new Intl.DateTimeFormat("ko-KR", options).format(dateInfo.date);
}

function formatCalendarPeriod(startKey, endKey) {
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
  return `${formatter.format(parseLocalDate(startKey))} ~ ${formatter.format(parseLocalDate(endKey))}`;
}

function isReadingPlan(plan) {
  return plan?.taskType === "reading_free" || plan?.taskType === "reading_pages";
}

function readingPageLabel(plan, suffix = "") {
  if (plan.startPage == null || plan.endPage == null) return "";
  return `${plan.startPage}~${plan.endPage}P${suffix}`;
}

function createCalendarStudyCard(plan) {
  const dateInfo = parsePlanDate(plan);
  const accessibleDate = dateInfo.valid ? `${formatUpcomingDate(dateInfo)} ${WEEKDAY_LABELS[dateInfo.weekday]}요일` : "날짜 미지정";
  const pageRange = plan.startPage != null && plan.endPage != null ? `${plan.startPage}~${plan.endPage}쪽` : plan.target || "";
  const title = `${plan.subject || ""} · ${plan.book || ""} / ${plan.unit || ""} / ${plan.lessonNo || ""} / ${plan.content || ""} / ${pageRange} / ${plan.dayNo || ""}`;
  const isToday = dateInfo.valid && dateInfo.value === formatDateKey(new Date());
  const status = isLateStatus(plan.status) || (dateInfo.valid && dateInfo.value < formatDateKey(new Date())) ? "지연" : isToday ? "오늘" : "예정";
  if (isReadingPlan(plan)) {
    const readingText = plan.taskType === "reading_free" ? "자유 독서" : readingPageLabel(plan, plan.book ? "" : " 읽기");
    return `<article class="study-card reading calendar-study-card calendar-plan-card ${status === "지연" ? "late" : "planned"}" title="${escapeHtml(`독서 / ${plan.book || readingText}`)}">
      <div class="calendar-plan-card__top"><span class="card-status calendar-plan-card__status status-${status === "지연" ? "late" : status === "오늘" ? "today" : "planned"}">${status}</span></div>
      <div class="calendar-plan-card__title"><strong class="calendar-plan-card__subject">📚 독서</strong></div>
      ${plan.book ? `<div class="calendar-plan-card__lesson">${escapeHtml(plan.book)}</div>` : ""}
      <div class="calendar-plan-card__task"><span class="calendar-plan-card__task-label">오늘 할 일</span><span class="calendar-plan-card__task-text">${escapeHtml(readingText)}</span></div>
      <button type="button" class="complete-btn calendar-plan-card__complete" data-action="complete" data-id="${plan.id}" aria-label="${escapeHtml(`${accessibleDate} 독서 완료`)}">완료</button>
    </article>`;
  }
  const lesson = [plan.unit, plan.lessonNo].filter(Boolean).join(" · ");
  return `<article class="study-card calendar-study-card calendar-plan-card ${status === "지연" ? "late" : "planned"}" title="${escapeHtml(title)}">
    <div class="calendar-plan-card__top">
      <span class="card-status calendar-plan-card__status status-${status === "지연" ? "late" : status === "오늘" ? "today" : "planned"}">${status}</span>
    </div>
    <div class="calendar-plan-card__title">
      <strong class="calendar-plan-card__subject">${escapeHtml(plan.subject || "과목 미지정")}</strong>
      <span class="calendar-plan-card__workbook">${escapeHtml(plan.book || "교재 미지정")}</span>
    </div>
    <div class="calendar-plan-card__lesson">${escapeHtml(lesson || "단원 정보 없음")}</div>
    <div class="calendar-plan-card__task">
      <span class="calendar-plan-card__task-label">오늘 할 일</span>
      <span class="calendar-plan-card__task-text">${escapeHtml(plan.content || "학습 내용 없음")}</span>
    </div>
    <div class="calendar-plan-card__meta">
      <strong class="calendar-plan-card__page-range">${escapeHtml(pageRange || "페이지 미지정")}</strong>
      ${plan.dayNo ? `<span class="calendar-plan-card__sequence">${escapeHtml(plan.dayNo)}</span>` : ""}
    </div>
    <button type="button" class="complete-btn calendar-plan-card__complete" data-action="complete" data-id="${plan.id}" aria-label="${escapeHtml(`${accessibleDate} ${plan.subject} ${plan.book} 완료`)}">완료</button>
  </article>`;
}

function renderCalendarDay(date, plans) {
  const dateKey = formatDateKey(date);
  const todayKey = formatDateKey(new Date());
  const overdue = dateKey < todayKey && plans.some((plan) => !isDoneStatus(plan.status));
  const hiddenCount = Math.max(plans.length - CALENDAR_VISIBLE_CARD_LIMIT, 0);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}요일, 학습계획 ${plans.length}개`;
  return `<section class="calendar-day ${plans.length ? "" : "is-empty"} ${dateKey === todayKey ? "is-today" : ""} ${overdue ? "has-overdue" : ""}" data-calendar-date="${dateKey}" aria-label="${label}">
    <header class="calendar-day-head"><strong>${date.getMonth() + 1}/${date.getDate()}</strong><span class="calendar-count">${plans.length}개</span>${dateKey === todayKey ? '<em class="calendar-badge today">오늘</em>' : ""}${overdue ? '<em class="calendar-badge late">지연</em>' : ""}</header>
    <div class="calendar-day-cards">${plans.map((plan, index) => `<div class="calendar-card-slot${index >= CALENDAR_VISIBLE_CARD_LIMIT ? " is-extra" : ""}">${createCalendarStudyCard(plan)}</div>`).join("")}</div>
    ${hiddenCount ? `<button type="button" class="calendar-more" data-action="toggle-calendar-day" aria-expanded="false">외 ${hiddenCount}개 더보기</button>` : ""}
  </section>`;
}

function renderWeeklyCalendar(weeks, options = {}) {
  const root = $("#todayList");
  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement("div");
  wrapper.className = "weekly-calendar-list";
  wrapper.innerHTML = weeks.map((week, weekIndex) => {
    const start = parseLocalDate(week.weekStart);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const headingId = `calendar-week-${week.weekStart}-${weekIndex}`;
    return `<section class="weekly-calendar" ${options.showPeriod === false ? 'aria-label="이번 주 학습 캘린더"' : `aria-labelledby="${headingId}"`}>
      ${options.showPeriod === false ? "" : `<h3 class="calendar-period" id="${headingId}">${formatCalendarPeriod(week.weekStart, week.weekEnd)}</h3>`}
      <div class="calendar-scroll"><div class="calendar-board">
        <div class="calendar-weekdays" role="row">${WEEKDAY_LABELS.map((label, index) => `<div role="columnheader" class="weekday weekday-${index}">${label}</div>`).join("")}</div>
        <div class="calendar-days">${days.map((date) => renderCalendarDay(date, week.dates.get(formatDateKey(date)) || [])).join("")}</div>
      </div></div>
    </section>`;
  }).join("");
  fragment.appendChild(wrapper);
  root.replaceChildren(fragment);
}

function renderUpcomingCalendar(plans) {
  const { weeks, undated } = groupPlansByWeek(plans);
  if (!weeks.length && !undated.length) {
    $("#todayList").innerHTML = '<div class="empty"><h3>예정된 학습이 없습니다.</h3></div>';
    return;
  }
  renderWeeklyCalendar(weeks, { showPeriod: true });
  if (undated.length) {
    $("#todayList").insertAdjacentHTML("beforeend", `<section class="undated-plans"><h3>날짜 미지정</h3><div>${undated.map(createStudyCard).join("")}</div></section>`);
  }
}

function createStudyCard(plan, options = {}) {
  const done = isDoneStatus(plan.status);
  const normalizedStatus = statusClass(plan.status);
  const isOverdue = !done && plan.studyDate < toDateInput(new Date());
  const displayStatus = isOverdue ? "\uC9C0\uC5F0" : statusLabels[plan.status] || statusLabels[normalizedStatus];
  const dateInfo = options.dateInfo || parsePlanDate(plan);
  const scheduleLabel = options.dateInfo ? `<div class="study-schedule-date"><strong>${escapeHtml(formatUpcomingDate(dateInfo))}</strong>${dateInfo.valid ? `<span>${WEEKDAY_LABELS[dateInfo.weekday]}요일</span>` : ""}${options.relativeLabel ? `<em class="schedule-relative ${options.relativeLabel === "지연" ? "late" : ""}">${options.relativeLabel}</em>` : ""}</div>` : "";
  const accessibleDate = dateInfo.valid ? `${formatUpcomingDate(dateInfo)} ${WEEKDAY_LABELS[dateInfo.weekday]}요일` : "날짜 미지정";
  const completeButtonHtml = `<button type="button" class="complete-btn" data-action="complete" data-id="${plan.id}" aria-label="${escapeHtml(`${accessibleDate} ${plan.subject} 학습 완료`)}">완료했어요!</button>`;
  if (!done) console.log("[complete-button-html]", completeButtonHtml);
  if (isReadingPlan(plan)) {
    const pageText = readingPageLabel(plan, plan.book ? "" : " 읽기");
    return `
      <article class="study-card reading ${isOverdue ? "late" : normalizedStatus} ${done ? "completed" : ""}">
        ${scheduleLabel}
        <span class="card-status reading-card-icon">${done ? "⭐" : "📚"} ${displayStatus}</span>
        <h3>📚 독서</h3>
        ${plan.book ? `<p>${escapeHtml(plan.book)}</p>` : ""}
        <div class="card-meta"><span>${plan.taskType === "reading_free" ? "오늘은 자유 독서하는 날이에요." : escapeHtml(pageText)}</span></div>
        ${done
          ? `<div class="complete-done">${escapeHtml(plan.stickerRewardReason||"독서 완료!")} ${Number(plan.stickerRewardCount||0)>0?`스티커 ${Number(plan.stickerRewardCount)}개를 받았어요.`:"이번 일정에는 지급되는 스티커가 없어요."}</div>`
          : completeButtonHtml}
      </article>`;
  }
  return `
    <article class="study-card ${isOverdue ? "late" : normalizedStatus} ${done ? "completed" : ""}">
      ${scheduleLabel}
      <span class="card-status">${done ? "⭐" : "📘"} ${displayStatus}</span>
      <h3>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)}</h3>
      <p>${escapeHtml(plan.unit)} / ${escapeHtml(plan.lessonNo)}</p>
      <div class="card-meta">
        <span>오늘 할 일: ${escapeHtml(plan.content)}</span>
        <span>목표: ${escapeHtml(plan.target)}</span>
        <span>${escapeHtml(plan.dayNo)}</span>
      </div>
      ${done
        ? `<div class="complete-done">${escapeHtml(plan.stickerRewardReason||"완료했어요!")} ${Number(plan.stickerRewardCount||0)>0?`스티커 ${Number(plan.stickerRewardCount)}개를 받았어요.`:"이번 일정에는 지급되는 스티커가 없어요."}</div>`
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
    const completion = await repository.completePlan(id);
    state = applyStickerWalletData(await repository.load());
    await markOverduePlans();
    writeLocalData(state);
    renderHeader();
    renderLearning();
    renderProgress();
    rewardStoreController?.scheduleRefresh();
    setConnectionStatus("");
    console.log("[complete-refresh-success]", id);
    if (!completion.alreadyCompleted) launchCelebration();
    if (completion.alreadyCompleted) {
      showToast("이미 완료된 학습이에요.");
    } else {
      showToast(`${completion.rewardReason} ${completion.awardedStickerCount>0?`스티커 ${completion.awardedStickerCount}개를 받았어요.`:"이번 일정에는 지급되는 스티커가 없어요."}`);
    }
  } catch (error) {
    if (isNetworkFallbackError(error)) {
      const completedPlan = markPlanCompleteLocally(id) || planBeforeComplete;
      renderHeader();
      renderLearning();
      renderProgress();
      setConnectionStatus("");
      launchCelebration();
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
  const saved=(state.academyCompletions||[]).find(item=>String(item.scheduleId||item.academy_schedule_id)===String(schedule.id)&&(item.completedDate||item.completed_date)===today);
  const stars = done?Number(saved?.stars??saved?.star_count??0):Number(schedule.stars || 1);
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
        ? `<div class="complete-done">학원을 잘 다녀왔어요! ${stars>0?`스티커 ${stars}개를 받았어요.`:"이번 일정에는 지급되는 스티커가 없어요."}</div>`
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

function renderBookProjectCard(project) {
  const tasks = state.plans.filter((plan) => plan.bookPlanId === project.id).sort((a, b) => a.sequenceNo - b.sequenceNo || a.studyDate.localeCompare(b.studyDate));
  const completed = tasks.filter((plan) => isDoneStatus(plan.status)).length;
  const remaining = tasks.length - completed;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  return `<details class="book-project-card">
    <summary>
      <div><span>${escapeHtml(project.subject)}</span><h3>${escapeHtml(project.book)}</h3><p>${escapeHtml(project.unit)} · ${completed} / ${tasks.length} 완료 · 남은 일정 ${remaining}회</p></div>
      <div class="book-project-progress"><strong>${progress}%</strong><i><b style="width:${progress}%"></b></i><small>예상 완료일 ${project.expectedEndDate ? escapeHtml(formatDate(project.expectedEndDate)) : "-"}</small></div>
    </summary>
    <div class="book-project-toolbar">
      <button type="button" data-action="change-book-pages" data-book-plan-id="${project.id}" data-pages="${project.pagesPerDay}">하루 학습량 변경</button>
      <button type="button" data-action="add-book-review" data-book-plan-id="${project.id}" data-sequence="${tasks.at(-1)?.sequenceNo || 0}">복습 일정 추가</button>
    </div>
    <div class="book-project-tasks">${tasks.map((plan) => `<article class="book-project-task ${isDoneStatus(plan.status) ? "done" : isLateStatus(plan.status) ? "late" : ""}">
      <span>${escapeHtml(plan.dayNo || `${plan.sequenceNo}일차`)}</span><time>${escapeHtml(formatDate(plan.studyDate))}</time>
      <strong>${plan.taskType === "review" ? escapeHtml(plan.content || "복습") : `${plan.startPage}~${plan.endPage}쪽`}</strong>
      <em>${isDoneStatus(plan.status) ? "완료" : isLateStatus(plan.status) ? "지연" : "예정"}</em>
      ${isDoneStatus(plan.status) ? "" : `<div>${isLateStatus(plan.status) ? `<button type="button" data-action="move-book-task" data-book-plan-id="${project.id}">다음 학습일로 이동</button><button type="button" data-action="keep-book-task">그대로 유지</button>` : ""}<button type="button" data-action="add-book-review" data-book-plan-id="${project.id}" data-sequence="${plan.sequenceNo}">뒤에 복습</button><button type="button" class="delete-btn" data-action="delete-book-task" data-id="${plan.id}">삭제</button></div>`}
    </article>`).join("")}</div>
  </details>`;
}

function renderStandalonePlanItem(plan) {
  const reading = isReadingPlan(plan);
  const title = reading ? `📚 독서${plan.book ? ` · ${plan.book}` : ""}` : `${plan.subject} · ${plan.book}`;
  const detail = reading
    ? plan.taskType === "reading_free" ? "자유 독서" : readingPageLabel(plan, plan.book ? "" : " 읽기")
    : `${plan.unit} · ${plan.target}`;
  return `<article class="plan-item ${reading ? "reading" : ""}">
    <div>
      <h4>${escapeHtml(title)} <span class="status-badge status-${statusClass(plan.status)}">${statusLabels[plan.status] || statusLabels[statusClass(plan.status)]}</span></h4>
      <p>${escapeHtml(formatDate(plan.studyDate))} · ${escapeHtml(detail)}</p>
    </div>
    <div class="plan-actions">
      ${reading ? "" : `<button type="button" class="copy-btn" data-action="copy" data-id="${plan.id}">복사</button><button type="button" class="edit-btn" data-action="edit" data-id="${plan.id}">수정</button>`}
      <button type="button" class="delete-btn" data-action="delete" data-id="${plan.id}">삭제</button>
    </div>
  </article>`;
}

function renderParent() {
  $$(".startup-metric-skeleton").forEach((element) => element.classList.remove("startup-metric-skeleton"));
  const total = state.plans.length;
  const done = state.plans.filter((plan) => isDoneStatus(plan.status)).length;
  const late = state.plans.filter((plan) => isLateStatus(plan.status)).length;
  $("#totalPlans").textContent = total;
  $("#donePlans").textContent = done;
  $("#latePlans").textContent = late;
  $("#weeklyRate").textContent = `${calculateWeeklyRate()}%`;
  renderAcademyScheduleAdmin();
  renderParentNotificationSettings();

  const projects = (state.bookPlans || []).map(renderBookProjectCard).join("");
  const standalone = [...state.plans].filter((plan) => !plan.bookPlanId)
    .sort((a, b) => b.studyDate.localeCompare(a.studyDate))
    .map(renderStandalonePlanItem).join("");
  $("#planList").innerHTML = `${projects}${standalone ? `<section class="standalone-plan-list"><h3>독서 및 하루 계획</h3>${standalone}</section>` : ""}${!projects && !standalone ? '<div class="empty">등록된 학습 계획이 없습니다.</div>' : ""}`;
}

function fillStickerRewardSettings(settings=DEFAULT_STICKER_REWARDS){const form=$("#stickerRewardSettingsForm");if(!form)return;for(const [key,value] of Object.entries(settings))if(form.elements[key])form.elements[key].value=String(value)}
async function loadStickerRewardSettings(){const headers=familyAuthHeaders();if(!headers||familyChatController?.currentMember()?.role!=="parent")return;try{const data=await requestJson("/api/rewards/sticker-settings",{headers});fillStickerRewardSettings(data.settings);$("#stickerRewardSettingsError").textContent=""}catch(error){$("#stickerRewardSettingsError").textContent=error.message}}
async function saveStickerRewardSettings(event){event.preventDefault();const form=event.currentTarget,button=$("#saveStickerRewardSettings"),error=$("#stickerRewardSettingsError"),payload={};error.textContent="";for(const key of Object.keys(DEFAULT_STICKER_REWARDS)){const value=Number(form.elements[key].value);if(!Number.isInteger(value)||value<0||value>20){error.textContent="스티커 개수는 0개부터 20개까지 입력해 주세요.";return}payload[key]=value}button.disabled=true;button.textContent="저장 중…";try{const data=await requestJson("/api/rewards/sticker-settings",{method:"PUT",headers:familyAuthHeaders(),body:JSON.stringify(payload)});fillStickerRewardSettings(data.settings);showToast("스티커 지급 설정이 저장되었습니다.")}catch(e){error.textContent=e.message}finally{button.disabled=false;button.textContent="저장"}}

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
      <span class="academy-admin-icon" aria-hidden="true">🏫</span>
      <div class="academy-admin-info">
        <strong>${escapeHtml(schedule.name)}</strong>
        <span>${escapeHtml(WEEKDAY_LABELS[Number(schedule.dayOfWeek)] || "")} · ${escapeHtml(schedule.time || "")} · 별 ${Number(schedule.stars || 1)}개</span>
        ${schedule.memo ? `<small>${escapeHtml(schedule.memo)}</small>` : `<small class="academy-admin-empty-memo">메모 없음</small>`}
      </div>
      <div class="plan-actions academy-admin-actions">
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
  if($("#academyStars")) $("#academyStars").value = "1";
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
  renderNotificationPreferences();
}

function renderNotificationPreferences() {
  const root = $("#parentNotificationPreferences");
  if (!root) return;
  if (!familyAuthHeaders()) {
    root.innerHTML = `<p class="empty-note">가족방에 로그인하면 가족별 알림 설정을 바꿀 수 있어요.</p>`;
    return;
  }
  if (!parentNotificationPreferences.length) {
    root.innerHTML = `<button type="button" id="loadNotificationPreferencesButton">알림 설정 불러오기</button>`;
    $("#loadNotificationPreferencesButton")?.addEventListener("click", loadNotificationPreferences);
    return;
  }
  const labels = [
    ["study_complete_enabled", "학습 완료"],
    ["family_chat_enabled", "가족방"],
    ["reward_request_enabled", "보상 신청"],
    ["overdue_study_enabled", "지연 학습"],
  ];
  root.innerHTML = parentNotificationPreferences.map((pref) => `
    <div class="notification-preference-row" data-member-key="${escapeHtml(pref.member_key)}">
      <strong>${escapeHtml(pref.member_key)}</strong>
      ${labels.map(([field, label]) => `<label><input type="checkbox" data-notification-field="${field}" ${pref[field] !== false ? "checked" : ""}>${label}</label>`).join("")}
    </div>
  `).join("");
}

async function loadNotificationPreferences() {
  const authHeaders = familyAuthHeaders();
  if (!authHeaders) return;
  try {
    const data = await requestJson("/api/notifications/preferences", { headers: authHeaders });
    parentNotificationPreferences = data.preferences || [];
    renderNotificationPreferences();
  } catch (error) {
    console.warn("[notifications] preferences load failed", error);
  }
}

async function handleNotificationPreferenceChange(event) {
  const input = event.target.closest("[data-notification-field]");
  if (!input) return;
  const row = input.closest("[data-member-key]");
  const authHeaders = familyAuthHeaders();
  if (!row || !authHeaders) return;
  const memberKey = row.dataset.memberKey;
  const field = input.dataset.notificationField;
  try {
    await requestJson("/api/notifications/preferences", {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ member_key: memberKey, [field]: input.checked }),
    });
    parentNotificationPreferences = parentNotificationPreferences.map((pref) => pref.member_key === memberKey ? { ...pref, [field]: input.checked } : pref);
  } catch (error) {
    input.checked = !input.checked;
    showToast(error.message || "알림 설정을 저장하지 못했어요.");
  }
}

async function handleEnableParentNotifications() {
  try {
    const authHeaders = familyAuthHeaders();
    if (!authHeaders) throw new Error("가족방에 로그인한 뒤 알림을 설정할 수 있어요.");
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

    await requestJson("/api/notifications/subscribe", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ subscription: subscription.toJSON(), deviceName: navigator.platform || "브라우저" }),
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
    const authHeaders = familyAuthHeaders();
    if (!authHeaders) throw new Error("가족방에 로그인한 뒤 테스트 알림을 보낼 수 있어요.");
    await requestJson("/api/notifications/test", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ type: "test" }),
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

  if (String(schedule.id).startsWith("local-")) {
    if (button) {
      button.disabled = false;
      button.textContent = "잘 다녀왔어요";
    }
    showToast("학원 일정이 서버에 저장된 뒤 완료할 수 있어요.");
    return;
  }

  let savedCompletion = null;
  try {
    savedCompletion = await repository.completeAcademySchedule(schedule, today);
  } catch (error) {
    console.warn("[academy] completion failed", error);
    if (button) {
      button.disabled = false;
      button.textContent = "잘 다녀왔어요";
    }
    showToast(error?.message || "학원 완료를 저장하지 못했어요.");
    return;
  }

  completeAcademyLocally(schedule, today, savedCompletion.completion);
  rewardStoreController?.scheduleRefresh();
  renderApp();
  setConnectionStatus("");
  launchCelebration();
  showToast(`학원을 잘 다녀왔어요! ${savedCompletion.stickerCount>0?`스티커 ${savedCompletion.stickerCount}개를 받았어요.`:"이번 일정에는 지급되는 스티커가 없어요."}`);

  await notifyParentOfAcademyCompletion(schedule, today);
  await rewardStoreController?.refresh({ silent: true });
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
  selectPlanRegistrationMode("daily");
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
  selectPlanRegistrationMode("daily");
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

async function handleAddBookReview(bookPlanId, sequence) {
  if (!isParentMode) return;
  const content = window.prompt("추가할 복습 내용을 입력해 주세요.", "복습");
  if (content === null) return;
  await saveAndRender("복습 일정을 추가하고 이후 날짜를 재배치했습니다.", () => repository.addBookPlanReview(bookPlanId, sequence, content));
}

async function handleChangeBookPages(bookPlanId, currentPages) {
  if (!isParentMode) return;
  const value = window.prompt("앞으로 하루에 학습할 페이지 수를 입력해 주세요.", String(currentPages || 4));
  if (value === null) return;
  const pages = Number(value);
  if (!Number.isInteger(pages) || pages < 1) {
    showToast("하루 학습량은 1 이상의 숫자로 입력해 주세요.");
    return;
  }
  await saveAndRender("미완료 일정을 새로운 학습량으로 다시 계산했습니다.", () => repository.updateBookPlanPages(bookPlanId, pages));
}

async function handleDeleteBookTask(id) {
  if (!isParentMode || !window.confirm("이 일정을 삭제하고 이후 페이지와 날짜를 다시 계산할까요?")) return;
  await saveAndRender("일정을 삭제하고 이후 계획을 다시 계산했습니다.", () => repository.deleteBookPlanTask(id));
}

async function handleMoveBookTask(bookPlanId) {
  if (!isParentMode || !window.confirm("이 일정부터 다음 가능한 학습일로 이동할까요?")) return;
  await saveAndRender("지연 일정과 이후 일정을 이동했습니다.", () => repository.moveBookPlanForward(bookPlanId));
}

function resetForm() {
  $("#planForm").reset();
  $("#planId").value = "";
  $("#studyDate").value = toDateInput(new Date());
  $("#status").value = "planned";
  state.formMode = "create";
  updatePlanSubmitButton();
}

function selectedBookPlanWeekdays() {
  return $$('input[name="bookPlanWeekday"]:checked').map((input) => Number(input.value));
}

function readBookPlanForm() {
  return {
    subject: $("#bookPlanSubject").value.trim(),
    book: $("#bookPlanName").value.trim(),
    unit: $("#bookPlanUnit").value.trim(),
    lessonNo: $("#bookPlanLesson").value.trim(),
    content: $("#bookPlanContent").value.trim(),
    startDate: $("#bookPlanStartDate").value,
    weekdays: selectedBookPlanWeekdays(),
    startPage: Number($("#bookPlanStartPage").value),
    endPage: Number($("#bookPlanEndPage").value),
    pagesPerDay: Number($("#bookPlanPagesPerDay").value),
    target: $("#bookPlanGoal").value.trim(),
    memo: $("#bookPlanMemo").value.trim(),
  };
}

function calculateBookPlanSchedule(input) {
  if (!input.startDate || !input.weekdays.length || input.startPage < 1 || input.endPage < input.startPage || input.pagesPerDay < 1) return [];
  const result = [];
  let page = input.startPage;
  const date = new Date(`${input.startDate}T12:00:00`);
  while (page <= input.endPage && result.length < 1000) {
    if (input.weekdays.includes(date.getDay())) {
      const endPage = Math.min(page + input.pagesPerDay - 1, input.endPage);
      result.push({ sequenceNo: result.length + 1, studyDate: toDateInput(date), startPage: page, endPage });
      page = endPage + 1;
    }
    date.setDate(date.getDate() + 1);
  }
  return result;
}

function renderBookPlanPreview() {
  const input = readBookPlanForm();
  const schedules = calculateBookPlanSchedule(input);
  const calculation = $("#bookPlanCalculation");
  const preview = $("#bookPlanPreview");
  const button = $("#createBookPlanButton");
  if (!schedules.length) {
    calculation.innerHTML = "<span>페이지 범위와 학습 요일을 입력하면 계획을 자동으로 계산합니다.</span>";
    preview.innerHTML = "";
    button.disabled = true;
    return;
  }
  const totalPages = input.endPage - input.startPage + 1;
  const expectedEnd = schedules.at(-1).studyDate;
  calculation.innerHTML = `<strong>총 ${totalPages}페이지</strong><strong>총 ${schedules.length}회</strong><span>예상 완료일 ${escapeHtml(formatDate(expectedEnd))}</span>`;
  preview.innerHTML = `<h4>생성 미리보기</h4><div>${schedules.map((schedule) => `<article><strong>${schedule.sequenceNo}일차</strong><span>${escapeHtml(formatDate(schedule.studyDate))}</span><b>${schedule.startPage}~${schedule.endPage}쪽</b></article>`).join("")}</div>`;
  button.disabled = false;
}

function resetBookPlanForm() {
  window.setTimeout(() => {
    $("#bookPlanStartDate").value = toDateInput(new Date());
    $("#bookPlanPagesPerDay").value = "4";
    renderBookPlanPreview();
  });
}

function selectPlanRegistrationMode(mode) {
  $$('[data-plan-mode]').forEach((input) => { input.checked = input.dataset.planMode === mode; });
  $$('[data-plan-form]').forEach((panel) => { panel.hidden = panel.dataset.planForm !== mode; });
}

async function handleBookPlanSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const form = event.currentTarget;
  const button = $("#createBookPlanButton");
  const input = readBookPlanForm();
  if (!input.weekdays.length) {
    showToast("학습 요일을 하나 이상 선택해 주세요.");
    return;
  }
  button.disabled = true;
  button.textContent = "계획 생성 중...";
  try {
    const result = await repository.createBookPlan(input);
    state = applyStickerWalletData(await repository.load());
    ensureFormMode();
    await markOverduePlans();
    writeLocalData(state);
    render();
    setConnectionStatus("");
    const range = result.firstStudyDate && result.lastStudyDate
      ? ` (${formatDate(result.firstStudyDate)} ~ ${formatDate(result.lastStudyDate)})`
      : "";
    showToast(`교재 계획 ${result.generatedCount}건을 생성했습니다.${range}`);
    form.reset();
    resetBookPlanForm();
  } catch (error) {
    console.error("[create_book_plan] failed", { error, input });
    showToast("교재 계획 생성에 실패했습니다. 설정을 확인해주세요.");
  } finally {
    button.textContent = "전체 계획 생성";
    renderBookPlanPreview();
  }
}

function selectedReadingWeekdays() {
  return $$('input[name="readingWeekday"]:checked').map((input) => Number(input.value));
}

function readReadingPlanForm() {
  const mode = $('input[name="readingMode"]:checked')?.value || "free";
  return {
    mode,
    weekdays: selectedReadingWeekdays(),
    bookTitle: mode === "pages" ? $("#readingBookTitle").value.trim() : "",
    startPage: mode === "pages" ? Number($("#readingStartPage").value) : null,
    endPage: mode === "pages" ? Number($("#readingEndPage").value) : null,
  };
}

function calculateReadingDates(weekdays) {
  if (!weekdays.length) return [];
  const dates = [];
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  for (let offset = 0; offset < 28; offset += 1) {
    if (weekdays.includes(date.getDay())) dates.push(toDateInput(date));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

function renderReadingPlanPreview() {
  const input = readReadingPlanForm();
  const pages = input.mode === "pages";
  const pageFields = $("#readingPageFields");
  pageFields.hidden = !pages;
  $("#readingStartPage").required = pages;
  $("#readingEndPage").required = pages;
  const dates = calculateReadingDates(input.weekdays);
  const pagesValid = !pages || (Number.isInteger(input.startPage) && Number.isInteger(input.endPage) && input.startPage > 0 && input.endPage >= input.startPage);
  const preview = $("#readingPlanPreview");
  const button = $("#createReadingPlanButton");
  if (!dates.length) {
    preview.innerHTML = "<span>독서 요일을 하나 이상 선택해 주세요.</span>";
    button.disabled = true;
    return;
  }
  if (!pagesValid) {
    preview.innerHTML = "<span>읽을 페이지 범위를 입력해 주세요.</span>";
    button.disabled = true;
    return;
  }
  const description = pages
    ? `${input.bookTitle ? `${escapeHtml(input.bookTitle)} · ` : ""}${input.startPage}~${input.endPage}P`
    : "오늘은 자유 독서하는 날이에요.";
  preview.innerHTML = `<strong>앞으로 4주 · 총 ${dates.length}회</strong><span> ${description}</span><small> ${escapeHtml(formatDate(dates[0]))} ~ ${escapeHtml(formatDate(dates.at(-1)))}</small>`;
  button.disabled = false;
}

function resetReadingPlanForm() {
  window.setTimeout(() => {
    $("#readingPlanForm").reset();
    renderReadingPlanPreview();
  });
}

async function handleReadingPlanSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const input = readReadingPlanForm();
  if (!input.weekdays.length) {
    showToast("독서 요일을 하나 이상 선택해 주세요.");
    return;
  }
  const button = $("#createReadingPlanButton");
  button.disabled = true;
  button.textContent = "독서 계획 만드는 중...";
  try {
    const result = await repository.createReadingPlan(input);
    state = applyStickerWalletData(await repository.load());
    await markOverduePlans();
    writeLocalData(state);
    render();
    setConnectionStatus("");
    showToast(`독서 계획 ${result.generatedCount}건을 만들었습니다.`);
    resetReadingPlanForm();
  } catch (error) {
    console.error("[create reading plan failed]", { status: error.status || 0, code: error.code || null, message: error.message });
    showToast(error.message || "독서 계획을 만들지 못했습니다.");
  } finally {
    button.textContent = "4주 독서 계획 만들기";
    renderReadingPlanPreview();
  }
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
    stars: 1,
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
  if($("#academyStars")) $("#academyStars").value = String(schedule.stars || 1);
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
  if (familyChatController?.currentMember()?.role !== "parent") {
    showToast("부모 사용자로 인증해야 부모관리를 이용할 수 있어요.");
    return;
  }
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
  loadNotificationPreferences();
  loadStickerRewardSettings();
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
    setInstallMarker();
    $("#installPanel").hidden = true;
    console.log("[pwa-install] app installed.");
  });

  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", updateInstallUI);

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
    const calendarMoreButton = event.target.closest('[data-action="toggle-calendar-day"]');
    if (calendarMoreButton) {
      const day = calendarMoreButton.closest(".calendar-day");
      const expanded = day.classList.toggle("is-expanded");
      calendarMoreButton.setAttribute("aria-expanded", String(expanded));
      const hiddenCount = day.querySelectorAll(".calendar-card-slot.is-extra").length;
      calendarMoreButton.textContent = expanded ? "접기" : `외 ${hiddenCount}개 더보기`;
      return;
    }

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

    const addReviewButton = event.target.closest('[data-action="add-book-review"]');
    if (addReviewButton) {
      event.preventDefault();
      await handleAddBookReview(addReviewButton.dataset.bookPlanId, addReviewButton.dataset.sequence);
      return;
    }

    const changePagesButton = event.target.closest('[data-action="change-book-pages"]');
    if (changePagesButton) {
      event.preventDefault();
      await handleChangeBookPages(changePagesButton.dataset.bookPlanId, changePagesButton.dataset.pages);
      return;
    }

    const deleteBookTaskButton = event.target.closest('[data-action="delete-book-task"]');
    if (deleteBookTaskButton) {
      event.preventDefault();
      await handleDeleteBookTask(deleteBookTaskButton.dataset.id);
      return;
    }

    const moveBookTaskButton = event.target.closest('[data-action="move-book-task"]');
    if (moveBookTaskButton) {
      event.preventDefault();
      await handleMoveBookTask(moveBookTaskButton.dataset.bookPlanId);
      return;
    }

    const keepBookTaskButton = event.target.closest('[data-action="keep-book-task"]');
    if (keepBookTaskButton) {
      event.preventDefault();
      showToast("현재 날짜와 지연 상태를 그대로 유지합니다.");
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
  $("#changeCurrentUserButton").addEventListener("click", () => familyChatController?.changeUser());
  $("#startupRetryButton").addEventListener("click", async () => {
    $("#startupRetryButton").hidden = true;
    setConnectionStatus("데이터를 다시 불러오는 중입니다...");
    await Promise.allSettled([reloadFromRemote({ essentialOnly: true }), rewardStoreController?.refresh({ silent: true })]);
    render();
  });
  $("#returnChildButton").addEventListener("click", exitParentMode);
  $("#installAppButton").addEventListener("click", promptInstallApp);
  $("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  $("#closePasswordButton").addEventListener("click", closePasswordDialog);
  $("#planForm").addEventListener("submit", handlePlanSubmit);
  $("#bookPlanForm")?.addEventListener("submit", handleBookPlanSubmit);
  $("#bookPlanForm")?.addEventListener("input", renderBookPlanPreview);
  $("#bookPlanForm")?.addEventListener("change", renderBookPlanPreview);
  $("#resetBookPlanButton")?.addEventListener("click", resetBookPlanForm);
  $("#readingPlanForm")?.addEventListener("submit", handleReadingPlanSubmit);
  $("#readingPlanForm")?.addEventListener("input", renderReadingPlanPreview);
  $("#readingPlanForm")?.addEventListener("change", renderReadingPlanPreview);
  $("#resetReadingPlanButton")?.addEventListener("click", resetReadingPlanForm);
  $$('[data-plan-mode]').forEach((input) => input.addEventListener("change", () => selectPlanRegistrationMode(input.dataset.planMode)));
  $("#academyForm")?.addEventListener("submit", handleAcademySubmit);
  $("#stickerRewardSettingsForm")?.addEventListener("submit",saveStickerRewardSettings);
  $("#resetStickerRewardSettings")?.addEventListener("click",()=>fillStickerRewardSettings());
  $("#rewardForm")?.addEventListener("submit", handleRewardSubmit);
  $("#enableParentNotificationButton")?.addEventListener("click", handleEnableParentNotifications);
  $("#testParentNotificationButton")?.addEventListener("click", handleTestParentNotification);
  $("#parentNotificationPreferences")?.addEventListener("change", handleNotificationPreferenceChange);
  $("#resetFormButton").addEventListener("click", resetForm);
  $("#resetAcademyFormButton")?.addEventListener("click", resetAcademyForm);
}

async function reloadFromRemote(options = {}) {
  if (isRemoteRefreshPending) return remoteLoadPromise;
  isRemoteRefreshPending = true;
  remoteLoadPromise = (async () => {
    try {
      const previous = JSON.stringify(state);
      state = applyStickerWalletData(await repository.load(options));
      ensureFormMode();
      if (!options.essentialOnly) await markOverduePlans();
      writeLocalData(state);
      if (JSON.stringify(state) !== previous) render();
      setConnectionStatus(navigator.onLine ? "" : "오프라인입니다. 저장된 정보를 표시합니다.");
    } catch (error) {
      handleRepositoryError(error);
    } finally {
      isRemoteRefreshPending = false;
      remoteLoadPromise = null;
    }
  })();
  return remoteLoadPromise;
}

function deferStartupTask(callback) {
  if ("requestIdleCallback" in window) return window.requestIdleCallback(callback, { timeout: 1500 });
  return window.setTimeout(callback, 200);
}

function reportStartupPerformance() {
  console.info("[startup performance]", { ...startupMetrics, requests: [...startupMetrics.requests] });
}

async function initApp() {
  renderStoredUserHint();
  bindEvents();
  initParentDashboard();
  console.log(`[build] Data source: Supabase / Build: ${BUILD_VERSION}`);
  requestAnimationFrame(() => {
    startupMetrics.appShellMs = Math.round(performance.now() - startupStartedAt);
    console.info("[startup] app shell visible", { ms: startupMetrics.appShellMs });
  });
  deferStartupTask(registerServiceWorker);
  updateInstallUI();
  resetForm();
  resetBookPlanForm();
  resetReadingPlanForm();
  resetAcademyForm();
  setConnectionStatus("로그인 정보를 확인하고 있어요...");
  const authStartedAt = performance.now();
  familyChatController = await initFamilyChat();
  if (!familyChatController.isAuthenticated()) await familyChatController.requireAuthentication();
  startupMetrics.authMs = Math.round(performance.now() - authStartedAt);
  await enterAuthenticatedApp();
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (["today", "progress", "rewards", "family-chat"].includes(requestedTab)) switchView(requestedTab);
}

async function enterAuthenticatedApp() {
  if (authenticationTransition) return authenticationTransition;
  authenticationTransition = (async () => {
    activeCacheKey = localDataKey();
    const currentMember = familyChatController?.currentMember();
    stickerWalletSnapshot = null;
    console.info("[startup auth]", {
      member_key: currentMember?.member_key || null,
      family_id: currentMember?.family_id || null,
      role: currentMember?.role || null,
      cacheKey: activeCacheKey,
    });
    state = readLocalData();
    ensureFormMode();
    const hasCachedData = state.plans.length || state.academySchedules.length;
    renderHeader();
    renderRoleControls();
    if (hasCachedData) {
      render();
      startupMetrics.firstContentMs ??= Math.round(performance.now() - startupStartedAt);
    }
    setConnectionStatus(hasCachedData ? "최신 사용자 정보를 확인하고 있어요..." : "사용자 정보를 불러오고 있어요...");
    try {
      const slowTimer = window.setTimeout(() => setConnectionStatus("데이터를 불러오는 중입니다..."), 5000);
      const retryTimer = window.setTimeout(() => {
        setConnectionStatus("데이터 연결이 지연되고 있습니다. 저장된 화면을 계속 사용할 수 있어요.");
        $("#startupRetryButton").hidden = false;
      }, 10000);
      const rewardTask = rewardStoreController
        ? rewardStoreController.refresh({ silent: true })
        : initRewardStore({
            openFamily: () => switchView("family-chat"),
            returnToRewards: () => switchView("rewards"),
            onStickerData: handleStickerWalletLoaded,
          })
            .then((controller) => { rewardStoreController = controller; });
      await reloadFromRemote({ essentialOnly: true });
      render();
      startupMetrics.firstContentMs ??= Math.round(performance.now() - startupStartedAt);
      await Promise.allSettled([rewardTask]);
      window.clearTimeout(slowTimer);
      window.clearTimeout(retryTimer);
      $("#startupRetryButton").hidden = true;
      render();
      startupMetrics.essentialDataMs = Math.round(performance.now() - startupStartedAt);
      appReady = true;
      realtimeUnsubscribe?.();
      realtimeUnsubscribe = repository.subscribe(() => {
        reloadFromRemote();
        rewardStoreController?.scheduleRefresh();
      }, handleRepositoryError);
      deferStartupTask(async () => {
        await reloadFromRemote({ essentialOnly: false });
        startupMetrics.deferredDataMs = Math.round(performance.now() - startupStartedAt);
        reportStartupPerformance();
      });
    } catch (error) {
      console.warn("[startup] authenticated data load failed", error);
      render();
      appReady = true;
      setConnectionStatus(hasCachedData ? "저장된 정보를 표시하고 있습니다. 연결되면 자동으로 최신화됩니다." : "인터넷 연결을 확인해 주세요.");
    }
  })().finally(() => { authenticationTransition = null; });
  return authenticationTransition;
}

window.addEventListener("online", () => { if (appReady) reloadFromRemote(); });
window.addEventListener("offline", () => setConnectionStatus("오프라인입니다. 저장된 정보를 표시합니다."));
window.addEventListener("family-auth-changed", async (event) => {
  if (!appReady) return;
  if (event.detail?.authenticated === false) {
    localStorage.removeItem(activeCacheKey);
    appReady = false;
    realtimeUnsubscribe?.();
    realtimeUnsubscribe = null;
    $("#todayList").setAttribute("aria-busy", "true");
    await familyChatController?.requireAuthentication();
  }
  if (familyChatController?.isAuthenticated()) await enterAuthenticatedApp();
});

let initializationPromise = null;
function initializeOnce() {
  if (!initializationPromise) initializationPromise = initApp().catch((error) => {
    console.error("[startup] initialization failed", error);
    setConnectionStatus("앱을 시작하지 못했습니다. 사용자 변경 또는 새로고침으로 다시 시도해 주세요.");
    throw error;
  });
  return initializationPromise;
}

initializeOnce();




