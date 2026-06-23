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
  type Icon as IconsaxIcon,
  type IconProps as IconsaxIconProps,
} from "iconsax-react";

type CompatIconProps = Omit<IconsaxIconProps, "variant"> & {
  absoluteStrokeWidth?: boolean;
  strokeWidth?: number | string;
};

export type AppIcon = ComponentType<CompatIconProps>;

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
export const Trophy = createIconsaxIcon(Cup);
export const UserRoundPlus = createIconsaxIcon(ProfileAdd);
export const X = createIconsaxIcon(CloseCircle);
