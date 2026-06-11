"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Autoplay, FreeMode } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

function ArrowIcon({ strokeWidth = 2 }: { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function TalkpikMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-8Z"
        fill="currentColor"
      />
      <path
        d="M8 8h8M8 11h5"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function VisualLabel({ label }: { label: string }) {
  return (
    <div className="landing-layout-visual" data-landing-parallax>
      <span>{label}</span>
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
      gsap.set("[data-landing-section], [data-landing-stagger], [data-landing-line]", {
        clearProps: "all",
      });
      return undefined;
    }

    const observers: IntersectionObserver[] = [];
    const rootElement = rootRef.current;

    const context = gsap.context(() => {
      const heroItems = document.querySelectorAll(".landing-hero-copy > *");

      gsap.from(heroItems, {
        autoAlpha: 0,
        y: 44,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.12,
        delay: 0.12,
      });

      gsap.utils.toArray<HTMLElement>("[data-landing-section]").forEach((section) => {
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

      gsap.utils.toArray<HTMLElement>(".landing-layout-step-list").forEach((list) => {
        const lines = list.querySelectorAll<HTMLElement>("[data-landing-line]");

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

        ScrollTrigger.create({
          trigger: list,
          start: "top 70%",
          once: true,
          onEnter: animateLines,
        });

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

      gsap.utils.toArray<HTMLElement>("[data-landing-parallax]").forEach((item) => {
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
      rootElement?.querySelectorAll(".landing-layout-step-list").forEach((list) => {
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

function LearningLoopSection() {
  const loops = [
    ["학습 현황", "목표 등급, 시험일까지 남은 시간, 주간 학습 상태를 한눈에 확인합니다.", "dashboard preview"],
    ["문제 추천", "부족한 영역과 목표 급수에 맞는 읽기, 듣기, 쓰기 학습으로 바로 이동합니다.", "recommendation preview"],
    ["쓰기 연습", "TOPIK 쓰기 51번부터 54번까지 유형별 답안을 작성합니다.", "writing practice preview"],
    ["AI 피드백", "점수, 총평, 단계별 첨삭, 비교 리포트로 다음 학습을 이어갑니다.", "feedback report preview"],
  ];

  return (
    <section id="preview" className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div data-landing-heading>
          <Eyebrow>Learning Loop</Eyebrow>
        </div>
        <div className="landing-layout-work-grid">
          {loops.map(([name, description, label]) => (
            <article className="landing-layout-work" data-landing-stagger key={name}>
              <figure>
                <VisualLabel label={label} />
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
          <a className="landing-layout-pill" href="/sign-up">
            무료로 시작하기
            <ArrowIcon />
          </a>
        </div>
      </div>
    </section>
  );
}

function CoreValueSection() {
  const values = [
    [
      "01",
      "대시보드로 현황 파악",
      "목표 급수, 남은 시험일, 학습 시간, 푼 문제 수, 출석 일수를 모아 다음 행동을 보여줍니다.",
    ],
    [
      "02",
      "부족한 영역 바로 연습",
      "추천 학습과 약점 기반 추천으로 읽기, 듣기, 쓰기 문제 후보를 빠르게 찾습니다.",
    ],
    [
      "03",
      "쓰기 답안 AI 첨삭",
      "TOPIK 쓰기 51~54번 답안을 작성하고 총평, 구조 분석, 상세 첨삭을 확인합니다.",
    ],
  ];

  return (
    <section id="services" className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>Core Value</Eyebrow>
          <h2>
            학습 현황부터
            <br />
            피드백까지 <span>하나의 흐름</span>
          </h2>
        </div>
        <div className="landing-layout-service-grid">
          {values.map(([number, title, description]) => (
            <article className="landing-layout-service" data-landing-stagger key={number}>
              <div className="landing-layout-service__frame">
                <span className="landing-layout-number">{number}</span>
                <div className="landing-layout-service__strip" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
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
  const goals = [
    [
      "G1",
      "목표 등급까지 얼마나 남았는지 한눈에 보고 싶어요.",
      "TOPIK I·II 준비 학습자",
      "학습 현황 확인",
    ],
    [
      "G2",
      "혼자 쓴 답안도 구체적으로 고칠 부분을 알고 싶어요.",
      "쓰기 첨삭이 필요한 학습자",
      "AI 피드백",
    ],
    [
      "G3",
      "저장한 문제와 이전 피드백을 다시 보며 복습하고 싶어요.",
      "반복 학습이 필요한 학습자",
      "내 서재와 보관함",
    ],
    [
      "G4",
      "약점에 맞는 다음 문제를 바로 추천받고 싶어요.",
      "시험 전 집중 학습자",
      "약점 기반 추천",
    ],
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
          <Eyebrow center>Learner Goals</Eyebrow>
          <h2>
            TOPIK 학습자가 <span>원하는 것</span>
          </h2>
        </div>
        <Swiper
          className="landing-layout-testimonials"
          data-landing-stagger
          modules={[Autoplay, FreeMode]}
          slidesPerView="auto"
          spaceBetween={24}
          speed={5200}
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
          {goals.map(([initials, quote, name, role]) => (
            <SwiperSlide
              className="landing-layout-testimonials__slide"
              key={quote}
            >
              <article>
                <p>{quote}</p>
                <div>
                  <span>{initials}</span>
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
  const dataPoints = [
    ["학습 시간", "주간 학습량"],
    ["푼 문제", "연습 누적"],
    ["출석 일수", "학습 지속성"],
    ["목표 급수", "시험 준비 기준"],
  ];

  return (
    <section className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-stats-row">
          <div data-landing-heading>
            <Eyebrow>Learning Data</Eyebrow>
            <h2>
              다음 행동을 정하는
              <br />
              <span>학습 지표</span>
            </h2>
            <p>
              PRD 기준으로 학습 시간, 문제 수, 출석, 목표 급수, 시험일까지 남은
              시간을 대시보드와 성장 흐름에서 활용합니다.
            </p>
          </div>
          <div className="landing-layout-stats-grid">
            {dataPoints.map(([value, label]) => (
              <div className="landing-layout-stat" data-landing-stagger key={value}>
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
  return (
    <section id="features" className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>MVP Features</Eyebrow>
          <h2>
            먼저 검증할 <span>핵심 기능</span>
          </h2>
        </div>
        <div className="landing-layout-feature-grid">
          <article className="landing-layout-feature" data-landing-stagger>
            <span className="landing-layout-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="15" rx="2" />
                <path d="M7 8h5M7 12h10M7 16h7" />
              </svg>
            </span>
            <div />
            <h3>홈 대시보드</h3>
            <p>현재 학습 상태와 다음 학습 진입점을 한 화면에서 보여줍니다.</p>
          </article>
          <article
            className="landing-layout-feature landing-layout-feature--tall"
            data-landing-stagger
          >
            <span className="landing-layout-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
              </svg>
            </span>
            <div />
            <h3>읽기·듣기 문제 생성</h3>
            <p>TOPIK 단계, 목표 등급, 문제 유형을 고른 뒤 연습 문제로 이동합니다.</p>
          </article>
          <article className="landing-layout-feature" data-landing-stagger>
            <span className="landing-layout-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 20h16" />
                <path d="M7 17 17.5 6.5a2.1 2.1 0 0 1 3 3L10 20H7v-3Z" />
              </svg>
            </span>
            <div />
            <h3>쓰기 51·53번 연습</h3>
            <p>빈칸, 도입, 전개, 마무리처럼 유형별 작성 흐름을 제공합니다.</p>
          </article>
          <article className="landing-layout-feature" data-landing-stagger>
            <span className="landing-layout-icon">
              <TalkpikMark />
            </span>
            <div />
            <h3>AI 피드백 상세</h3>
            <p>점수, 총평, 구조 분석, 상세 첨삭으로 답안 개선 과정을 보여줍니다.</p>
          </article>
          <article className="landing-layout-feature" data-landing-stagger>
            <span className="landing-layout-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z" />
                <path d="M8 7h6M8 11h8M8 15h5" />
              </svg>
            </span>
            <div />
            <h3>보관함과 내 서재</h3>
            <p>완료된 피드백, 임시 답안, 저장한 문제를 다시 찾아 복습합니다.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function FutureScopeSection() {
  const futureItems = [
    [
      "단어장",
      "Future scope",
      "독립 화면은 아직 route inventory에 없으며, 우선 내 서재 하위 기능으로 다룹니다.",
    ],
    [
      "모의고사",
      "Future scope",
      "실전 시험과 결과 화면은 별도 IA와 route가 추가된 뒤 구현합니다.",
    ],
    [
      "게시판",
      "Future scope",
      "공지와 이벤트 상세 화면은 현재 제품 맥락에 남기고 후속 범위로 관리합니다.",
    ],
  ];

  return (
    <section
      id="blog"
      className="landing-layout-section landing-layout-section--blog"
      data-landing-section
    >
      <div className="landing-layout-wrap">
        <div className="landing-layout-heading" data-landing-heading>
          <Eyebrow>Future Scope</Eyebrow>
          <h2>
            지금은 약속하지 않는 <span>후순위 범위</span>
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
              {index === 0 ? (
                <div className="landing-layout-visual">
                  <em>
                    <TalkpikMark />
                  </em>
                </div>
              ) : (
                <VisualLabel label={`${title} preview`} />
              )}
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
  const steps = [
    [
      "01.",
      "가입과 목표 설정",
      "제품 랜딩에서 가입하거나 로그인하고, 첫 진입 사용자는 학습 목표를 설정합니다.",
    ],
    [
      "02.",
      "추천 학습 시작",
      "홈 대시보드에서 추천 학습이나 약점 기반 추천으로 들어가 풀 문제를 선택합니다.",
    ],
    [
      "03.",
      "쓰기 답안 작성",
      "TOPIK 쓰기 51~54번 유형에 맞춰 답안을 작성하고 제출 확인을 거칩니다.",
    ],
    [
      "04.",
      "피드백과 복습",
      "AI 분석 후 피드백을 확인하고, 비교 리포트나 다음 문제 추천으로 이어갑니다.",
    ],
  ];

  return (
    <section className="landing-layout-section" data-landing-section>
      <div className="landing-layout-wrap">
        <div className="landing-layout-process-row">
          <div className="landing-layout-process-head" data-landing-heading>
            <Eyebrow>User Flow</Eyebrow>
            <h2>
              매일 이어지는
              <br />
              <span>TOPIK 학습 루틴</span>
            </h2>
          </div>
          <div className="landing-layout-step-list">
            {steps.map(([number, title, description]) => (
              <article data-landing-line key={number}>
                <div className="landing-layout-step-content" data-landing-stagger>
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

function PathSection() {
  const paths = [
    [
      "처음 시작",
      "TOPIK AI 학습을 처음 시작하는 사용자를 위한 공개 진입 흐름입니다.",
      "회원가입",
      ["이메일 인증", "학습 목표 설정", "홈 대시보드 이동", "무료 시작 CTA"],
      "/sign-up",
    ],
    [
      "이어 학습",
      "이미 계정이 있는 사용자가 기존 학습 흐름으로 돌아가는 경로입니다.",
      "로그인",
      ["세션 확인", "대시보드 복귀", "이어하기 카드", "저장 기록 확인"],
      "/login",
    ],
    [
      "쓰기 집중",
      "쓰기 첨삭과 보관함을 중심으로 실력을 개선하는 핵심 사용 흐름입니다.",
      "51–54",
      ["문제 유형 선택", "자동 저장 상태", "AI 분석", "다시 풀기"],
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
          <Eyebrow center>Entry Paths</Eyebrow>
          <h2>
            사용자가 바로 이해하는 <span>시작 경로</span>
          </h2>
        </div>
        <div className="landing-layout-path-grid">
          {paths.map(([name, description, marker, items, href]) => (
            <article className="landing-layout-path" data-landing-stagger key={name as string}>
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
                    <span className="landing-layout-check" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <a className="landing-layout-dark-button" href={href as string}>
                시작하기
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductFooter() {
  return (
    <footer id="contact" className="landing-layout-footer" data-landing-section>
      <div className="landing-layout-wrap landing-layout-footer__inner">
        <h2 data-landing-heading>
          TALKPIK AI로 시작하기
          <ArrowIcon strokeWidth={1.8} />
        </h2>
        <p>
          TOPIK 목표 등급을 정하고, 추천 문제를 풀고, 쓰기 답안 피드백까지
          하나의 학습 흐름으로 이어가세요.
        </p>
        <div className="landing-layout-footer__bottom">
          <span>© TALKPIK AI</span>
          <nav>
            <a href="/sign-up">시작하기</a>
            <a href="/login">로그인</a>
            <a href="/terms">이용약관</a>
            <a href="/privacy">개인정보처리방침</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function PortfolioLandingLayout() {
  const rootRef = useLandingMotion();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div ref={rootRef} className="landing-layout-motion-root">
      {/* ===================== LEARNING LOOP ===================== */}
      <LearningLoopSection />
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
      <PathSection />
      {/* ===================== FOOTER ===================== */}
      <ProductFooter />
    </div>
  );
}
