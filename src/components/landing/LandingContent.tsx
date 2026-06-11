import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  FileText,
  Library,
  PenLine,
  Target,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

type LandingContentProps = {
  isAuthenticated: boolean;
};

type LandingIcon = ComponentType<LucideProps>;
type PlaceholderVariant =
  | "dashboard"
  | "writing"
  | "report"
  | "chart"
  | "library"
  | "platform"
  | "analysis"
  | "steps";

const PREVIEW_CARDS = [
  {
    icon: Target,
    titleKey: "cardDashboardTitle",
    bodyKey: "cardDashboardBody",
    imageKey: "cardDashboardImage",
    variant: "dashboard",
    wide: true,
  },
  {
    icon: PenLine,
    titleKey: "cardWritingTitle",
    bodyKey: "cardWritingBody",
    imageKey: "cardWritingImage",
    variant: "writing",
    wide: false,
  },
  {
    icon: BrainCircuit,
    titleKey: "cardFeedbackTitle",
    bodyKey: "cardFeedbackBody",
    imageKey: "cardFeedbackImage",
    variant: "report",
    wide: false,
  },
] as const;

const CAPABILITY_CARDS = [
  {
    icon: FileText,
    titleKey: "capabilityProblemTitle",
    bodyKey: "capabilityProblemBody",
  },
  {
    icon: PenLine,
    titleKey: "capabilityWritingTitle",
    bodyKey: "capabilityWritingBody",
  },
  {
    icon: BarChart3,
    titleKey: "capabilityDimensionTitle",
    bodyKey: "capabilityDimensionBody",
  },
  {
    icon: Library,
    titleKey: "capabilityLibraryTitle",
    bodyKey: "capabilityLibraryBody",
  },
] as const;

const FLOW_STEPS = [
  {
    number: "01",
    titleKey: "platformStepGoal",
    bodyKey: "platformStepGoalBody",
  },
  {
    number: "02",
    titleKey: "platformStepWrite",
    bodyKey: "platformStepWriteBody",
  },
  {
    number: "03",
    titleKey: "platformStepReview",
    bodyKey: "platformStepReviewBody",
  },
] as const;

const TRUST_CARDS = [
  {
    valueKey: "trustTypeValue",
    titleKey: "trustTypeTitle",
    bodyKey: "trustTypeBody",
    className: "landing-trust-card landing-trust-card--score",
  },
  {
    valueKey: "trustDimensionValue",
    titleKey: "trustDimensionTitle",
    bodyKey: "trustDimensionBody",
    className: "landing-trust-card landing-trust-card--dark",
  },
  {
    valueKey: "trustGoalValue",
    titleKey: "trustGoalTitle",
    bodyKey: "trustGoalBody",
    className: "landing-trust-card landing-trust-card--compact",
  },
  {
    valueKey: "trustReviewValue",
    titleKey: "trustReviewTitle",
    bodyKey: "trustReviewBody",
    className: "landing-trust-card landing-trust-card--badge",
  },
] as const;

function ImagePlaceholder({
  label,
  variant,
  icon: Icon,
  dark = false,
}: {
  label: string;
  variant: PlaceholderVariant;
  icon?: LandingIcon;
  dark?: boolean;
}) {
  return (
    <div
      className={[
        "landing-image-placeholder",
        `landing-image-placeholder--${variant}`,
        dark ? "landing-image-placeholder--dark" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={label}
    >
      <div className="landing-image-placeholder__mock" aria-hidden="true">
        {Icon ? (
          <span className="landing-image-placeholder__icon">
            <Icon size={24} strokeWidth={2.2} />
          </span>
        ) : null}
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="landing-image-placeholder__lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <span>{label}</span>
    </div>
  );
}

function IconBadge({ icon: Icon }: { icon: LandingIcon }) {
  return (
    <span className="landing-icon-badge" aria-hidden="true">
      <Icon size={20} strokeWidth={2} />
    </span>
  );
}

export async function LandingContent({ isAuthenticated }: LandingContentProps) {
  const landingT = await getTranslations("landing");
  const t = (key: string) => landingT(`sections.${key}` as never);
  const primaryHref = isAuthenticated ? "/dashboard" : "/sign-up";
  const primaryLabel = isAuthenticated
    ? landingT("ctaDashboard")
    : landingT("ctaSignUp");

  return (
    <div className="landing-content-shell">
      <section id="features" className="landing-section landing-section--intro">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">{t("flowEyebrow")}</p>
          <h2>{t("flowTitle")}</h2>
          <p>{t("flowBody")}</p>
        </div>

        <div className="landing-bento-grid">
          {PREVIEW_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.titleKey}
                className={[
                  "landing-feature-card",
                  card.wide ? "landing-feature-card--wide" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ImagePlaceholder
                  label={t(card.imageKey)}
                  variant={card.variant}
                  icon={Icon}
                />
                <div className="landing-feature-copy">
                  <h3>{t(card.titleKey)}</h3>
                  <p>{t(card.bodyKey)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="preview" className="landing-platform-band">
        <div className="landing-platform-inner">
          <div className="landing-platform-copy">
            <p className="landing-eyebrow landing-eyebrow--dark">
              {t("platformEyebrow")}
            </p>
            <h2>{t("platformTitle")}</h2>
            <p>{t("platformBody")}</p>
            <div className="landing-platform-actions">
              <Link
                className="landing-outline-link landing-outline-link--dark"
                href={primaryHref}
              >
                {primaryLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="landing-platform-points">
            {FLOW_STEPS.map((step) => (
              <div key={step.titleKey}>
                <BookOpenCheck aria-hidden size={20} />
                <strong>
                  {step.number}. {t(step.titleKey)}
                </strong>
                <span>{t(step.bodyKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--capabilities">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">{t("assistantEyebrow")}</p>
          <h2>{t("assistantTitle")}</h2>
          <p>{t("assistantBody")}</p>
        </div>

        <div className="landing-capability-grid">
          {CAPABILITY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.titleKey} className="landing-capability">
                <IconBadge icon={Icon} />
                <h3>{t(card.titleKey)}</h3>
                <p>{t(card.bodyKey)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-section--trust">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">{t("trustEyebrow")}</p>
          <h2>{t("trustTitle")}</h2>
          <p>{t("trustBody")}</p>
        </div>

        <div className="landing-trust-grid">
          {TRUST_CARDS.map((card) => (
            <article key={card.titleKey} className={card.className}>
              <strong>{t(card.valueKey)}</strong>
              <h3>{t(card.titleKey)}</h3>
              <p>{t(card.bodyKey)}</p>
            </article>
          ))}
          <article className="landing-trust-card landing-trust-card--quote">
            <p>{t("quoteText")}</p>
            <span>{t("quoteSource")}</span>
          </article>
        </div>
      </section>

      <section className="landing-section landing-section--steps">
        <div className="landing-steps-layout">
          <div className="landing-split-copy">
            <p className="landing-eyebrow">{t("platformEyebrow")}</p>
            <h2>{t("platformTitle")}</h2>
            <p>{t("platformBody")}</p>
            <Link className="landing-outline-link" href={primaryHref}>
              {primaryLabel}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ol className="landing-step-list">
            {FLOW_STEPS.map((step) => (
              <li key={step.titleKey}>
                <span>{step.number}</span>
                <div>
                  <h3>{t(step.titleKey)}</h3>
                  <p>{t(step.bodyKey)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-final-cta">
        <h2>{t("ctaTitle")}</h2>
        <p>{t("ctaBody")}</p>
        <div className="landing-final-actions">
          <Link className="landing-outline-link" href={primaryHref}>
            {primaryLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="landing-outline-link" href="/login">
            {landingT("ctaLogin")}
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>TALKPIK AI</strong>
          <p>{t("trustBody")}</p>
        </div>
        <nav className="landing-footer-nav" aria-label={t("footerNavAria")}>
          <div>
            <strong>{t("footerStudy")}</strong>
            <Link href={primaryHref}>{primaryLabel}</Link>
            <Link href="/terms">{landingT("navTerms")}</Link>
            <Link href="/privacy">{landingT("navPrivacy")}</Link>
          </div>
        </nav>
      </footer>
    </div>
  );
}
