"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import {
  ArrowRight,
  BookOpenText,
  Check,
  LayoutDashboard,
  MessageSquareText,
  PanelsTopLeft,
} from "@/components/shared/AppIcons";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { Autoplay, FreeMode } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import type { LandingAuthStatus } from "@/lib/auth/completion-routes";
import { getLandingCta, type LandingCta } from "./auth-cta";

type PortfolioLandingLayoutProps = {
  authStatus: LandingAuthStatus;
};

type LandingLayoutCta = {
  primary: LandingCta | null;
  primaryLabel: string;
};

const CORE_VALUE_IMAGE_SRCS = [
  "/assets/landing/core-value-01.png",
  "/assets/landing/core-value-02.png",
  "/assets/landing/core-value-03.png",
];

const LEARNER_GOAL_AVATAR_SRCS = [
  "/assets/avatar/01.svg",
  "/assets/avatar/02.svg",
  "/assets/avatar/03.svg",
  "/assets/avatar/04.svg",
];

const FUTURE_SCOPE_IMAGE_SRCS = [
  "/assets/landing-future-vocabulary.png",
  "/assets/landing-future-exam.png",
  "/assets/landing-future-board.png",
];

function VisualLabel({
  label,
  imageSrc,
}: {
  label: string;
  imageSrc?: string;
}) {
  return (
    <div className="landing-layout-visual" data-landing-parallax>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          draggable={false}
        />
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

function Eyebrow({
  children,
  center = false,
}: {
  children: string;
  center?: boolean;
}) {
  return (
    <p
      className={
        center
          ? "landing-layout-eyebrow landing-layout-eyebrow--center"
          : "landing-layout-eyebrow"
      }
    >
      <span aria-hidden="true" />
      {children}
    </p>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

function useLandingMotion() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(
        "[data-landing-section], [data-landing-stagger], [data-landing-line]",
        {
          clearProps: "all",
        },
      );
      return undefined;
    }

    const observers: IntersectionObserver[] = [];
    const rootElement = rootRef.current;

    const context = gsap.context(() => {
      gsap.utils
        .toArray<HTMLElement>("[data-landing-section]")
        .forEach((section) => {
          const heading = section.querySelectorAll("[data-landing-heading]");
          const items = section.querySelectorAll("[data-landing-stagger]");
          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top 68%",
              once: true,
            },
          });

          if (heading.length > 0) {
            timeline.from(heading, {
              autoAlpha: 0,
              y: 96,
              duration: 0.9,
              ease: "power3.out",
            });
          }

          if (items.length > 0) {
            timeline.from(
              items,
              {
                autoAlpha: 0,
                y: 72,
                duration: 0.78,
                ease: "power3.out",
                stagger: 0.08,
              },
              heading.length > 0 ? 0.14 : 0,
            );
          }
        });

      gsap.utils
        .toArray<HTMLElement>(".landing-layout-step-list")
        .forEach((list) => {
          const lines = list.querySelectorAll<HTMLElement>(
            "[data-landing-line]",
          );

          if (lines.length === 0) {
            return;
          }

          let hasAnimated = false;

          const animateLines = () => {
            if (hasAnimated) {
              return;
            }

            hasAnimated = true;
            list.classList.add("landing-layout-step-list--line-active");
          };

          list.classList.add("landing-layout-step-list--line-ready");

          const observer = new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                animateLines();
                observer.disconnect();
              }
            },
            {
              rootMargin: "0px 0px -30% 0px",
              threshold: 0.16,
            },
          );

          observer.observe(list);
          observers.push(observer);
        });

      gsap.utils
        .toArray<HTMLElement>("[data-landing-parallax]")
        .forEach((item) => {
          gsap.to(item, {
            yPercent: -7,
            ease: "none",
            scrollTrigger: {
              trigger: item,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.7,
            },
          });
        });

      ScrollTrigger.refresh();
    }, rootRef);

    return () => {
      observers.forEach((observer) => {
        observer.disconnect();
      });
      rootElement
        ?.querySelectorAll(".landing-layout-step-list")
        .forEach((list) => {
          list.classList.remove(
            "landing-layout-step-list--line-ready",
            "landing-layout-step-list--line-active",
          );
        });
      context.revert();
    };
  }, []);

  return rootRef;
}

function LearningLoopSection({ primary, primaryLabel }: LandingLayoutCta) {
  const t = useTranslations("landing.portfolio");
  const loops = [
    [
      t("loopDashboardTitle"),
      t("loopDashboardDescription"),
      t("loopDashboardPreview"),
      "/assets/landing/landing-loop-dashboard.png",
    ],
    [
      t("loopFeedbackTitle"),
      t("loopFeedbackDescription"),
      t("loopFeedbackPreview"),
      "/assets/landing/landing-loop-feedback.png",
    ],
    [
      t("loopReportTitle"),
      t("loopReportDescription"),
      t("loopReportPreview"),
      "/assets/landing/landing-loop-report.png",
    ],
  ];

  return (
    <section
      id="preview"
      className="landing-layout-section"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div data-landing-heading>
          <Eyebrow>{t("learningLoopEyebrow")}</Eyebrow>
        </div>
        <div className="landing-layout-work-grid">
          {loops.map(([name, description, label, imageSrc]) => (
            <article
              className="landing-layout-work"
              data-landing-stagger
              key={name}
            >
              <figure>
                <VisualLabel label={label} imageSrc={imageSrc} />
              </figure>
              <div className="landing-layout-work__caption">
                <strong>{name}</strong>
                <span>—</span>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="landing-layout-center">
          <a className="landing-layout-pill" href={primary?.href ?? "/sign-up"}>
            {primary ? primaryLabel : t("freeStart")}
            <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function CoreValueSection() {
  const t = useTranslations("landing.portfolio");
  const values = [
    ["01", t("coreOneTitle"), t("coreOneDescription")],
    ["02", t("coreTwoTitle"), t("coreTwoDescription")],
    ["03", t("coreThreeTitle"), t("coreThreeDescription")],
  ];

  return (
    <section
      id="services"
      className="landing-layout-section"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>{t("coreValueEyebrow")}</Eyebrow>
          <h2>
            {t("coreTitleLineOne")}
            <br />
            {t("coreTitleLineTwo")} <span>{t("coreTitleAccent")}</span>
          </h2>
        </div>
        <div className="landing-layout-service-grid">
          {values.map(([number, title, description], index) => (
            <article
              className="landing-layout-service"
              data-landing-stagger
              key={number}
            >
              <div className="landing-layout-service__frame landing-layout-service__frame--image">
                <Image
                  src={CORE_VALUE_IMAGE_SRCS[index]}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  draggable={false}
                />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LearnerGoalsSection({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}) {
  const t = useTranslations("landing.portfolio");
  const goals = [
    ["G1", t("goalOneQuote"), t("goalOneName"), t("goalOneRole")],
    ["G2", t("goalTwoQuote"), t("goalTwoName"), t("goalTwoRole")],
    ["G3", t("goalThreeQuote"), t("goalThreeName"), t("goalThreeRole")],
    ["G4", t("goalFourQuote"), t("goalFourName"), t("goalFourRole")],
  ];

  return (
    <section
      className="landing-layout-section landing-layout-section--center"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div
          className="landing-layout-heading landing-layout-heading--center"
          data-landing-heading
        >
          <Eyebrow center>{t("learnerGoalsEyebrow")}</Eyebrow>
          <h2>
            {t("goalsTitleBase")} <span>{t("goalsTitleAccent")}</span>
          </h2>
        </div>
        <Swiper
          className="landing-layout-testimonials"
          data-landing-stagger
          modules={[Autoplay, FreeMode]}
          slidesPerView="auto"
          spaceBetween={16}
          speed={10400}
          loop={!prefersReducedMotion}
          allowTouchMove
          grabCursor
          freeMode={{ enabled: true, momentum: false }}
          autoplay={
            prefersReducedMotion
              ? false
              : {
                  delay: 0,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }
          }
        >
          {goals.map(([, quote, name, role], index) => (
            <SwiperSlide
              className="landing-layout-testimonials__slide"
              key={quote}
            >
              <article>
                <p>{quote}</p>
                <div>
                  <span className="landing-layout-testimonials__avatar">
                    <Image
                      src={LEARNER_GOAL_AVATAR_SRCS[index]}
                      alt=""
                      width={42}
                      height={42}
                      draggable={false}
                    />
                  </span>
                  <section className="landing-layout-testimonials__who">
                    <strong>{name}</strong>
                    <small>{role}</small>
                  </section>
                </div>
              </article>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

function LearningDataSection() {
  const t = useTranslations("landing.portfolio");
  const dataPoints = [
    [t("dataOneValue"), t("dataOneLabel")],
    [t("dataTwoValue"), t("dataTwoLabel")],
    [t("dataThreeValue"), t("dataThreeLabel")],
    [t("dataFourValue"), t("dataFourLabel")],
  ];

  return (
    <section className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-stats-row">
          <div data-landing-heading>
            <Eyebrow>{t("learningDataEyebrow")}</Eyebrow>
            <h2>
              {t("dataTitleLineOne")}
              <br />
              <span>{t("dataTitleAccent")}</span>
            </h2>
            <p>{t("dataDescription")}</p>
          </div>
          <div className="landing-layout-stats-grid">
            {dataPoints.map(([value, label]) => (
              <div
                className="landing-layout-stat"
                data-landing-stagger
                key={value}
              >
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const t = useTranslations("landing");
  const features = [
    {
      title: t("features.correctionTitle"),
      description: t("features.correctionDescription"),
      icon: <MessageSquareText aria-hidden="true" />,
    },
    {
      title: t("features.practiceTitle"),
      description: t("features.practiceDescription"),
      icon: <PanelsTopLeft aria-hidden="true" />,
      tall: true,
    },
    {
      title: t("features.reportTitle"),
      description: t("features.reportDescription"),
      icon: <LayoutDashboard aria-hidden="true" />,
    },
    {
      title: t("features.libraryTitle"),
      description: t("features.libraryDescription"),
      icon: <BookOpenText aria-hidden="true" />,
    },
  ];

  return (
    <section
      id="features"
      className="landing-layout-section"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>{t("portfolio.featuresEyebrow")}</Eyebrow>
          <h2>
            {t("portfolio.featuresTitleBase")}{" "}
            <span>{t("portfolio.featuresTitleAccent")}</span>
          </h2>
        </div>
        <div className="landing-layout-feature-grid">
          {features.map((feature) => (
            <article
              className={
                feature.tall
                  ? "landing-layout-feature landing-layout-feature--tall"
                  : "landing-layout-feature"
              }
              data-landing-stagger
              key={feature.title}
            >
              <span className="landing-layout-icon">{feature.icon}</span>
              <div />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FutureScopeSection() {
  const t = useTranslations("landing.portfolio");
  const futureItems = [
    [t("futureOneTitle"), t("futureStatus"), t("futureOneDescription")],
    [t("futureTwoTitle"), t("futureStatus"), t("futureTwoDescription")],
    [t("futureThreeTitle"), t("futureStatus"), t("futureThreeDescription")],
  ];

  return (
    <section
      id="blog"
      className="landing-layout-section landing-layout-section--blog"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>{t("futureScopeEyebrow")}</Eyebrow>
          <h2>
            {t("futureTitleBase")} <span>{t("futureTitleAccent")}</span>
          </h2>
        </div>
        <div className="landing-layout-blog-grid">
          {futureItems.map(([title, status, description], index) => (
            <article
              className={
                index === 0
                  ? "landing-layout-post landing-layout-post--dark"
                  : "landing-layout-post"
              }
              data-landing-stagger
              key={title}
            >
              <VisualLabel
                label={`${title} ${t("previewLabel")}`}
                imageSrc={FUTURE_SCOPE_IMAGE_SRCS[index]}
              />
              <span>{status}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const t = useTranslations("landing.portfolio");
  const steps = [
    ["01.", t("processOneTitle"), t("processOneDescription")],
    ["02.", t("processTwoTitle"), t("processTwoDescription")],
    ["03.", t("processThreeTitle"), t("processThreeDescription")],
    ["04.", t("processFourTitle"), t("processFourDescription")],
  ];

  return (
    <section className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-process-row">
          <div className="landing-layout-process-head" data-landing-heading>
            <Eyebrow>{t("processEyebrow")}</Eyebrow>
            <h2>
              {t("processTitleLineOne")}
              <br />
              <span>{t("processTitleAccent")}</span>
            </h2>
          </div>
          <div className="landing-layout-step-list">
            {steps.map(([number, title, description]) => (
              <article data-landing-line key={number}>
                <div
                  className="landing-layout-step-content"
                  data-landing-stagger
                >
                  <span className="landing-layout-number">{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PathSection({ primary, primaryLabel }: LandingLayoutCta) {
  const t = useTranslations("landing.portfolio");
  const paths = [
    [
      t("pathOneName"),
      t("pathOneDescription"),
      t("pathOneMarker"),
      [
        t("pathOneItemOne"),
        t("pathOneItemTwo"),
        t("pathOneItemThree"),
        t("pathOneItemFour"),
      ],
      "/sign-up",
    ],
    [
      t("pathTwoName"),
      t("pathTwoDescription"),
      t("pathTwoMarker"),
      [
        t("pathTwoItemOne"),
        t("pathTwoItemTwo"),
        t("pathTwoItemThree"),
        t("pathTwoItemFour"),
      ],
      "/login",
    ],
    [
      t("pathThreeName"),
      t("pathThreeDescription"),
      "51–54",
      [
        t("pathThreeItemOne"),
        t("pathThreeItemTwo"),
        t("pathThreeItemThree"),
        t("pathThreeItemFour"),
      ],
      "/sign-up",
    ],
  ];

  return (
    <section
      className="landing-layout-section landing-layout-section--center landing-layout-section--pricing"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div
          className="landing-layout-heading landing-layout-heading--center"
          data-landing-heading
        >
          <Eyebrow center>{t("pathsEyebrow")}</Eyebrow>
          <h2>
            {t("pathsTitleBase")} <span>{t("pathsTitleAccent")}</span>
          </h2>
        </div>
        <div className="landing-layout-path-grid">
          {paths.map(([name, description, marker, items, href]) => (
            <article
              className="landing-layout-path"
              data-landing-stagger
              key={name as string}
            >
              <h3>{name}</h3>
              <p>{description}</p>
              <hr />
              <strong>
                {marker === "51–54" ? (
                  <span className="landing-layout-number">{marker}</span>
                ) : (
                  marker
                )}
              </strong>
              <ul>
                {(items as string[]).map((item) => (
                  <li key={item}>
                    <span
                      className="landing-layout-check text-background after:!hidden"
                      aria-hidden="true"
                    >
                      <Check size={13} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                className="landing-layout-dark-button"
                href={primary?.href ?? (href as string)}
              >
                {primary ? primaryLabel : t("start")}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductFooter({ primary, primaryLabel }: LandingLayoutCta) {
  const t = useTranslations("landing");

  return (
    <footer id="contact" className="landing-layout-footer" data-landing-section>
      <div className="landing-layout-wrap landing-layout-footer__inner">
        <h2 data-landing-heading>
          <a
            className="landing-layout-footer__cta"
            href={primary?.href ?? "/sign-up"}
          >
            {t("portfolio.brandName")}
            <ArrowRight aria-hidden="true" strokeWidth={3.5} />
          </a>
        </h2>
        <p>{t("portfolio.footerDescription")}</p>
        <div className="landing-layout-footer__bottom">
          <span className="landing-layout-footer__brandline">
            <BrandLogo height={34} />
          </span>
          <nav>
            {primary ? (
              <a href={primary.href}>{primaryLabel}</a>
            ) : (
              <>
                <a href="/sign-up">{t("portfolio.start")}</a>
                <a href="/login">{t("ctaLogin")}</a>
              </>
            )}
            <a href="/terms">{t("sections.footerLegalTerms")}</a>
            <a href="/privacy">{t("sections.footerLegalPrivacy")}</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function PortfolioLandingLayout({
  authStatus,
}: PortfolioLandingLayoutProps) {
  const rootRef = useLandingMotion();
  const prefersReducedMotion = usePrefersReducedMotion();
  const t = useTranslations("landing");
  const primary = authStatus === "anonymous" ? null : getLandingCta(authStatus);
  const primaryLabel = primary ? t(primary.headerLabelKey) : "";

  return (
    <div ref={rootRef} className="landing-layout-motion-root">
      {/* ===================== LEARNING LOOP ===================== */}
      <LearningLoopSection primary={primary} primaryLabel={primaryLabel} />
      {/* ===================== CORE VALUE ===================== */}
      <CoreValueSection />
      {/* ===================== LEARNER GOALS ===================== */}
      <LearnerGoalsSection prefersReducedMotion={prefersReducedMotion} />
      {/* ===================== LEARNING DATA ===================== */}
      <LearningDataSection />
      {/* ===================== MVP FEATURES ===================== */}
      <FeaturesSection />
      {/* ===================== FUTURE SCOPE ===================== */}
      <FutureScopeSection />
      {/* ===================== USER FLOW ===================== */}
      <ProcessSection />
      {/* ===================== ENTRY PATHS ===================== */}
      <PathSection primary={primary} primaryLabel={primaryLabel} />
      {/* ===================== FOOTER ===================== */}
      <ProductFooter primary={primary} primaryLabel={primaryLabel} />
    </div>
  );
}
