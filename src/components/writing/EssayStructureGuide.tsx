"use client";

import { Tag, Typography } from "antd";
import { Ban, FileText, ListChecks, Route } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  NormalizedEssayGuidance,
  NormalizedEssayGuidanceSection,
} from "@/lib/writing/problem-normalizer";
import { WritingGuideAccordion } from "./WritingGuideAccordion";

const { Text } = Typography;

type Props = {
  guidance: NormalizedEssayGuidance;
  loadFailed: boolean;
  loadFailedLabel: string;
};

function GuidanceSections({
  sections,
  requiredLabel,
  outlineSuffix,
  isOutline = false,
}: {
  sections: NormalizedEssayGuidanceSection[];
  requiredLabel: string;
  outlineSuffix: string;
  isOutline?: boolean;
}) {
  return (
    <div className="writing-guide-copy">
      {sections.map((section) => (
        <section key={section.id} className="grid gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Text strong>
              {isOutline ? `${section.title} ${outlineSuffix}` : section.title}
            </Text>
            {section.required ? (
              <Tag className="m-0" color="blue">
                {requiredLabel}
              </Tag>
            ) : null}
          </div>
          {section.description ? <p>{section.description}</p> : null}
          {section.items.length > 0 ? (
            <ul className="writing-guide-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function EssayStructureGuide({
  guidance,
  loadFailed,
  loadFailedLabel,
}: Props) {
  const tPage = useTranslations("writing.q54");
  const items = [
    {
      key: "structure",
      disabledOnLoadFailed: true,
      icon: <FileText aria-hidden size={18} />,
      title: tPage("guidanceStructureTitle"),
      children: (
        <GuidanceSections
          sections={guidance.structure}
          requiredLabel={tPage("guidanceRequiredTag")}
          outlineSuffix={tPage("guidanceOutlineSectionSuffix")}
        />
      ),
    },
    {
      key: "focus",
      disabledOnLoadFailed: true,
      icon: <ListChecks aria-hidden size={18} />,
      title: tPage("guidanceFocusTitle"),
      children: (
        <div className="writing-guide-copy">
          {guidance.reasonCount ? (
            <p>
              {tPage("guidanceReasonCount", { count: guidance.reasonCount })}
            </p>
          ) : null}
          {guidance.reasoningPattern ? (
            <p>
              {tPage("guidanceReasoningPattern", {
                pattern: guidance.reasoningPattern,
              })}
            </p>
          ) : null}
          {guidance.scoringFocus.length > 0 ? (
            <div className="writing-guide-copy">
              <Text strong>{tPage("guidanceScoringFocusLabel")}</Text>
              <ul className="writing-guide-list">
                {guidance.scoringFocus.map((focus) => (
                  <li key={focus}>{focus}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {guidance.prohibitedElements.length > 0 ? (
            <div className="writing-guide-copy">
              <div className="writing-guide-card__title">
                <Ban aria-hidden size={16} />
                <Text strong>{tPage("guidanceAvoidLabel")}</Text>
              </div>
              <ul className="writing-guide-list">
                {guidance.prohibitedElements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!guidance.reasonCount &&
          !guidance.reasoningPattern &&
          guidance.scoringFocus.length === 0 &&
          guidance.prohibitedElements.length === 0 ? (
            <p>{tPage("guidanceFocusFallback")}</p>
          ) : null}
        </div>
      ),
    },
    ...(guidance.modelOutline.length > 0
      ? [
          {
            key: "outline",
            disabledOnLoadFailed: true,
            icon: <Route aria-hidden size={18} />,
            title: tPage("guidanceOutlineTitle"),
            children: (
              <GuidanceSections
                sections={guidance.modelOutline}
                requiredLabel={tPage("guidanceRequiredTag")}
                outlineSuffix={tPage("guidanceOutlineSectionSuffix")}
                isOutline
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div data-testid="q54-guidance-accordion">
      <WritingGuideAccordion
        className="writing-guide-accordion writing-guide-accordion--support"
        loadFailed={loadFailed}
        loadFailedLabel={loadFailedLabel}
        defaultActiveKeys={["structure", "focus"]}
        items={items}
      />
    </div>
  );
}
