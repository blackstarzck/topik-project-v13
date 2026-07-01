"use client";

import { Button, Empty, Typography } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { A11y, Grid, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { APP_ROUTES } from "@/lib/routes";
import type { LibraryReviewCandidate } from "@/lib/library/types";
import { LibraryReviewCandidateCard } from "./LibraryReviewCandidateCard";

const { Title } = Typography;

type Props = {
  candidates: LibraryReviewCandidate[];
};

export function LibraryReviewCandidateSwiper({ candidates }: Props) {
  const t = useTranslations("library.dashboard");
  const navigation = useMemo(
    () => ({
      prevEl: ".library-review-swiper-prev",
      nextEl: ".library-review-swiper-next",
    }),
    [],
  );

  if (candidates.length === 0) {
    return (
      <section data-testid="library-review-swiper" className="min-w-0">
        <div
          data-testid="library-review-swiper-header"
          className="mb-4 flex flex-wrap items-center justify-between gap-3"
        >
          <Title level={4} className="!m-0">
            {t("review.title")}
          </Title>
          <Button
            data-testid="library-review-view-all"
            type="link"
            href={APP_ROUTES.libraryProblems}
          >
            {t("review.viewAll")}
          </Button>
        </div>
        <Empty
          className="py-8"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("review.empty")}
        >
          <Button type="primary" href={APP_ROUTES.practiceProblems}>
            {t("actions.goToPractice")}
          </Button>
        </Empty>
      </section>
    );
  }

  return (
    <section data-testid="library-review-swiper" className="min-w-0">
      <div
        data-testid="library-review-swiper-header"
        className="mb-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div
          className="flex items-center gap-2"
          data-testid="library-review-swiper-title-group"
        >
          <Title level={4} className="!m-0">
            {t("review.title")}
          </Title>
          <div
            data-testid="library-review-swiper-actions"
            className="flex items-center gap-2"
          >
            <Button
              aria-label={t("review.prev")}
              className="library-review-swiper-prev"
              icon={<ChevronLeft aria-hidden size={16} />}
            />
            <Button
              aria-label={t("review.next")}
              className="library-review-swiper-next"
              icon={<ChevronRight aria-hidden size={16} />}
            />
          </div>
        </div>
        <Button
          data-testid="library-review-view-all"
          type="link"
          href={APP_ROUTES.libraryProblems}
        >
          {t("review.viewAll")}
        </Button>
      </div>

      <Swiper
        modules={[Navigation, Grid, A11y]}
        navigation={navigation}
        grid={{ rows: 2, fill: "row" }}
        spaceBetween={16}
        slidesPerView={1.08}
        breakpoints={{
          768: { slidesPerView: 2.2, spaceBetween: 16 },
          1280: { slidesPerView: 3.25, spaceBetween: 16 },
        }}
        a11y={{
          prevSlideMessage: t("review.prev"),
          nextSlideMessage: t("review.next"),
        }}
        className="library-review-swiper"
      >
        {candidates.map((candidate) => (
          <SwiperSlide key={candidate.id} className="h-auto">
            <LibraryReviewCandidateCard candidate={candidate} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
