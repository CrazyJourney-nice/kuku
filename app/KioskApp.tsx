"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { StepProgress } from "@/src/components/kiosk/StepProgress";
import { ErrorBoundary } from "@/src/components/kiosk/ErrorBoundary";
import { ScreenTransitionDeck } from "@/src/components/kiosk/ScreenTransitionDeck";
import {
  SliceAsset,
  type SliceCrop,
} from "@/src/components/media/SliceAsset";
import {
  PersistentKukuStage,
  type MascotCue,
} from "@/src/components/mascot/KukuStage";
import { copy } from "@/src/content/copy.zh-CN";
import { drinks, getDrinkById } from "@/src/content/drinks";
import { impactContent } from "@/src/content/impact";
import {
  createInitialContext,
  createSubmitRequestFromContext,
  kioskReducer,
  type KioskContext,
  type KioskEvent,
} from "@/src/domain/kioskState";
import type {
  Customization,
  DrinkId,
  LatteArt,
  MilkBase,
  Sweetness,
  Temperature,
} from "@/src/domain/order";
import { stageProgress } from "@/src/domain/progress";
import {
  MockMachineAdapter,
  type MockScenario,
} from "@/src/infrastructure/machine/MockMachineAdapter";
import type { MachineEvent } from "@/src/infrastructure/machine/machineProtocol";
import {
  RecoverySnapshotStore,
  type RecoverySnapshot,
} from "@/src/infrastructure/persistence/SessionSnapshotStore";
import { KioskLogger } from "@/src/infrastructure/telemetry/kioskLogger";

type RestoreEvent = {
  type: "RESTORE_SNAPSHOT";
  snapshot: RecoverySnapshot;
};

type AppEvent = KioskEvent | RestoreEvent;

const allowedScenarios = new Set<MockScenario>([
  "normal",
  "rejected",
  "unknown",
  "failure",
  "disconnect",
  "out-of-order",
  "sold-out",
]);

function appReducer(context: KioskContext, event: AppEvent): KioskContext {
  if (event.type !== "RESTORE_SNAPSHOT") return kioskReducer(context, event);

  const { snapshot } = event;
  return {
    ...context,
    screen: "recovering",
    navigationDirection: "replace",
    submittedOrder: snapshot.submittedOrder,
    selectedDrinkId: snapshot.submittedOrder.drinkId,
    customization: { ...snapshot.submittedOrder.customization },
    orderDraft: {
      drinkId: snapshot.submittedOrder.drinkId,
      customization: { ...snapshot.submittedOrder.customization },
    },
    clientOrderId: snapshot.clientOrderId,
    machineOrderId: snapshot.machineOrderId,
    machineStatus: snapshot.lastKnownStatus,
    recoveryReason: "app_restarted",
    transitionLocked: false,
  };
}

function getConfiguredScenario(): MockScenario {
  if (typeof window === "undefined") return "normal";
  const value = new URLSearchParams(window.location.search).get("scenario");
  return value && allowedScenarios.has(value as MockScenario)
    ? (value as MockScenario)
    : "normal";
}

const configuredScenario = getConfiguredScenario();
const visualTestMode =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("visual") === "1";

const impactPhotoCrop: SliceCrop = {
  // Lossless crop generated from the exact pixels of the user-provided k2.
  src: "/assets/reference/k2-impact.png",
  sourceWidth: 442,
  sourceHeight: 594,
  x: 0,
  y: 0,
  width: 442,
  height: 594,
};

const drinkCrops: Readonly<Record<DrinkId, SliceCrop>> = {
  americano: {
    src: "/assets/reference/k3.png",
    sourceWidth: 1150,
    sourceHeight: 1368,
    x: 72,
    y: 568,
    width: 220,
    height: 192,
  },
  latte: {
    src: "/assets/reference/k3.png",
    sourceWidth: 1150,
    sourceHeight: 1368,
    x: 72,
    y: 778,
    width: 220,
    height: 188,
  },
  mocha: {
    src: "/assets/reference/k3.png",
    sourceWidth: 1150,
    sourceHeight: 1368,
    x: 72,
    y: 982,
    width: 220,
    height: 194,
  },
};

function currency(cents: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const labels = {
  temperature: { hot: "热", iced: "冰" } satisfies Record<Temperature, string>,
  milkBase: {
    none: "不加奶",
    dairy: "鲜奶",
    oat: "燕麦奶",
  } satisfies Record<MilkBase, string>,
  latteArt: {
    none: "不支持奶盖图案",
    star: "星芒",
    heart: "爱心",
    smile: "笑脸",
    custom: "自定义",
  } satisfies Record<LatteArt, string>,
};

function customizationText(customization: Customization): string {
  return [
    `甜度 ${customization.sweetness}%`,
    labels.temperature[customization.temperature],
    labels.milkBase[customization.milkBase],
    ...(customization.latteArt === "none"
      ? []
      : [labels.latteArt[customization.latteArt]]),
  ].join(" · ");
}

function Screen({
  context,
  children,
  className = "",
  transition,
  testId,
}: {
  context: KioskContext;
  children: ReactNode;
  className?: string;
  transition?: "submit" | "celebrate";
  testId: string;
}) {
  return (
    <section
      className={`screen ${className}`}
      data-direction={context.navigationDirection}
      data-transition={transition}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

function WelcomeScreen({
  context,
  send,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
}) {
  return (
    <Screen context={context} className="welcome-screen" testId="screen-welcome">
      <header className="welcome-copy">
        <p className="eyebrow">{copy.welcome.eyebrow}</p>
        <h1 className="display-title">{copy.welcome.title}</h1>
        <p className="muted">{copy.welcome.description}</p>
      </header>
      <div id="kuku-slot-welcome" className="kuku-stage-slot kuku-stage-slot--fill" />
      <div className="action-bar action-bar--single">
        <button
          className="button button--primary"
          type="button"
          data-testid="start-intro"
          disabled={!context.machineReady || context.transitionLocked}
          onClick={() => send({ type: "START_INTRO" })}
        >
          {copy.welcome.cta}
        </button>
      </div>
    </Screen>
  );
}

function ImpactScreen({
  context,
  send,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
}) {
  return (
    <Screen context={context} className="impact-screen" testId="screen-impact">
      <div className="impact-clouds">
        <div className="impact-photo" aria-label="年度动保行动公益照片">
          <SliceAsset
            crop={impactPhotoCrop}
            alt="Kuku Coffee 年度动保行动照片"
            fallbackKind="impact"
          />
        </div>
        <div className="impact-stats">
          <h1>{impactContent.eyebrow}</h1>
          <div className="impact-stat"><span aria-hidden="true">🐾</span><span>救助动物</span><strong>{impactContent.rescuedAnimals}只</strong></div>
          <div className="impact-stat"><span aria-hidden="true">⌂</span><span>合作机构</span><strong>{impactContent.partnerOrganizations}家</strong></div>
          <div className="impact-stat"><span aria-hidden="true">♡</span><span>公益投入</span><strong>{impactContent.investmentCents / 1_000_000}万元</strong></div>
        </div>
      </div>
      <div id="kuku-slot-impact" className="kuku-stage-slot kuku-stage-slot--fill" />
      <div className="action-bar action-bar--single">
        <button
          className="button button--primary"
          type="button"
          data-testid="start-order"
          disabled={!context.machineReady || context.transitionLocked}
          onClick={() => send({ type: "START_ORDER" })}
        >
          {copy.impact.cta}
        </button>
      </div>
    </Screen>
  );
}

function GuideStrip({
  screen,
  children,
}: {
  screen: "drink" | "customize" | "confirm";
  children: ReactNode;
}) {
  return (
    <div className="guide-strip">
      <div id={`kuku-slot-${screen}`} className="kuku-stage-slot" />
      <p>{children}</p>
    </div>
  );
}

function DrinkScreen({
  context,
  send,
  requestReset,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
  requestReset: () => void;
}) {
  const isAvailable = (drinkId: DrinkId) =>
    getDrinkById(drinkId).available &&
    context.drinkAvailability[drinkId] !== false;
  const allSoldOut = drinks.every((drink) => !isAvailable(drink.id));
  return (
    <Screen context={context} className="flow-screen" testId="screen-drink">
      <StepProgress current={1} />
      <GuideStrip screen="drink">
        {copy.drinks.mascot}
      </GuideStrip>
      <div className="screen-scroll">
        <header className="section-intro">
          <p className="eyebrow">第一步</p>
          <p className="muted">三款经典口味，选择你现在最想喝的一杯。</p>
          <h1 className="screen-title">选择饮品</h1>
        </header>
        <div className="drink-list" role="radiogroup" aria-label="选择饮品">
          {drinks.map((drink) => {
            const selected = context.selectedDrinkId === drink.id;
            const available = isAvailable(drink.id);
            return (
              <label
                className={`drink-card ${selected ? "is-selected" : ""} ${available ? "" : "is-disabled"}`}
                key={drink.id}
                data-testid={`drink-${drink.id}`}
              >
                <input
                  type="radio"
                  name="drink"
                  value={drink.id}
                  checked={selected}
                  disabled={!available}
                  onChange={() => send({ type: "SELECT_DRINK", drinkId: drink.id })}
                />
                <SliceAsset
                  className="drink-cup-image"
                  crop={drinkCrops[drink.id]}
                  alt={`${drink.name}饮品图`}
                  fallbackKind="drink"
                />
                <span className="drink-copy">
                  <h2>{drink.name}</h2>
                  <p className="drink-tagline">{drink.tagline}</p>
                  <p className="drink-description">{drink.description}</p>
                </span>
                <span className="drink-choice">
                  <span className="drink-choice__radio">
                    {available ? (selected ? "已选" : "选择") : "售罄"}
                  </span>
                  <strong className="drink-price">{currency(drink.priceCents)}</strong>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <p
        id="drink-next-hint"
        className={`hint ${allSoldOut || context.userMessage ? "hint--error" : ""}`}
      >
        {context.userMessage ??
          (allSoldOut
            ? copy.drinks.unavailable
            : context.selectedDrinkId
              ? "已选择，可以继续定制"
              : copy.drinks.selectFirst)}
      </p>
      <div className="action-bar">
        <button className="button" type="button" onClick={requestReset}>
          {copy.drinks.back}
        </button>
        <button
          className="button button--primary"
          type="button"
          data-testid="continue-customize"
          disabled={!context.selectedDrinkId || allSoldOut || context.transitionLocked}
          aria-describedby="drink-next-hint"
          onClick={() => send({ type: "CONTINUE_TO_CUSTOMIZE" })}
        >
          {copy.drinks.next}
        </button>
      </div>
    </Screen>
  );
}

type Choice<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

function OptionGroup<T extends string | number>({
  name,
  legend,
  value,
  choices,
  columns,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  choices: readonly Choice<T>[];
  columns: number;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="option-group">
      <legend>{legend}</legend>
      <div
        className="option-grid"
        style={{ "--columns": columns } as CSSProperties}
      >
        {choices.map((choice) => {
          const id = `${name}-${String(choice.value)}`;
          return (
            <span className="option-choice" key={id}>
              <input
                id={id}
                type="radio"
                name={name}
                value={String(choice.value)}
                checked={value === choice.value}
                disabled={choice.disabled}
                onChange={() => onChange(choice.value)}
              />
              <label htmlFor={id}>
                {choice.label}
                {choice.disabled ? " · 即将开放" : ""}
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}

function CustomizeScreen({
  context,
  send,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
}) {
  if (!context.selectedDrinkId || !context.customization) return null;
  const drink = getDrinkById(context.selectedDrinkId);
  const customization = context.customization;
  const patch = (value: Partial<Customization>) =>
    send({ type: "UPDATE_CUSTOMIZATION", patch: value });

  const milkChoices: readonly Choice<MilkBase>[] = [
    { value: "none", label: "不加奶", disabled: !drink.capabilities.milkBase.includes("none") },
    { value: "dairy", label: "鲜奶", disabled: !drink.capabilities.milkBase.includes("dairy") },
    { value: "oat", label: "燕麦奶", disabled: !drink.capabilities.milkBase.includes("oat") },
  ];
  const artChoices: readonly Choice<LatteArt>[] = [
    { value: "star", label: "✦ 星芒", disabled: !drink.capabilities.latteArtOptions?.includes("star") },
    { value: "heart", label: "♥ 爱心", disabled: !drink.capabilities.latteArtOptions?.includes("heart") },
    { value: "smile", label: "☺ 笑脸", disabled: !drink.capabilities.latteArtOptions?.includes("smile") },
    { value: "custom", label: "✎ 自定义", disabled: true },
  ];

  return (
    <Screen context={context} className="flow-screen" testId="screen-customize">
      <StepProgress current={2} />
      <GuideStrip screen="customize">选得不错。再调一调，让它更合你的口味。</GuideStrip>
      <div className="customize-heading">
        <p className="current-drink">当前饮品<strong>{drink.name}</strong></p>
        <div><p className="eyebrow">第二步</p><h1 className="screen-title">基础定制</h1></div>
      </div>
      <div className="screen-scroll">
        <div className="option-stack">
          <OptionGroup<Sweetness>
            name="sweetness"
            legend="甜度"
            value={customization.sweetness}
            columns={3}
            choices={([0, 30, 50] as const).map((value) => ({
              value,
              label: `${value}%`,
              disabled: !drink.capabilities.sweetness.includes(value),
            }))}
            onChange={(sweetness) => patch({ sweetness })}
          />
          <OptionGroup<Temperature>
            name="temperature"
            legend="冷热"
            value={customization.temperature}
            columns={2}
            choices={([
              { value: "hot", label: "热" },
              { value: "iced", label: "冰" },
            ] as const).map((choice) => ({
              ...choice,
              disabled: !drink.capabilities.temperature.includes(choice.value),
            }))}
            onChange={(temperature) => patch({ temperature })}
          />
          <OptionGroup<MilkBase>
            name="milkBase"
            legend="奶基"
            value={customization.milkBase}
            columns={3}
            choices={milkChoices}
            onChange={(milkBase) => patch({ milkBase })}
          />
          <OptionGroup<LatteArt>
            name="latteArt"
            legend={drink.capabilities.latteArt ? "奶盖图案" : "奶盖图案（当前饮品不支持）"}
            value={customization.latteArt}
            columns={4}
            choices={artChoices}
            onChange={(latteArt) => patch({ latteArt })}
          />
        </div>
      </div>
      <div className="option-summary" aria-live="polite">
        当前选择
        <strong data-testid="customization-summary">{customizationText(customization)}</strong>
      </div>
      <p className={`hint ${context.userMessage ? "hint--error" : ""}`}>
        {context.userMessage ?? "所有选择都会在提交前再次校验"}
      </p>
      <div className="action-bar">
        <button
          className="button"
          type="button"
          disabled={context.transitionLocked}
          onClick={() => send({ type: "EDIT_DRINK" })}
        >
          {copy.customize.back}
        </button>
        <button
          className="button button--primary"
          type="button"
          data-testid="continue-confirm"
          disabled={context.transitionLocked}
          onClick={() => send({ type: "CONTINUE_TO_CONFIRM" })}
        >
          {copy.customize.confirm}
        </button>
      </div>
    </Screen>
  );
}

function ConfirmScreen({
  context,
  send,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
}) {
  if (!context.selectedDrinkId || !context.customization) return null;
  const drink = getDrinkById(context.selectedDrinkId);
  return (
    <Screen context={context} className="flow-screen" testId="screen-confirm">
      <StepProgress current={3} />
      <GuideStrip screen="confirm">最后确认一下，没问题我就交给咖啡机啦。</GuideStrip>
      <div className="screen-scroll confirm-scroll">
        <header className="section-intro">
          <p className="eyebrow">第三步</p>
          <h1 className="screen-title">确认订单</h1>
        </header>
        <article className="order-card" data-testid="order-summary">
          <div className="order-card__row order-card__hero">
            <div>
              <p className="order-card__label">饮品</p>
              <h2>{drink.name}</h2>
              <p className="drink-tagline">{drink.tagline}</p>
            </div>
            <strong className="order-card__price">{currency(drink.priceCents)}</strong>
          </div>
          <div className="order-card__row">
            <p className="order-card__label">基础定制</p>
            <p className="order-card__values">
              <span>甜度 {context.customization.sweetness}%</span>
              <span>{labels.temperature[context.customization.temperature]}</span>
              <span>{labels.milkBase[context.customization.milkBase]}</span>
            </p>
          </div>
          <div className="order-card__row">
            <p className="order-card__label">奶盖图案</p>
            <p className="order-card__values">
              {labels.latteArt[context.customization.latteArt]}
            </p>
          </div>
        </article>
        <p className="submit-message" role="alert">{context.userMessage}</p>
      </div>
      <div className="action-bar">
        <button
          className="button"
          type="button"
          disabled={context.transitionLocked}
          onClick={() => send({ type: "EDIT_CUSTOMIZATION" })}
        >
          {copy.confirm.edit}
        </button>
        <button
          className="button button--primary"
          type="button"
          data-testid="submit-order"
          disabled={
            context.transitionLocked ||
            !context.machineReady ||
            !context.selectedDrinkId ||
            context.drinkAvailability[context.selectedDrinkId] === false
          }
          onClick={() => send({ type: "SUBMIT_ORDER" })}
        >
          {copy.confirm.submit}
        </button>
      </div>
    </Screen>
  );
}

function SubmittingScreen({ context }: { context: KioskContext }) {
  return (
    <Screen
      context={context}
      className="flow-screen"
      transition="submit"
      testId="screen-submitting"
    >
      <StepProgress current={3} />
      <div className="recovery-view" aria-live="polite">
        <div id="kuku-slot-submitting" className="kuku-stage-slot kuku-stage-slot--recovery" />
        <div className="recovery-spinner" aria-hidden="true" />
        <h1 className="screen-title">正在提交订单</h1>
        <p className="muted">{copy.confirm.submitting}</p>
      </div>
    </Screen>
  );
}

function brewCue(stage: string | undefined): MascotCue {
  if (stage === "grinding") return "grind";
  if (stage === "extracting") return "extract";
  if (stage === "dispensing") return "dispense";
  return "wait";
}

function brewSpeech(stage: string | undefined): string {
  if (stage === "grinding") return copy.brewing.grinding;
  if (stage === "extracting") return copy.brewing.extracting;
  if (stage === "dispensing") return copy.brewing.dispensing;
  return copy.brewing.queued;
}

function mascotPresentation(context: KioskContext): {
  cue: MascotCue;
  size: "compact" | "medium" | "hero";
  speech?: string;
} {
  switch (context.screen) {
    case "welcome":
      return { cue: "welcome", size: "hero", speech: copy.welcome.mascot };
    case "impact":
      return { cue: "grateful", size: "medium", speech: copy.impact.title };
    case "drink":
      return {
        cue: context.selectedDrinkId ? "approve" : "point-options",
        size: "compact",
      };
    case "customize":
      return { cue: "approve", size: "compact" };
    case "confirm":
      return { cue: "recap", size: "compact" };
    case "submitting":
      return { cue: "wait", size: "medium" };
    case "brewing":
      return {
        cue: brewCue(context.machineStatus?.stage),
        size: "hero",
        speech: brewSpeech(context.machineStatus?.stage),
      };
    case "recovering":
      return { cue: "concern", size: "medium" };
    case "pickup":
      return { cue: "celebrate", size: "hero", speech: copy.pickup.mascot };
    case "out_of_service":
      return { cue: "concern", size: "compact" };
  }
}

function BrewingScreen({ context }: { context: KioskContext }) {
  const stage = context.machineStatus?.stage ?? "queued";
  const progress = stageProgress(stage, context.machineStatus?.progress);
  const snapshot = context.submittedOrder;
  const activeIndex =
    stage === "grinding" ? 0 : stage === "extracting" ? 1 : stage === "dispensing" ? 2 : -1;
  return (
    <Screen context={context} className="flow-screen brewing-screen" testId="screen-brewing">
      <StepProgress current={4} />
      <main className="brewing-main">
        <div id="kuku-slot-brewing" className="kuku-stage-slot kuku-stage-slot--hero" />
        <article className="brew-panel">
          <div className="brew-panel__header">
            <div>
              <p className="eyebrow">正在制作</p>
              <h1>你的咖啡正在准备 · {snapshot?.drinkName}</h1>
            </div>
            <strong className="brew-percent">{Math.round(progress)}%</strong>
          </div>
          <div
            className="brew-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="咖啡制作进度"
          >
            <span style={{ "--brew-progress": progress / 100 } as CSSProperties} />
          </div>
          <ol className="brew-stages">
            {["研磨", "萃取", "出杯"].map((label, index) => (
              <li
                key={label}
                className={index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : ""}
              >
                <i>{index < activeIndex ? "✓" : index + 1}</i>{label}
              </li>
            ))}
          </ol>
        </article>
        <p className="connection-note">机器连接正常，制作阶段不会因无操作而重置</p>
      </main>
    </Screen>
  );
}

function RecoveringScreen({ context }: { context: KioskContext }) {
  return (
    <Screen context={context} className="flow-screen" testId="screen-recovering">
      <StepProgress current={4} />
      <div className="recovery-view" aria-live="polite">
        <div id="kuku-slot-recovering" className="kuku-stage-slot kuku-stage-slot--recovery" />
        <div className="recovery-spinner" aria-hidden="true" />
        <h1 className="screen-title">正在恢复制作状态</h1>
        <p className="muted">订单已安全保留，我们正在重新连接机器。</p>
        <p className="connection-note is-offline">{copy.brewing.reconnecting}</p>
      </div>
    </Screen>
  );
}

function PickupScreen({
  context,
  send,
  remaining,
}: {
  context: KioskContext;
  send: (event: AppEvent) => void;
  remaining: number | null;
}) {
  return (
    <Screen
      context={context}
      className="flow-screen pickup-screen"
      transition="celebrate"
      testId="screen-pickup"
    >
      <StepProgress current={5} />
      <main className="pickup-main">
        <div id="kuku-slot-pickup" className="kuku-stage-slot kuku-stage-slot--hero" />
        <span className="status-pill">✓ {copy.pickup.status}</span>
        <h1 className="pickup-title">{copy.pickup.title}</h1>
        <p className="pickup-drink">{context.submittedOrder?.drinkName}</p>
        <p className="pickup-note">
          请从下方取杯口拿走你的咖啡
          {remaining !== null && remaining <= 5 ? ` · ${remaining} 秒后返回首页` : ""}
        </p>
      </main>
      <div className="action-bar action-bar--single">
        <button
          className="button button--primary"
          type="button"
          data-testid="finish-session"
          onClick={() => send({ type: "FINISH_SESSION" })}
        >
          {copy.pickup.finish}
        </button>
      </div>
    </Screen>
  );
}

function OutOfServiceScreen({
  context,
  onReset,
}: {
  context: KioskContext;
  onReset: () => void;
}) {
  const suffix = context.clientOrderId?.slice(-6).toUpperCase();
  return (
    <div className="fault-overlay" role="alert" data-testid="screen-out-of-service">
      <div id="kuku-slot-out_of_service" className="kuku-stage-slot kuku-stage-slot--fault" />
      <div className="fault-overlay__mark" aria-hidden="true">!</div>
      <p className="eyebrow">KUKU COFFEE</p>
      <h1>{copy.service.unavailable}</h1>
      <p>
        {suffix
          ? `订单 ${suffix} 没能顺利完成，请联系工作人员处理。`
          : "设备正在检查状态，请稍后再来。"}
      </p>
      <button className="button button--primary" type="button" onClick={onReset}>
        {suffix ? copy.service.assistance : "重新检查"}
      </button>
    </div>
  );
}

export function KioskApp() {
  const [context, send] = useReducer(appReducer, undefined, createInitialContext);
  const [resetPrompt, setResetPrompt] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [pickupRemaining, setPickupRemaining] = useState<number | null>(null);
  const scenario = configuredScenario;
  const machine = useMemo(
    () =>
      new MockMachineAdapter({
        scenario,
        stepDelayMs: visualTestMode ? 10_000 : 820,
      }),
    [scenario],
  );
  const snapshotStore = useMemo(
    () => new RecoverySnapshotStore(),
    [],
  );
  const logger = useMemo(
    () => new KioskLogger({ appVersion: "1.0.0", deviceId: "kiosk-local" }),
    [],
  );
  const submittedIds = useRef(new Set<string>());
  const cupRemovedTimers = useRef(new Set<number>());
  const machineDisposeTimer = useRef<number | null>(null);
  const activityAt = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => send({ type: "TRANSITION_FINISHED" }), 680);
    return () => clearTimeout(timer);
  }, [context.screen]);

  useEffect(() => {
    activityAt.current = Date.now();
    const recordActivity = () => {
      activityAt.current = Date.now();
      setIdleWarning(false);
    };
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("pointerdown", recordActivity, { passive: true });
    window.addEventListener("keydown", recordActivity);
    window.addEventListener("contextmenu", preventContextMenu);
    return () => {
      window.removeEventListener("pointerdown", recordActivity);
      window.removeEventListener("keydown", recordActivity);
      window.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  useEffect(() => {
    const recordFrontendError = (
      code: string,
      details: Record<string, unknown>,
    ) => {
      logger.log("frontend_error", {
        level: "error",
        screen: context.screen,
        sessionId: context.sessionId,
        clientOrderId: context.clientOrderId ?? undefined,
        errorCode: code,
        details,
      });
      send({ type: "FRONTEND_ERROR", code });
    };
    const handleWindowError = (event: ErrorEvent) => {
      recordFrontendError("window_error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      recordFrontendError("unhandled_rejection", {
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
      });
    };
    const handleBoundaryError = (event: Event) => {
      const detail =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object"
          ? (event.detail as Record<string, unknown>)
          : {};
      recordFrontendError("react_error_boundary", detail);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("kuku:frontend-error", handleBoundaryError);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("kuku:frontend-error", handleBoundaryError);
    };
  }, [context.clientOrderId, context.screen, context.sessionId, logger]);

  useEffect(() => {
    const handleAssetFallback = (event: Event) => {
      const detail =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object"
          ? (event.detail as Record<string, unknown>)
          : {};
      logger.log("asset_fallback_used", {
        level: "warning",
        screen: context.screen,
        sessionId: context.sessionId,
        details: detail,
      });
    };
    const handleMascotFallback = () => {
      logger.log("mascot_renderer_fallback", {
        level: "warning",
        screen: context.screen,
        sessionId: context.sessionId,
      });
    };
    window.addEventListener("kuku:asset-fallback", handleAssetFallback);
    window.addEventListener(
      "kuku:mascot-renderer-fallback",
      handleMascotFallback,
    );
    return () => {
      window.removeEventListener("kuku:asset-fallback", handleAssetFallback);
      window.removeEventListener(
        "kuku:mascot-renderer-fallback",
        handleMascotFallback,
      );
    };
  }, [context.screen, context.sessionId, logger]);

  useEffect(() => {
    if (machineDisposeTimer.current !== null) {
      window.clearTimeout(machineDisposeTimer.current);
      machineDisposeTimer.current = null;
    }
    const recovery = snapshotStore.load();
    if (recovery) send({ type: "RESTORE_SNAPSHOT", snapshot: recovery });

    let active = true;
    const pendingCupTimers = cupRemovedTimers.current;
    const unsubscribe = machine.subscribe((event: MachineEvent) => {
      if (!active) return;
      if (event.type === "order_status") {
        send({ type: "MACHINE_STATUS", status: event.payload });
      } else if (event.type === "cup_removed") {
        const timer = window.setTimeout(
          () => {
            pendingCupTimers.delete(timer);
            send({
              type: "CUP_REMOVED",
              machineOrderId: event.machineOrderId,
            });
          },
          900,
        );
        pendingCupTimers.add(timer);
      } else if (event.type === "fault" && event.severity === "fatal") {
        send({ type: "FATAL_MACHINE_ERROR", code: event.code });
      } else if (event.type === "connection_changed" && !event.connected) {
        send({ type: "MACHINE_DISCONNECTED" });
      } else if (event.type === "ready_changed") {
        logger.log("machine_ready_changed", {
          level: event.ready ? "info" : "warning",
          details: { ready: event.ready, reason: event.reason ?? null },
        });
        send({
          type: "MACHINE_READY_CHANGED",
          ready: event.ready,
          reason: event.reason,
        });
      } else if (event.type === "inventory_changed") {
        send({
          type: "INVENTORY_CHANGED",
          drinks: event.snapshot.drinks,
        });
      }
    });

    machine.initialize().then((snapshot) => {
      if (!active) return;
      send({
        type: "INVENTORY_CHANGED",
        drinks: snapshot.inventory.drinks,
      });
      send({
        type: "MACHINE_READY_CHANGED",
        ready: snapshot.ready,
        reason: snapshot.reason,
      });
    }).catch(() => {
      if (active) {
        send({
          type: "MACHINE_READY_CHANGED",
          ready: false,
          reason: "设备连接失败",
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
      for (const timer of pendingCupTimers) {
        window.clearTimeout(timer);
      }
      pendingCupTimers.clear();
      // React development Strict Mode mounts effects twice. Deferring disposal
      // by one task lets the immediate remount cancel it, while a real unmount
      // still releases every adapter timer and listener.
      machineDisposeTimer.current = window.setTimeout(() => {
        machine.dispose();
        machineDisposeTimer.current = null;
      }, 0);
    };
  }, [logger, machine, snapshotStore]);

  useEffect(() => {
    if (context.screen !== "submitting") return;
    const request = createSubmitRequestFromContext(context);
    if (!request || submittedIds.current.has(request.clientOrderId)) return;
    submittedIds.current.add(request.clientOrderId);

    logger.log("order_submit_started", {
      screen: context.screen,
      clientOrderId: request.clientOrderId,
    });

    machine.submitOrder(request).then(async (result) => {
      if (result.status === "accepted") {
        send({ type: "ORDER_ACCEPTED", machineOrderId: result.machineOrderId });
      } else if (result.status === "rejected") {
        submittedIds.current.delete(request.clientOrderId);
        send({ type: "ORDER_REJECTED", reason: result.userMessage });
      } else {
        const status = await machine.getOrderStatus(request.clientOrderId);
        if (status) {
          send({ type: "ORDER_ACCEPTED", machineOrderId: status.machineOrderId });
          send({ type: "MACHINE_STATUS", status });
        } else {
          send({
            type: "ORDER_STATUS_UNKNOWN",
            reason: "机器仍在确认订单状态",
          });
        }
      }
    }).catch(() => {
      send({ type: "ORDER_STATUS_UNKNOWN", reason: "订单状态暂时未知" });
    });
  }, [context, logger, machine]);

  useEffect(() => {
    if (
      !context.clientOrderId ||
      !context.submittedOrder ||
      !["submitting", "brewing", "recovering", "pickup"].includes(context.screen)
    ) {
      return;
    }
    snapshotStore.save({
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      clientOrderId: context.clientOrderId,
      machineOrderId: context.machineOrderId,
      submittedOrder: context.submittedOrder,
      lastKnownStatus: context.machineStatus,
    });
  }, [
    context.clientOrderId,
    context.machineOrderId,
    context.machineStatus,
    context.screen,
    context.submittedOrder,
    snapshotStore,
  ]);

  useEffect(() => {
    if (context.screen !== "recovering" || !context.clientOrderId) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const status = await machine.getOrderStatus(context.clientOrderId!);
        if (status) {
          window.clearInterval(timer);
          send({ type: "RECOVERY_SUCCEEDED", status });
        } else if (attempts >= 8) {
          window.clearInterval(timer);
          send({ type: "FATAL_MACHINE_ERROR", code: "order_not_found" });
        }
      } catch {
        if (attempts >= 8) {
          window.clearInterval(timer);
          send({ type: "FATAL_MACHINE_ERROR", code: "recovery_failed" });
        }
      }
    }, 600);
    return () => window.clearInterval(timer);
  }, [context.clientOrderId, context.screen, machine]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const inactiveMs = Date.now() - activityAt.current;
      if (context.screen === "impact" && inactiveMs >= 30_000) {
        send({ type: "IDLE_TIMEOUT" });
      } else if (["drink", "customize", "confirm"].includes(context.screen)) {
        if (inactiveMs >= 60_000) {
          send({ type: "IDLE_TIMEOUT" });
        } else {
          setIdleWarning(inactiveMs >= 45_000);
        }
      } else if (context.screen === "pickup") {
        const remaining = Math.max(0, Math.ceil((30_000 - inactiveMs) / 1000));
        setPickupRemaining(remaining);
        if (remaining === 0) send({ type: "FINISH_SESSION" });
      } else {
        setIdleWarning(false);
        setPickupRemaining(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [context.screen]);

  useEffect(() => {
    logger.log("screen_entered", {
      screen: context.screen,
      sessionId: context.sessionId,
    });
    if (context.screen === "welcome") {
      for (const timer of cupRemovedTimers.current) {
        window.clearTimeout(timer);
      }
      cupRemovedTimers.current.clear();
      snapshotStore.clear();
      submittedIds.current.clear();
      activityAt.current = Date.now();
    }
  }, [context.screen, context.sessionId, logger, snapshotStore]);

  const requestReset = () => setResetPrompt(true);
  const confirmReset = () => {
    setResetPrompt(false);
    send({ type: "RESET_CONFIRMED" });
  };
  const forceReset = () => {
    snapshotStore.clear();
    setResetPrompt(false);
    window.location.assign(window.location.pathname);
  };

  let screen: ReactNode;
  switch (context.screen) {
    case "welcome":
      screen = <WelcomeScreen context={context} send={send} />;
      break;
    case "impact":
      screen = <ImpactScreen context={context} send={send} />;
      break;
    case "drink":
      screen = <DrinkScreen context={context} send={send} requestReset={requestReset} />;
      break;
    case "customize":
      screen = <CustomizeScreen context={context} send={send} />;
      break;
    case "confirm":
      screen = <ConfirmScreen context={context} send={send} />;
      break;
    case "submitting":
      screen = <SubmittingScreen context={context} />;
      break;
    case "brewing":
      screen = <BrewingScreen context={context} />;
      break;
    case "recovering":
      screen = <RecoveringScreen context={context} />;
      break;
    case "pickup":
      screen = <PickupScreen context={context} send={send} remaining={pickupRemaining} />;
      break;
    case "out_of_service":
      screen = <OutOfServiceScreen context={context} onReset={forceReset} />;
      break;
  }
  const mascot = mascotPresentation(context);

  return (
    <ErrorBoundary>
      <main
        className="kiosk-app"
        data-screen={context.screen}
        data-machine-ready={context.machineReady ? "true" : "false"}
        data-machine-message={context.userMessage ?? ""}
      >
        <PersistentKukuStage
          cue={mascot.cue}
          size={mascot.size}
          speech={mascot.speech}
          targetId={`kuku-slot-${context.screen}`}
        />
        <ScreenTransitionDeck screenKey={context.screen}>
          {screen}
        </ScreenTransitionDeck>
        {idleWarning ? <div className="idle-toast" role="status">{copy.idle.warning}</div> : null}
        {resetPrompt ? (
          <div className="fault-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="fault-overlay__mark" aria-hidden="true">?</div>
            <h1 id="reset-title">返回首页并清空选择？</h1>
            <p>当前选择还没有提交，返回后将不会保留。</p>
            <div className="action-bar">
              <button className="button" type="button" onClick={() => setResetPrompt(false)}>继续选择</button>
              <button className="button button--primary" type="button" onClick={confirmReset}>返回首页</button>
            </div>
          </div>
        ) : null}
      </main>
    </ErrorBoundary>
  );
}
