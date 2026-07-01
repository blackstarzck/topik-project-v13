"use client";

import type { ComponentType } from "react";
import {
  Add,
  AlignLeft,
  ArrowDown2,
  ArrowLeft as IconsaxArrowLeft,
  ArrowRight as IconsaxArrowRight,
  ArrowRight2,
  Book1,
  BookSaved,
  Calendar2,
  Card,
  Chart,
  Chart2,
  Check as IconsaxCheck,
  ClipboardText,
  Clock,
  CloseCircle,
  Cup,
  Danger,
  DirectInbox,
  DirectboxNotif,
  DocumentText,
  Element4,
  Export,
  Eye as IconsaxEye,
  Filter,
  Global,
  HambergerMenu,
  Magicpen,
  LampOn,
  Lifebuoy,
  Lock as IconsaxLock,
  Login,
  MagicStar,
  MedalStar,
  MessageCircle as IconsaxMessageCircle,
  MessageText,
  Monitor,
  NoteText,
  NotificationBing,
  PenTool,
  PresentionChart,
  ProfileAdd,
  ProgrammingArrows,
  RecordCircle,
  Refresh,
  RotateLeft,
  Routing,
  Send2,
  ShieldSlash as IconsaxShieldSlash,
  ShieldTick,
  Slash,
  Sms,
  Teacher,
  TextalignJustifyleft,
  TickCircle,
  Trash as IconsaxTrash,
  type Icon as IconsaxIcon,
  type IconProps as IconsaxIconProps,
} from "iconsax-react";

type CompatIconProps = Omit<IconsaxIconProps, "variant"> & {
  absoluteStrokeWidth?: boolean;
  strokeWidth?: number | string;
};

export type AppIcon = ComponentType<CompatIconProps>;

export function AiCommentaryIcon({
  color = "currentColor",
  size = 24,
  ...props
}: CompatIconProps) {
  const { absoluteStrokeWidth, strokeWidth, ...iconProps } = props;
  void absoluteStrokeWidth;
  void strokeWidth;

  return (
    <svg
      {...iconProps}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M15.19 20.75c-.42.17-.86.3-1.32.39-2.14.41-4.2.09-5.96-.75-.28-.13-.75-.19-1.06-.12l-2.71.65c-.91.22-1.46-.33-1.24-1.24l.65-2.71c.08-.31.01-.8-.12-1.08-.8-1.68-1.13-3.63-.79-5.69.64-3.95 3.83-7.14 7.78-7.78 6.5-1.06 12.04 4.48 10.98 10.98-.09.57-.24 1.12-.43 1.65"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.78 6.58c1.5.57 2.69 1.77 3.26 3.27"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m18.7 14.35.41 1.48c.3 1.08 1.12 1.9 2.2 2.21l1.49.4c.55.16.55.78 0 .94l-1.47.4c-1.09.3-1.91 1.12-2.21 2.21l-.4 1.47c-.16.55-.78.55-.94 0l-.4-1.47c-.3-1.09-1.12-1.91-2.21-2.21l-1.47-.4c-.55-.16-.55-.78 0-.94l1.47-.4c1.09-.31 1.91-1.13 2.21-2.21l.4-1.48c.16-.54.77-.54.92 0Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function createIconsaxIcon(Icon: IconsaxIcon): AppIcon {
  function IconsaxCompatIcon({
    color = "currentColor",
    size = 24,
    ...props
  }: CompatIconProps) {
    const { absoluteStrokeWidth, strokeWidth, ...iconProps } = props;
    void absoluteStrokeWidth;
    void strokeWidth;

    return <Icon {...iconProps} color={color} size={size} variant="Linear" />;
  }

  return IconsaxCompatIcon;
}

export const AlignJustify = createIconsaxIcon(TextalignJustifyleft);
export const ArrowLeft = createIconsaxIcon(IconsaxArrowLeft);
export const ArrowRight = createIconsaxIcon(IconsaxArrowRight);
export const ArrowUpRight = createIconsaxIcon(Export);
export const Ban = createIconsaxIcon(Slash);
export const BarChart3 = createIconsaxIcon(Chart2);
export const Bell = createIconsaxIcon(NotificationBing);
export const BookOpenCheck = createIconsaxIcon(BookSaved);
export const BookOpenText = createIconsaxIcon(Book1);
export const CalendarDays = createIconsaxIcon(Calendar2);
export const ChartNoAxesColumnIncreasing = createIconsaxIcon(Chart);
export const Check = createIconsaxIcon(IconsaxCheck);
export const CheckCircle2 = createIconsaxIcon(TickCircle);
export const ChevronDown = createIconsaxIcon(ArrowDown2);
export const ChevronRight = createIconsaxIcon(ArrowRight2);
export const Circle = createIconsaxIcon(RecordCircle);
export const ClipboardList = createIconsaxIcon(ClipboardText);
export const Clock3 = createIconsaxIcon(Clock);
export const CreditCard = createIconsaxIcon(Card);
export const DirectboxNotifIcon = createIconsaxIcon(DirectboxNotif);
export const DocumentTextIcon = createIconsaxIcon(DocumentText);
export const Eye = createIconsaxIcon(IconsaxEye);
export const FileText = createIconsaxIcon(DocumentText);
export const Globe2 = createIconsaxIcon(Global);
export const GraduationCap = createIconsaxIcon(Teacher);
export const Inbox = createIconsaxIcon(DirectInbox);
export const LayoutDashboard = createIconsaxIcon(Element4);
export const LifeBuoy = createIconsaxIcon(Lifebuoy);
export const Lightbulb = createIconsaxIcon(LampOn);
export const ListChecks = createIconsaxIcon(NoteText);
export const ListFilter = createIconsaxIcon(Filter);
export const Lock = createIconsaxIcon(IconsaxLock);
export const LockKeyhole = createIconsaxIcon(ShieldTick);
export const LogIn = createIconsaxIcon(Login);
export const MagicPen = createIconsaxIcon(Magicpen);
export const Mail = createIconsaxIcon(Sms);
export const Menu = createIconsaxIcon(HambergerMenu);
export const MessageCircle = createIconsaxIcon(IconsaxMessageCircle);
export const MessageSquareText = createIconsaxIcon(MessageText);
export const MonitorCheck = createIconsaxIcon(Monitor);
export const PanelsTopLeft = createIconsaxIcon(AlignLeft);
export const PenLine = createIconsaxIcon(PenTool);
export const PencilLine = createIconsaxIcon(PenTool);
export const PresentationChartIcon = createIconsaxIcon(PresentionChart);
export const Plus = createIconsaxIcon(Add);
export const ProgrammingArrowsIcon = createIconsaxIcon(ProgrammingArrows);
export const RefreshCcw = createIconsaxIcon(Refresh);
export const RotateCcw = createIconsaxIcon(RotateLeft);
export const Route = createIconsaxIcon(Routing);
export const SendHorizontal = createIconsaxIcon(Send2);
export const ShieldAlert = createIconsaxIcon(Danger);
export const ShieldSlash = createIconsaxIcon(IconsaxShieldSlash);
export const Sparkles = createIconsaxIcon(MagicStar);
export const Target = createIconsaxIcon(MedalStar);
export const Trash2 = createIconsaxIcon(IconsaxTrash);
export const Trophy = createIconsaxIcon(Cup);
export const UserRoundPlus = createIconsaxIcon(ProfileAdd);
export const X = createIconsaxIcon(CloseCircle);
