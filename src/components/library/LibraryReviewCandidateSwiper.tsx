"use client";

import { Button, Empty, Typography } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { A11y, Grid, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import { APP_ROUTES } from "@/lib/routes";
import type { LibraryReviewCandidate } from "@/lib/library/types";
import { LibraryReviewCandidateCard } from "./LibraryReviewCandidateCard";

const { Text, Title } = Typography;

type Props = {
  candidates: LibraryReviewCandidate[];
};

export function LibraryReviewCandidateSwiper({ candidates }: Props) {
  const t = useTranslations("library.dashboard");
  const [activePage, setActivePage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(candidates.length / 6));
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
        <div className="mb-4 flex items-center">
          <Title level={4} className="!m-0">
            {t("review.title")}
          </Title>
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
        className="mb-4 flex flex-wrap items-center gap-3"
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

      <Swiper
        modules={[Navigation, Pagination, Grid, A11y]}
        navigation={navigation}
        pagination={{ clickable: true, el: ".library-review-swiper-pagination" }}
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
        onSlideChange={(swiper) => {
          const nextPage = Math.min(
            pageCount,
            Math.floor((swiper.activeIndex ?? 0) / 6) + 1,
          );
          setActivePage(nextPage);
        }}
        className="library-review-swiper"
      >
        {candidates.map((candidate) => (
          <SwiperSlide key={candidate.id} className="h-auto">
            <LibraryReviewCandidateCard candidate={candidate} />
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="mt-3 flex items-center justify-center gap-3">
        <span className="library-review-swiper-pagination" />
        <Text type="secondary" className="text-sm">
          {activePage} / {pageCount}
        </Text>
      </div>
    </section>
  );
}
